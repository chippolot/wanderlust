export class RouteManager {
    constructor(mapManager) {
        this.mapManager = mapManager;
        this.currentRoute = [];
        this.storedRoutes = [];
        this.isTracking = false;
    }

    startNewRoute() {
        this.currentRoute = [];
        this.isTracking = true;
    }

    addPointToRoute(point) {
        if (!this.isTracking) return;

        this.currentRoute.push(point);
        // Draw current route with current style
        this.mapManager.drawRoute(this.currentRoute, 'current');
    }

    saveCurrentRoute() {
        if (this.currentRoute.length < 2) return;

        const routeData = {
            id: Date.now(),
            points: this.currentRoute,
            timestamp: new Date().toISOString()
        };

        this.storedRoutes.push(routeData);
        localStorage.setItem('wanderlust_routes', JSON.stringify(this.storedRoutes));

        // Draw the saved route with discovered style
        this.mapManager.drawRoute(routeData.points, 'discovered');
        this.currentRoute = [];
        this.isTracking = false;
    }

    loadStoredRoutes() {
        const stored = localStorage.getItem('wanderlust_routes');
        if (stored) {
            this.storedRoutes = JSON.parse(stored);
            // Draw all stored routes with discovered style
            this.storedRoutes.forEach(route => {
                this.mapManager.drawRoute(route.points, 'discovered');
            });
        }
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

    calculateXP() {
        // XP is now calculated by street segments, not distance
        // This method kept for compatibility with existing routes
        const distance = this.calculateDistance(this.currentRoute);
        return Math.round(distance / 50); // Reduced XP for distance-based calculation
    }

    clearAllRoutes() {
        // Clear current route
        this.currentRoute = [];
        
        // Clear stored routes
        localStorage.removeItem('wanderlust_routes');
        
        // Clear XP
        localStorage.removeItem('userXP');
        
        // Clear street exploration data
        localStorage.removeItem('explored_streets');
        
        return true; // Indicate success
    }
} 