import L from 'leaflet';
import './services/locationService.js';
import './services/routeService.js';
import './services/xpService.js';
import { StreetService } from './services/streetService.js';

class WanderlustApp {
    constructor() {
        this.map = null;
        this.currentPosition = null;
        this.isTracking = false;
        this.watchId = null;
        this.currentRoute = [];
        this.userMarker = null;
        this.routeLayers = [];
        this.exploredSegmentLayers = []; // New: track explored street segments visually
        this.keyboardMode = false;
        this.moveSpeed = 0.0002; // ~22 meters per keypress
        this.streetService = new StreetService();
        this.nearbyStreets = [];
        this.lastSegmentId = null;

        this.init();
    }

    async init() {
        this.initMap();
        this.setupEventListeners();
        this.loadStoredRoutes();
        this.updateXPDisplay();
        // Don't auto-request location - wait for user interaction
        this.updateStatus('Click "Start Exploring" to grant location access and begin!');
    }

    initMap() {
        // Initialize map centered on a populated area (San Francisco downtown)
        this.map = L.map('map').setView([37.7749, -122.4194], 16);

        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(this.map);

        this.updateStatus('Map initialized. Waiting for location...');
    }

    setupEventListeners() {
        const startBtn = document.getElementById('start-tracking');
        const keyboardBtn = document.getElementById('keyboard-mode');
        const centerBtn = document.getElementById('center-map');
        const clearBtn = document.getElementById('clear-routes');

        startBtn.addEventListener('click', () => this.toggleTracking());
        keyboardBtn.addEventListener('click', () => this.toggleKeyboardMode());
        centerBtn.addEventListener('click', () => this.centerOnUser());
        clearBtn.addEventListener('click', () => this.clearAllRoutes());

        // Keyboard event listeners
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
    }

    async requestLocationPermission() {
        if (!navigator.geolocation) {
            this.updateStatus('Geolocation not supported by this browser.');
            return;
        }

        try {
            const position = await this.getCurrentPosition();
            this.handleLocationUpdate(position);
            this.updateStatus('Location found! Ready to start exploring.');
        } catch (error) {
            this.updateStatus('Please enable location access to start exploring.');
            console.error('Location error:', error);
        }
    }

    getCurrentPosition() {
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000
            });
        });
    }

    handleLocationUpdate(position) {
        let newPos;

        // Handle both geolocation API format and direct coordinates
        if (position.coords) {
            const { latitude: lat, longitude: lng } = position.coords;
            newPos = [lat, lng];
        } else if (Array.isArray(position)) {
            newPos = position;
        } else {
            console.error('Invalid position format:', position);
            return;
        }

        const [lat, lng] = newPos;

        // Update current position
        this.currentPosition = newPos;

        // Update or create user marker
        if (this.userMarker) {
            this.userMarker.setLatLng(newPos);
        } else {
            this.userMarker = L.marker(newPos, {
                icon: L.divIcon({
                    className: 'user-marker',
                    html: '📍',
                    iconSize: [20, 20],
                    iconAnchor: [10, 10]
                })
            }).addTo(this.map);

            // Center map on first location
            this.map.setView(newPos, 16);
        }

        // If tracking, process this point for street snapping
        if (this.isTracking) {
            this.processLocationForStreets(lat, lng);
        }
    }

    async toggleTracking() {
        const btn = document.getElementById('start-tracking');

        if (!this.isTracking) {
            // Request location permission first if we don't have it
            if (!this.currentPosition) {
                if (this.keyboardMode) {
                    // In keyboard mode, use the default SF location
                    this.currentPosition = [37.7749, -122.4194];
                    this.createUserMarker();
                    this.map.setView(this.currentPosition, 16);
                    this.updateStatus('Keyboard mode: Ready to explore from San Francisco!');
                } else {
                    try {
                        const position = await this.getCurrentPosition();
                        this.handleLocationUpdate(position);
                        this.updateStatus('Location found! Starting to track your route...');
                    } catch (error) {
                        this.updateStatus('Please enable location access to start exploring.');
                        console.error('Location error:', error);
                        return;
                    }
                }
            }

            // Auto-center the map when starting exploration
            this.map.setView(this.currentPosition, 16);

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
        this.currentRoute = [];

        // Add current position to route if available
        if (this.currentPosition) {
            this.currentRoute.push(this.currentPosition);
        }

        if (!this.keyboardMode) {
            // Start watching position
            this.watchId = navigator.geolocation.watchPosition(
                (position) => this.handleLocationUpdate(position),
                (error) => console.error('Location tracking error:', error),
                {
                    enableHighAccuracy: true,
                    timeout: 5000,
                    maximumAge: 1000
                }
            );
        }

        this.updateStatus('🚶‍♂️ Exploring... Keep moving to discover new areas!');
    }

    stopTracking() {
        this.isTracking = false;

        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }

        // Save the current route if it has points
        if (this.currentRoute.length > 1) {
            this.saveRoute(this.currentRoute);
            const xpGained = this.calculateXP(this.currentRoute);
            this.addXP(xpGained);
            this.updateStatus(`Route saved! +${xpGained} XP earned! 🎉`);
        }

        this.currentRoute = [];
    }

    // Process location update for street tracking
    async processLocationForStreets(lat, lng) {
        console.log(`🗺️ Processing location: ${lat}, ${lng}`);

        try {
            // Get nearby streets (with caching)
            this.updateStatus('🔄 Finding nearby streets...');
            this.nearbyStreets = await this.streetService.getNearbyStreets(lat, lng);

            console.log(`📍 Found ${this.nearbyStreets.length} nearby streets`);

            if (this.nearbyStreets.length === 0) {
                // No streets nearby, use raw GPS point
                this.addPointToRoute([lat, lng]);
                this.updateStatus('🚶‍♂️ Exploring... (No streets found nearby)');
                return;
            }

            // Find closest street segment
            const closest = this.streetService.findClosestSegment(lat, lng, this.nearbyStreets);

            console.log('🎯 Closest segment:', closest);

            if (closest && closest.distance < 50) { // Within 50 meters of a street
                const snappedPoint = closest.snapPoint;

                console.log(`🛣️ Snapping to ${closest.street.name}, distance: ${closest.distance.toFixed(1)}m`);

                // Check if this is a new segment
                if (closest.segment.id !== this.lastSegmentId) {
                    const xpGained = this.streetService.exploreSegment(closest.segment.id);

                    if (xpGained > 0) {
                        // Draw the explored street segment
                        this.drawExploredSegment(closest.segment);
                        this.addXP(xpGained);
                        this.updateStatus(`🎉 New street discovered! +${xpGained} XP (${closest.street.name})`);
                    } else {
                        this.updateStatus(`🚶‍♂️ Walking on ${closest.street.name} (already explored)`);
                    }

                    this.lastSegmentId = closest.segment.id;
                }

                // Add SNAPPED point to route (this makes the line follow streets)
                this.addPointToRoute(snappedPoint);

            } else {
                // Too far from any street, use GPS point
                const distance = closest ? closest.distance.toFixed(1) : 'unknown';
                this.addPointToRoute([lat, lng]);
                this.updateStatus(`🚶‍♂️ Exploring... (${distance}m from nearest street)`);
            }

        } catch (error) {
            console.error('❌ Street processing error:', error);
            this.updateStatus('⚠️ Street data error, using GPS point');
            // Fallback to GPS point
            this.addPointToRoute([lat, lng]);
        }
    }

    addPointToRoute(position) {
        this.currentRoute.push(position);

        // Draw the current route being tracked
        this.drawCurrentRoute();
    }

    drawCurrentRoute() {
        // Remove previous current route layer
        if (this.currentRouteLayer) {
            this.map.removeLayer(this.currentRouteLayer);
        }

        if (this.currentRoute.length > 1) {
            this.currentRouteLayer = L.polyline(this.currentRoute, {
                color: '#e74c3c',
                weight: 4,
                opacity: 0.8,
                dashArray: '5, 5'
            }).addTo(this.map);
        }
    }

    saveRoute(route) {
        const routes = this.getStoredRoutes();
        const routeData = {
            id: Date.now(),
            points: route,
            timestamp: new Date().toISOString(),
            distance: this.calculateDistance(route)
        };

        routes.push(routeData);
        localStorage.setItem('wanderlust_routes', JSON.stringify(routes));

        // Draw the permanent route
        this.drawSavedRoute(routeData);
    }

    drawSavedRoute(routeData) {
        const routeLayer = L.polyline(routeData.points, {
            color: '#27ae60',
            weight: 3,
            opacity: 0.7
        }).addTo(this.map);

        this.routeLayers.push(routeLayer);
    }

    loadStoredRoutes() {
        const routes = this.getStoredRoutes();
        routes.forEach(route => this.drawSavedRoute(route));
    }

    getStoredRoutes() {
        return JSON.parse(localStorage.getItem('wanderlust_routes') || '[]');
    }

    calculateDistance(route) {
        let distance = 0;
        for (let i = 1; i < route.length; i++) {
            distance += this.haversineDistance(route[i - 1], route[i]);
        }
        return distance;
    }

    haversineDistance([lat1, lon1], [lat2, lon2]) {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }

    calculateXP(route) {
        // XP is now calculated by street segments, not distance
        // This method kept for compatibility with existing routes
        const distance = this.calculateDistance(route);
        return Math.round(distance / 50); // Reduced XP for distance-based calculation
    }

    addXP(amount) {
        const currentXP = parseInt(localStorage.getItem('wanderlust_xp') || '0');
        const newXP = currentXP + amount;
        localStorage.setItem('wanderlust_xp', newXP.toString());
        this.updateXPDisplay();
    }

    updateXPDisplay() {
        const xp = localStorage.getItem('wanderlust_xp') || '0';
        const xpElement = document.getElementById('xp-display');
        if (xpElement) {
            xpElement.textContent = `${xp} XP`;
        }

        // Update segments display
        const segmentsElement = document.getElementById('segments-display');
        if (segmentsElement) {
            const stats = this.streetService.getExplorationStats();
            segmentsElement.textContent = `${stats.segmentsExplored} streets`;
        }
    }

    async centerOnUser() {
        if (this.currentPosition) {
            this.map.setView(this.currentPosition, 16);
        } else {
            // Try to get location if we don't have it
            try {
                const position = await this.getCurrentPosition();
                this.handleLocationUpdate(position);
                this.map.setView(this.currentPosition, 16);
                this.updateStatus('Location found and centered!');
            } catch (error) {
                this.updateStatus('Please enable location access to center the map.');
                console.error('Location error:', error);
            }
        }
    }

    // Draw an explored street segment
    drawExploredSegment(segment) {
        const segmentLayer = L.polyline([segment.start, segment.end], {
            color: '#2ecc71', // Green for explored streets
            weight: 6,
            opacity: 0.8,
            className: 'explored-segment'
        }).addTo(this.map);

        this.exploredSegmentLayers.push({
            layer: segmentLayer,
            segmentId: segment.id
        });
    }

    clearAllRoutes() {
        if (confirm('Clear all explored routes? This will also reset your street exploration progress and cannot be undone.')) {
            // Remove route layers from map
            this.routeLayers.forEach(layer => this.map.removeLayer(layer));
            this.routeLayers = [];

            // Remove explored segment layers
            this.exploredSegmentLayers.forEach(item => this.map.removeLayer(item.layer));
            this.exploredSegmentLayers = [];

            // Clear stored data
            localStorage.removeItem('wanderlust_routes');
            localStorage.removeItem('wanderlust_xp');

            // Clear street exploration data
            this.streetService.clearExploredSegments();

            this.updateXPDisplay();
            this.updateStatus('All routes and street progress cleared. Start exploring again!');
        }
    }

    updateStatus(message) {
        document.getElementById('status').textContent = message;
    }

    // Keyboard movement mode for testing
    toggleKeyboardMode() {
        const btn = document.getElementById('keyboard-mode');
        const hint = document.getElementById('keyboard-hint');

        this.keyboardMode = !this.keyboardMode;

        if (this.keyboardMode) {
            btn.textContent = '🎮 Exit Keyboard';
            btn.classList.add('keyboard-active');
            hint.classList.add('active');

            // Set initial position if none exists
            if (!this.currentPosition) {
                this.currentPosition = [37.7749, -122.4194]; // SF default
                this.createUserMarker();
                this.map.setView(this.currentPosition, 16);
            }

            this.updateStatus('🎮 Keyboard mode active! Use WASD or arrow keys to move around.');
        } else {
            btn.textContent = '🎮 Keyboard Mode';
            btn.classList.remove('keyboard-active');
            hint.classList.remove('active');
            this.updateStatus('Keyboard mode disabled.');
        }
    }

    handleKeyPress(event) {
        // Always log this first to test if events are working
        console.log('🎹 Key event detected:', event.code);

        if (!this.keyboardMode || !this.currentPosition) {
            console.log('❌ Keyboard mode:', this.keyboardMode, 'Position:', this.currentPosition);
            return;
        }

        console.log('✅ Key pressed:', event.code, 'Tracking:', this.isTracking);

        // Prevent default behavior for movement keys
        const movementKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'];
        if (movementKeys.includes(event.code)) {
            event.preventDefault();
        }

        let [lat, lng] = this.currentPosition;
        let moved = false;

        // Handle movement keys
        switch (event.code) {
            case 'KeyW':
            case 'ArrowUp':
                lat += this.moveSpeed; // Move north
                moved = true;
                break;
            case 'KeyS':
            case 'ArrowDown':
                lat -= this.moveSpeed; // Move south
                moved = true;
                break;
            case 'KeyA':
            case 'ArrowLeft':
                lng -= this.moveSpeed; // Move west
                moved = true;
                break;
            case 'KeyD':
            case 'ArrowRight':
                lng += this.moveSpeed; // Move east
                moved = true;
                break;
        }

        if (moved) {
            console.log('🚶 Moving to:', lat, lng);
            this.currentPosition = [lat, lng];
            this.updateUserPosition();

            // Add to route if tracking (with street processing)
            if (this.isTracking) {
                console.log('🛤️ Tracking is active, calling processLocationForStreets');
                this.processLocationForStreets(lat, lng);
            } else {
                console.log('⏸️ Not tracking, skipping street processing');
            }
        }
    }

    createUserMarker() {
        if (this.userMarker) {
            this.map.removeLayer(this.userMarker);
        }

        this.userMarker = L.marker(this.currentPosition, {
            icon: L.divIcon({
                className: 'user-marker',
                html: '📍',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            })
        }).addTo(this.map);
    }

    updateUserPosition() {
        if (this.userMarker) {
            this.userMarker.setLatLng(this.currentPosition);
        } else {
            this.createUserMarker();
        }

        // Center map on user (optional - you can remove this if you don't want auto-centering)
        // this.map.setView(this.currentPosition, this.map.getZoom());
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new WanderlustApp();
});