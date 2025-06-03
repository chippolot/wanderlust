export class LocationManager {
    constructor() {
        this.currentPosition = null;
        this.watchId = null;
        this.onPositionChange = null;
        this.permissionStatus = null;
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
            (error) => console.error('Location tracking error:', error),
            {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 1000
            }
        );
    }

    stopWatchingPosition() {
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
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
} 