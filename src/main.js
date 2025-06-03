import { StreetService } from './services/streetService.js';
import { MapManager } from './managers/MapManager.js';
import { RouteManager } from './managers/RouteManager.js';
import { LocationManager } from './managers/LocationManager.js';

class WanderlustApp {
    constructor() {
        this.mapManager = new MapManager();
        this.routeManager = new RouteManager(this.mapManager);
        this.locationManager = new LocationManager();
        this.streetService = new StreetService();
        this.isTracking = false;
        this.keyboardMode = false;
        this.moveSpeed = 0.0002; // ~22 meters per keypress
        this.nearbyStreets = [];
        this.lastSegmentId = null;
        this.currentStreetName = null;
        this.lastUpdateTimestamp = 0;
        this.pendingStreetUpdate = null;

        this.init();
    }

    async init() {
        this.mapManager.initMap();
        this.setupEventListeners();
        this.routeManager.loadStoredRoutes();
        this.updateXPDisplay();
        
        // Set up position change callback
        this.locationManager.setPositionChangeCallback((position, isInitial) => {
            this.mapManager.updateUserMarker(position);
            if (isInitial) {
                this.mapManager.centerOnUser();
                this.mapManager.setAutoCenter(true);
            }
        });

        // Check location permission status
        const permissionStatus = await this.locationManager.checkPermissionStatus();
        if (permissionStatus === 'granted') {
            await this.locationManager.getInitialLocation();
            this.updateStatus('Click "Start Exploring" to begin your journey!');
        }
    }

    setupEventListeners() {
        const startBtn = document.getElementById('start-tracking');
        const keyboardBtn = document.getElementById('keyboard-mode');
        const centerBtn = document.getElementById('center-map');
        const clearBtn = document.getElementById('clear-routes');

        startBtn.addEventListener('click', () => this.toggleTracking());
        keyboardBtn.addEventListener('click', () => this.toggleKeyboardMode());
        centerBtn.addEventListener('click', () => {
            this.mapManager.setAutoCenter(true);
            this.mapManager.centerOnUser();
        });
        clearBtn.addEventListener('click', () => this.clearAllRoutes());

        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
    }

    clearAllRoutes() {
        if (confirm('Clear all explored routes? This will also reset your street exploration progress and cannot be undone.')) {
            // Clear routes and data
            this.routeManager.clearAllRoutes();
            
            // Clear map layers
            this.mapManager.clearAllRoutes();
            
            // Clear street exploration data
            this.streetService.clearExploredSegments();
            
            // Reset XP display
            this.updateXPDisplay();
            
            // Reset street tracking
            this.lastSegmentId = null;
            this.currentStreetName = null;
            
            this.updateStatus('All routes and street progress cleared. Start exploring again!');
        }
    }

    async toggleTracking() {
        const btn = document.getElementById('start-tracking');

        if (!this.isTracking) {
            if (!this.locationManager.currentPosition) {
                if (this.keyboardMode) {
                    this.locationManager.setDefaultPosition();
                    this.mapManager.createUserMarker(this.locationManager.currentPosition);
                    this.mapManager.setAutoCenter(true);
                    this.updateStatus('Keyboard mode: Ready to explore from San Francisco!');
                } else {
                    const permissionStatus = await this.locationManager.checkPermissionStatus();
                    if (permissionStatus === 'denied') {
                        this.updateStatus('Please enable location access in your browser settings to start exploring.');
                        return;
                    }
                    
                    try {
                        await this.locationManager.getCurrentPosition();
                        this.mapManager.setAutoCenter(true);
                        this.updateStatus('Location found! Starting to track your route...');
                    } catch (error) {
                        this.updateStatus('Unable to get your location. Please check your device settings.');
                        console.error('Location error:', error);
                        return;
                    }
                }
            }

            this.mapManager.setAutoCenter(true);
            this.mapManager.centerOnUser();
            this.startTracking();
            btn.textContent = 'Stop Exploring';
            btn.classList.add('tracking');
        } else {
            this.stopTracking();
            btn.textContent = 'Start Exploring';
            btn.classList.remove('tracking');
        }
    }

    startTracking() {
        if (!navigator.geolocation && !this.keyboardMode) return;

        this.isTracking = true;
        this.routeManager.startNewRoute();

        if (this.locationManager.currentPosition) {
            this.routeManager.addPointToRoute(this.locationManager.currentPosition);
        }

        if (!this.keyboardMode) {
            this.locationManager.startWatchingPosition(
                (position) => this.handleLocationUpdate(position)
            );
        }

        this.updateStatus('🚶‍♂️ Exploring... Keep moving to discover new areas!');
    }

    stopTracking() {
        this.isTracking = false;
        this.locationManager.stopWatchingPosition();
        this.mapManager.setAutoCenter(false);

        if (this.routeManager.currentRoute.length > 1) {
            this.routeManager.saveCurrentRoute();
            const xpGained = this.routeManager.calculateXP();
            this.addXP(xpGained);
            this.updateStatus(`Route saved! +${xpGained} XP earned! 🎉`);
        }
    }

    async handleLocationUpdate(position) {
        const newPos = this.locationManager.processPosition(position);
        this.mapManager.updateUserMarker(newPos);

        if (this.isTracking) {
            await this.processLocationForStreets(newPos[0], newPos[1]);
        }
    }

    async processLocationForStreets(lat, lng) {
        const currentTimestamp = Date.now();
        this.lastUpdateTimestamp = currentTimestamp;
        console.log(`🗺️ Processing location: ${lat}, ${lng}`);

        try {
            // Cancel any pending street update
            if (this.pendingStreetUpdate) {
                this.pendingStreetUpdate = null;
            }

            // Create a new pending update
            this.pendingStreetUpdate = currentTimestamp;

            this.nearbyStreets = await this.streetService.getNearbyStreets(lat, lng);
            
            // Check if this update is still relevant
            if (this.pendingStreetUpdate !== currentTimestamp) {
                console.log('Skipping outdated street update');
                return;
            }

            console.log(`📍 Found ${this.nearbyStreets.length} nearby streets`);

            if (this.nearbyStreets.length === 0) {
                this.routeManager.addPointToRoute([lat, lng]);
                this.currentStreetName = null;
                this.updateStatus('🚶‍♂️ Exploring off-road');
                return;
            }

            const closest = this.streetService.findClosestSegment(lat, lng, this.nearbyStreets, this.lastSegmentId);
            console.log('🎯 Closest segment:', closest);

            if (closest && closest.distance < 25) {
                const snappedPoint = closest.snapPoint;
                console.log(`🛣️ Snapping to ${closest.street.name}, distance: ${closest.distance.toFixed(1)}m`);

                if (closest.segment.id !== this.lastSegmentId) {
                    const xpGained = this.streetService.exploreSegment(closest.segment.id);
                    if (xpGained > 0) {
                        this.mapManager.drawExploredSegment(closest.segment);
                        this.addXP(xpGained);
                        this.updateStatus(`New street discovered! +${xpGained} XP (${closest.street.name})`);
                    }
                    this.lastSegmentId = closest.segment.id;
                    this.currentStreetName = closest.street.name;
                } else {
                    // Same street, just update status with current street name
                    this.updateStatus(`🚶‍♂️ Walking on ${closest.street.name}`);
                }

                this.routeManager.addPointToRoute(snappedPoint);
            } else {
                this.routeManager.addPointToRoute([lat, lng]);
                this.currentStreetName = null;
                const distance = closest ? closest.distance.toFixed(1) : 'unknown';
                this.updateStatus(`🚶‍♂️ Exploring off-road (${distance}m from nearest street)`);
            }
        } catch (error) {
            console.error('Error processing streets:', error);
            this.routeManager.addPointToRoute([lat, lng]);
            this.currentStreetName = null;
            this.updateStatus('⚠️ Street data error');
        } finally {
            // Clear the pending update if it's still the current one
            if (this.pendingStreetUpdate === currentTimestamp) {
                this.pendingStreetUpdate = null;
            }
        }
    }

    toggleKeyboardMode() {
        this.keyboardMode = !this.keyboardMode;
        const btn = document.getElementById('keyboard-mode');
        
        if (this.keyboardMode) {
            btn.textContent = 'Exit Keyboard Mode';
            btn.classList.add('active');
            this.mapManager.setKeyboardMode(true);
            this.updateStatus('Keyboard mode enabled! Use arrow keys or WASD to move.');
        } else {
            btn.textContent = 'Keyboard Mode';
            btn.classList.remove('active');
            this.mapManager.setKeyboardMode(false);
            this.updateStatus('Keyboard mode disabled.');
        }
    }

    handleKeyPress(event) {
        if (!this.keyboardMode || !this.isTracking) return;

        const [lat, lng] = this.locationManager.currentPosition;
        let newLat = lat;
        let newLng = lng;

        switch (event.key) {
            case 'ArrowUp':
            case 'w':
                newLat += this.moveSpeed;
                break;
            case 'ArrowDown':
            case 's':
                newLat -= this.moveSpeed;
                break;
            case 'ArrowLeft':
            case 'a':
                newLng -= this.moveSpeed;
                break;
            case 'ArrowRight':
            case 'd':
                newLng += this.moveSpeed;
                break;
            default:
                return;
        }

        // Update position immediately for smooth movement
        this.locationManager.currentPosition = [newLat, newLng];
        this.mapManager.updateUserMarker([newLat, newLng]);
        
        // Process street data asynchronously
        this.processLocationForStreets(newLat, newLng);
    }

    addXP(amount) {
        const currentXP = parseInt(localStorage.getItem('userXP') || '0');
        localStorage.setItem('userXP', currentXP + amount);
        this.updateXPDisplay();
    }

    updateXPDisplay() {
        const xpElement = document.getElementById('xp-display');
        const currentXP = parseInt(localStorage.getItem('userXP') || '0');
        xpElement.textContent = `XP: ${currentXP}`;
    }

    updateStatus(message) {
        const statusElement = document.getElementById('status');
        statusElement.textContent = message;
    }
}

// Initialize the app
new WanderlustApp();