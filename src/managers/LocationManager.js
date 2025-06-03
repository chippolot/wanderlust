export class LocationManager {
    constructor() {
        this.currentPosition = null;
        this.watchId = null;
        this.onPositionChange = null;
        this.permissionStatus = null;
        this.wakeLock = null;
        this.isVisible = true;
        this.setupVisibilityHandling();
    }

    setupVisibilityHandling() {
        // Listen for page visibility changes
        document.addEventListener('visibilitychange', () => {
            this.isVisible = !document.hidden;
            console.log('Page visibility changed:', this.isVisible ? 'visible' : 'hidden');
            
            if (this.isVisible && this.watchId) {
                // Page became visible again, restart location watching
                console.log('Restarting location tracking after visibility change');
                this.restartLocationWatch();
            }
        });
    }

    async requestWakeLock() {
        if ('wakeLock' in navigator) {
            try {
                this.wakeLock = await navigator.wakeLock.request('screen');
                console.log('Screen wake lock acquired');
                
                this.wakeLock.addEventListener('release', () => {
                    console.log('Screen wake lock released');
                });
                
                return true;
            } catch (err) {
                console.log('Wake lock request failed:', err);
                return false;
            }
        }
        return false;
    }

    async releaseWakeLock() {
        if (this.wakeLock) {
            await this.wakeLock.release();
            this.wakeLock = null;
            console.log('Wake lock manually released');
        }
    }

    restartLocationWatch() {
        if (this.watchId) {
            // Clear existing watch
            navigator.geolocation.clearWatch(this.watchId);
            
            // Restart with same callback
            if (this.currentCallback) {
                this.startWatchingPosition(this.currentCallback);
            }
        }
    }

    async checkPermissionStatus() {
        if (!navigator.permissions || !navigator.permissions.query) {
            // If permissions API is not available, try to get position
            try {
                await this.getCurrentPosition();
                return 'granted';
            } catch (error) {
                return 'denied';
            }
        }

        try {
            const result = await navigator.permissions.query({ name: 'geolocation' });
            this.permissionStatus = result.state;
            result.addEventListener('change', () => {
                this.permissionStatus = result.state;
            });
            return result.state;
        } catch (error) {
            console.error('Error checking permission status:', error);
            return 'denied';
        }
    }

    setPositionChangeCallback(callback) {
        this.onPositionChange = callback;
    }

    async getInitialLocation() {
        if (!navigator.geolocation) {
            return null;
        }

        try {
            const position = await this.getCurrentPosition();
            const newPos = this.processPosition(position);
            if (newPos && this.onPositionChange) {
                this.onPositionChange(newPos, true); // true indicates this is initial position
            }
            return newPos;
        } catch (error) {
            console.log('Location permission denied or failed');
            return null;
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

    startWatchingPosition(callback) {
        if (!navigator.geolocation) return;

        // Store callback for restart functionality
        this.currentCallback = callback;

        this.watchId = navigator.geolocation.watchPosition(
            (position) => {
                const newPos = this.processPosition(position);
                if (newPos) {
                    callback(newPos);
                    if (this.onPositionChange) {
                        this.onPositionChange(newPos, false);
                    }
                }
            },
            (error) => {
                console.error('Location tracking error:', error);
                // Try to restart on error
                setTimeout(() => {
                    if (this.watchId && this.isVisible) {
                        console.log('Attempting to restart location tracking after error');
                        this.restartLocationWatch();
                    }
                }, 5000);
            },
            {
                enableHighAccuracy: true,
                timeout: 30000, // Increased timeout for better reliability
                maximumAge: 5000 // More frequent updates
            }
        );
    }

    stopWatchingPosition() {
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
            this.currentCallback = null;
        }
    }

    processPosition(position) {
        let newPos;

        // Handle both geolocation API format and direct coordinates
        if (position.coords) {
            const { latitude: lat, longitude: lng } = position.coords;
            newPos = [lat, lng];
        } else if (Array.isArray(position)) {
            newPos = position;
        } else {
            console.error('Invalid position format:', position);
            return null;
        }

        this.currentPosition = newPos;
        return newPos;
    }

    setDefaultPosition() {
        this.currentPosition = [37.7749, -122.4194]; // San Francisco default
        if (this.onPositionChange) {
            this.onPositionChange(this.currentPosition, true);
        }
    }
} 