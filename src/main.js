import { StreetService } from './services/streetService.js';
import { AchievementService } from './services/achievementService.js';
import { RouteSuggestionService } from './services/routeSuggestionService.js';
import { MapManager } from './managers/MapManager.js';
import { RouteManager } from './managers/RouteManager.js';
import { LocationManager } from './managers/LocationManager.js';

class WanderlustApp {
    constructor() {
        this.mapManager = new MapManager();
        this.routeManager = new RouteManager(this.mapManager);
        this.locationManager = new LocationManager();
        this.streetService = new StreetService();
        this.achievementService = new AchievementService();
        this.routeSuggestionService = new RouteSuggestionService(this.streetService);
        this.isTracking = false;
        this.keyboardMode = false;
        this.moveSpeed = 0.0002; // ~22 meters per keypress
        this.nearbyStreets = [];
        this.lastSegmentId = null;
        this.currentStreetName = null;
        this.lastUpdateTimestamp = 0;
        this.pendingStreetUpdate = null;
        this.sessionXP = 0; // Track XP gained in current session
        this.explorationDays = this.getExplorationDays(); // Track exploration days
        this.currentSuggestedRoute = null; // Store current route suggestion

        this.init();
    }

    async init() {
        this.mapManager.initMap();
        this.setupEventListeners();
        this.routeManager.loadStoredRoutes();
        this.updateXPDisplay();
        
        // Initialize street service with map manager for drawing discovered segments
        await this.streetService.initializeDiscoveredSegments(this.mapManager);
        
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
            this.updateStatus('Ready to explore! Click "Start Exploring" to begin.');
        } else {
            this.updateStatus('Click "Start Exploring" to begin your journey!');
        }
    }

    setupEventListeners() {
        const startBtn = document.getElementById('start-tracking');
        const keyboardBtn = document.getElementById('keyboard-mode');
        const centerBtn = document.getElementById('center-map');
        const clearBtn = document.getElementById('clear-routes');
        const achievementsBtn = document.getElementById('achievements-btn');
        const closeAchievements = document.getElementById('close-achievements');
        const achievementsModal = document.getElementById('achievements-modal');
        
        // Route suggestion elements
        const routeSuggestionBtn = document.getElementById('route-suggestion-btn');
        const closeRouteSuggestion = document.getElementById('close-route-suggestion');
        const routeSuggestionModal = document.getElementById('route-suggestion-modal');
        const generateRouteBtn = document.getElementById('generate-route');
        const showRouteBtn = document.getElementById('show-route');
        const startSuggestedRouteBtn = document.getElementById('start-suggested-route');

        startBtn.addEventListener('click', () => this.toggleTracking());
        keyboardBtn.addEventListener('click', () => this.toggleKeyboardMode());
        centerBtn.addEventListener('click', () => {
            this.mapManager.setAutoCenter(true);
            this.mapManager.centerOnUser();
        });
        clearBtn.addEventListener('click', () => this.clearAllRoutes());
        achievementsBtn.addEventListener('click', () => this.showAchievements());
        closeAchievements.addEventListener('click', () => this.hideAchievements());
        
        // Route suggestion listeners
        routeSuggestionBtn.addEventListener('click', () => this.showRouteSuggestion());
        closeRouteSuggestion.addEventListener('click', () => this.hideRouteSuggestion());
        generateRouteBtn.addEventListener('click', () => this.generateRouteSuggestion());
        showRouteBtn.addEventListener('click', () => this.showSuggestedRouteOnMap());
        startSuggestedRouteBtn.addEventListener('click', () => this.startSuggestedRoute());
        
        // Close modals when clicking outside
        achievementsModal.addEventListener('click', (e) => {
            if (e.target === achievementsModal) {
                this.hideAchievements();
            }
        });
        
        routeSuggestionModal.addEventListener('click', (e) => {
            if (e.target === routeSuggestionModal) {
                this.hideRouteSuggestion();
            }
        });

        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
    }

    clearAllRoutes() {
        if (confirm('Clear all explored routes? This will also reset your street exploration progress, achievements, and cannot be undone.')) {
            // Clear routes and data
            this.routeManager.clearAllRoutes();
            
            // Clear map layers
            this.mapManager.clearAllRoutes();
            
            // Clear street exploration data
            this.streetService.clearExploredSegments();
            
            // Clear achievements
            this.achievementService.clearAchievements();
            
            // Clear exploration days
            localStorage.removeItem('wanderlust_exploration_days');
            this.explorationDays = [];
            
            // Reset XP display
            this.updateXPDisplay();
            
            // Reset street tracking
            this.lastSegmentId = null;
            this.currentStreetName = null;
            
            this.updateStatus('All data cleared. Start exploring again!');
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

    async startTracking() {
        if (!navigator.geolocation && !this.keyboardMode) return;

        this.isTracking = true;
        this.sessionXP = 0; // Reset session XP when starting
        this.recordExplorationDay(); // Record today as an exploration day
        this.routeManager.startNewRoute();

        // Set suggested route to tracking mode if it exists
        this.mapManager.setSuggestedRouteTrackingMode(true);

        if (this.locationManager.currentPosition) {
            this.routeManager.addPointToRoute(this.locationManager.currentPosition);
        }

        if (!this.keyboardMode) {
            this.locationManager.startWatchingPosition(
                (position) => this.handleLocationUpdate(position)
            );
            
            // Try to acquire wake lock to keep screen on
            const wakeLockAcquired = await this.locationManager.requestWakeLock();
            if (wakeLockAcquired) {
                this.updateStatus('🚶‍♂️ Exploring... Screen will stay on for better tracking.');
            } else {
                this.updateStatus('🚶‍♂️ Exploring... Keep the app visible for best tracking.');
            }
        } else {
            this.updateStatus('🚶‍♂️ Exploring... Keep moving to discover new areas!');
        }
    }

    async stopTracking() {
        this.isTracking = false;
        this.locationManager.stopWatchingPosition();
        this.mapManager.setAutoCenter(false);
        
        // Restore suggested route visibility if it exists
        this.mapManager.setSuggestedRouteTrackingMode(false);
        
        // Release wake lock when stopping
        await this.locationManager.releaseWakeLock();

        if (this.routeManager.currentRoute.length > 1) {
            this.routeManager.saveCurrentRoute();
            if (this.sessionXP > 0) {
                this.updateStatus(`Route saved! +${this.sessionXP} XP earned! 🎉`);
            } else {
                this.updateStatus('Route saved! No new streets discovered this time.');
            }
        } else {
            this.updateStatus('Exploration ended. Try moving around more to discover streets!');
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
                        this.sessionXP += xpGained; // Track session XP
                        this.routeManager.addDiscoveredSegment(closest.segment.id); // Track for route saving
                        this.updateStatus(`🎉 New street discovered! +${xpGained} XP (${closest.street.name})`);
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
        const hint = document.getElementById('keyboard-hint');
        
        if (this.keyboardMode) {
            btn.textContent = 'Exit Keyboard Mode';
            btn.classList.add('active');
            hint.classList.add('active');
            this.mapManager.setKeyboardMode(true);
            this.updateStatus('Keyboard mode enabled! Use arrow keys or WASD to move.');
        } else {
            btn.textContent = 'Keyboard Mode';
            btn.classList.remove('active');
            hint.classList.remove('active');
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
        const newXP = currentXP + amount;
        const oldLevel = this.calculateLevel(currentXP);
        const newLevel = this.calculateLevel(newXP);
        
        localStorage.setItem('userXP', newXP);
        this.updateXPDisplay();
        
        // Check for achievements after XP change
        this.checkAchievements();
        
        // Check for level up
        if (newLevel > oldLevel) {
            this.updateStatus(`🎉 Level up! You are now level ${newLevel}! (+${amount} XP)`);
        }
    }

    // Calculate level based on XP using a progressive system
    // Level 1: 0-499 XP, Level 2: 500-1499 XP, Level 3: 1500-3499 XP, etc.
    calculateLevel(xp) {
        if (xp < 500) return 1;
        
        // Each level requires significantly more XP than the previous level
        // Level 2: 500, Level 3: 1500, Level 4: 3500, Level 5: 6500, etc.
        let level = 1;
        let xpRequired = 0;
        let increment = 500;
        
        while (xp >= xpRequired + increment) {
            xpRequired += increment;
            level++;
            increment += 500; // Each level requires 500 more XP than the last increment
        }
        
        return level;
    }

    // Calculate XP required for next level
    calculateXPForNextLevel(currentXP) {
        const currentLevel = this.calculateLevel(currentXP);
        
        // Calculate XP required for next level
        let xpRequired = 0;
        let increment = 500;
        
        for (let i = 1; i < currentLevel + 1; i++) {
            if (i > 1) {
                xpRequired += increment;
                increment += 500;
            }
        }
        
        return xpRequired + increment;
    }

    updateXPDisplay() {
        const xpElement = document.getElementById('xp-display');
        const currentXP = parseInt(localStorage.getItem('userXP') || '0');
        const currentLevel = this.calculateLevel(currentXP);
        const nextLevelXP = this.calculateXPForNextLevel(currentXP);
        const xpNeeded = nextLevelXP - currentXP;
        
        xpElement.innerHTML = `
            <div class="level-info">
                <div class="level">Level ${currentLevel}</div>
                <div class="xp-details">${currentXP} XP (${xpNeeded} to next level)</div>
            </div>
        `;
    }

    updateStatus(message) {
        const statusElement = document.getElementById('status');
        statusElement.textContent = message;
    }

    // Get exploration days for achievements
    getExplorationDays() {
        const stored = localStorage.getItem('wanderlust_exploration_days');
        return stored ? JSON.parse(stored) : [];
    }

    // Record today as an exploration day
    recordExplorationDay() {
        const today = new Date().toDateString();
        const days = this.getExplorationDays();
        
        if (!days.includes(today)) {
            days.push(today);
            localStorage.setItem('wanderlust_exploration_days', JSON.stringify(days));
            this.explorationDays = days;
        }
    }

    // Calculate consecutive exploration days
    getConsecutiveDays() {
        const days = this.explorationDays.map(day => new Date(day)).sort((a, b) => b - a);
        if (days.length === 0) return 0;
        
        let consecutive = 1;
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        // Check if today or yesterday is in the list
        const latestDay = days[0];
        const isToday = latestDay.toDateString() === today.toDateString();
        const isYesterday = latestDay.toDateString() === yesterday.toDateString();
        
        if (!isToday && !isYesterday) return 0;
        
        // Count consecutive days
        for (let i = 1; i < days.length; i++) {
            const diff = Math.abs(days[i - 1] - days[i]) / (1000 * 60 * 60 * 24);
            if (diff <= 1) {
                consecutive++;
            } else {
                break;
            }
        }
        
        return consecutive;
    }

    // Check achievements and show notifications for new unlocks
    checkAchievements() {
        const stats = {
            segmentsExplored: this.streetService.exploredSegments.size,
            totalXP: parseInt(localStorage.getItem('userXP') || '0'),
            sessionXP: this.sessionXP,
            currentLevel: this.calculateLevel(parseInt(localStorage.getItem('userXP') || '0')),
            explorationDays: this.explorationDays.length,
            consecutiveDays: this.getConsecutiveDays()
        };

        const newUnlocks = this.achievementService.checkAchievements(stats);
        
        // Show notifications for new achievements
        newUnlocks.forEach((achievement, index) => {
            setTimeout(() => {
                this.showAchievementNotification(achievement);
                // Award achievement XP
                if (achievement.xpReward > 0) {
                    const currentXP = parseInt(localStorage.getItem('userXP') || '0');
                    localStorage.setItem('userXP', currentXP + achievement.xpReward);
                    this.updateXPDisplay();
                }
            }, index * 2000); // Stagger notifications
        });
    }

    // Show achievement notification
    showAchievementNotification(achievement) {
        const notification = document.createElement('div');
        notification.className = 'achievement-notification';
        notification.innerHTML = `
            <h3>${achievement.icon} ${achievement.name}</h3>
            <p>${achievement.description}</p>
            <p>+${achievement.xpReward} XP Bonus!</p>
        `;
        
        document.body.appendChild(notification);
        
        // Remove notification after 4 seconds
        setTimeout(() => {
            notification.remove();
        }, 4000);
    }

    // Show achievements modal
    showAchievements() {
        const modal = document.getElementById('achievements-modal');
        this.updateAchievementsModal();
        modal.classList.add('show');
    }

    // Hide achievements modal
    hideAchievements() {
        const modal = document.getElementById('achievements-modal');
        modal.classList.remove('show');
    }

    // Update achievements modal content
    updateAchievementsModal() {
        const stats = {
            segmentsExplored: this.streetService.exploredSegments.size,
            totalXP: parseInt(localStorage.getItem('userXP') || '0'),
            sessionXP: this.sessionXP,
            currentLevel: this.calculateLevel(parseInt(localStorage.getItem('userXP') || '0')),
            explorationDays: this.explorationDays.length,
            consecutiveDays: this.getConsecutiveDays()
        };

        // Update stats
        const achievementStats = this.achievementService.getAchievementStats();
        document.getElementById('achievements-unlocked').textContent = 
            `${achievementStats.unlocked}/${achievementStats.total}`;
        document.getElementById('achievements-percentage').textContent = 
            `${achievementStats.percentage}%`;

        // Update achievements grid
        const grid = document.getElementById('achievements-grid');
        grid.innerHTML = '';

        const achievements = this.achievementService.getAllAchievements();
        achievements.forEach(achievement => {
            const progress = this.achievementService.getProgress(achievement.id, stats);
            const isUnlocked = this.achievementService.unlockedAchievements.has(achievement.id);
            
            const card = document.createElement('div');
            card.className = `achievement-card ${isUnlocked ? 'unlocked' : ''}`;
            
            const progressPercent = Math.round(progress.progress * 100);
            const progressText = isUnlocked ? 
                'Completed!' : 
                `${progress.current}/${progress.target}`;
            
            card.innerHTML = `
                <div class="achievement-header">
                    <div class="achievement-icon">${achievement.icon}</div>
                    <div class="achievement-info">
                        <h3 class="achievement-name">${achievement.name}</h3>
                        <p class="achievement-description">${achievement.description}</p>
                    </div>
                </div>
                <div class="achievement-progress">
                    <div class="achievement-progress-bar">
                        <div class="achievement-progress-fill" style="width: ${progressPercent}%"></div>
                    </div>
                    <div class="achievement-progress-text">
                        <span>${progressText}</span>
                        <span>${progressPercent}%</span>
                    </div>
                </div>
                <div class="achievement-reward">+${achievement.xpReward} XP</div>
            `;
            
            grid.appendChild(card);
        });
    }

    // Route suggestion methods
    showRouteSuggestion() {
        if (!this.locationManager.currentPosition) {
            this.updateStatus('Need location access to suggest routes. Please start exploring first.');
            return;
        }
        
        const modal = document.getElementById('route-suggestion-modal');
        // Reset modal state
        document.getElementById('route-result').style.display = 'none';
        document.getElementById('route-error').style.display = 'none';
        modal.classList.add('show');
    }

    hideRouteSuggestion() {
        const modal = document.getElementById('route-suggestion-modal');
        modal.classList.remove('show');
        // Clear any highlighted segments when closing
        this.mapManager.clearUndiscoveredHighlights();
    }

    async generateRouteSuggestion() {
        const generateBtn = document.getElementById('generate-route');
        const resultDiv = document.getElementById('route-result');
        const errorDiv = document.getElementById('route-error');
        
        // Hide previous results
        resultDiv.style.display = 'none';
        errorDiv.style.display = 'none';
        
        // Show loading state
        generateBtn.textContent = 'Generating Route...';
        generateBtn.disabled = true;
        
        try {
            const targetDistance = parseFloat(document.getElementById('target-distance').value);
            const searchRadius = parseFloat(document.getElementById('search-radius').value);
            
            console.log(`🎯 Generating route: ${targetDistance}km within ${searchRadius}km`);
            
            const result = await this.routeSuggestionService.suggestRoute(
                this.locationManager.currentPosition,
                searchRadius,
                targetDistance
            );
            
            if (result.success) {
                this.currentSuggestedRoute = result;
                this.displayRouteResult(result);
                resultDiv.style.display = 'block';
                
                // Highlight the undiscovered segments
                this.mapManager.highlightUndiscoveredSegments(result.route.segments);
                
                this.updateStatus(`🗺️ Route suggested: ${result.stats.undiscoveredSegments} new segments, ~${result.stats.estimatedXP} XP`);
            } else {
                this.displayRouteError(result.error);
                errorDiv.style.display = 'block';
            }
            
        } catch (error) {
            console.error('Route generation error:', error);
            this.displayRouteError('Failed to generate route suggestion');
            errorDiv.style.display = 'block';
        } finally {
            generateBtn.textContent = 'Generate Route Suggestion';
            generateBtn.disabled = false;
        }
    }

    displayRouteResult(result) {
        const { stats } = result;
        
        document.getElementById('route-distance').textContent = `${stats.totalDistance.toFixed(1)} km`;
        document.getElementById('route-segments').textContent = stats.undiscoveredSegments;
        document.getElementById('route-xp').textContent = `~${stats.estimatedXP} XP`;
        document.getElementById('route-duration').textContent = `~${stats.estimatedDuration} min`;
    }

    displayRouteError(error) {
        document.getElementById('route-error-message').textContent = error;
    }

    showSuggestedRouteOnMap() {
        if (!this.currentSuggestedRoute) return;
        
        const route = this.currentSuggestedRoute.route;
        this.mapManager.drawSuggestedRoute(route.points, route.waypoints);
        this.hideRouteSuggestion();
        this.updateStatus('🗺️ Suggested route displayed with numbered waypoints. Click waypoints for instructions!');
    }

    startSuggestedRoute() {
        if (!this.currentSuggestedRoute) return;
        
        // Don't clear the suggested route - keep it visible with reduced opacity
        
        // Start tracking if not already
        if (!this.isTracking) {
            this.toggleTracking();
        }
        
        // Set tracking mode to reduce opacity
        this.mapManager.setSuggestedRouteTrackingMode(true);
        
        this.hideRouteSuggestion();
        this.updateStatus(`🚀 Following suggested route! Follow the numbered waypoints to discover ${this.currentSuggestedRoute.stats.undiscoveredSegments} new segments.`);
    }
}

// Initialize the app
new WanderlustApp();