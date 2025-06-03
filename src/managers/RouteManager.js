export class RouteManager {
    constructor() {
        this.currentRoute = [];
    }

    startNewRoute() {
        this.currentRoute = [];
    }

    addPointToRoute(position) {
        this.currentRoute.push(position);
    }

    saveCurrentRoute() {
        const routes = this.getStoredRoutes();
        const routeData = {
            id: Date.now(),
            points: this.currentRoute,
            timestamp: new Date().toISOString(),
            distance: this.calculateDistance(this.currentRoute)
        };

        routes.push(routeData);
        localStorage.setItem('wanderlust_routes', JSON.stringify(routes));

        return routeData;
    }

    loadStoredRoutes() {
        return this.getStoredRoutes();
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