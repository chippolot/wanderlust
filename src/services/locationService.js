// Location service - for future expansion
// We can move location-related logic here as the app grows

export class LocationService {
    constructor() {
        this.watchId = null;
        this.options = {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 1000
        };
    }

    // Future: Add more sophisticated location handling
    // - Background tracking
    // - Location caching
    // - Accuracy filtering
}