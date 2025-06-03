export class RouteManager {
    constructor(mapManager) {
        this.mapManager = mapManager;
        this.currentRoute = [];
        this.storedRoutes = [];
        this.isTracking = false;
        this.discoveredSegments = new Set(); // Track segments discovered in current session
    }

    startNewRoute() {
        this.currentRoute = [];
        this.discoveredSegments.clear(); // Reset discovered segments for new session
        this.isTracking = true;
    }

    addPointToRoute(point) {
        if (!this.isTracking) return;

        this.currentRoute.push(point);
        // Draw current route with current style
        this.mapManager.drawRoute(this.currentRoute, 'current');
    }

    // Add a segment to the current session's discovered segments
    addDiscoveredSegment(segmentId) {
        this.discoveredSegments.add(segmentId);
    }

    saveCurrentRoute() {
        if (this.currentRoute.length < 2) return;

        const routeData = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            segmentCount: this.discoveredSegments.size,
            // Don't save the actual route points anymore - we just care about discovered segments
            discoveredSegments: Array.from(this.discoveredSegments)
        };

        this.storedRoutes.push(routeData);
        localStorage.setItem('wanderlust_routes', JSON.stringify(this.storedRoutes));

        // Clear current route drawing since we don't want to show it anymore
        this.mapManager.clearCurrentRoute();
        
        this.currentRoute = [];
        this.discoveredSegments.clear();
        this.isTracking = false;
    }

    loadStoredRoutes() {
        const stored = localStorage.getItem('wanderlust_routes');
        if (stored) {
            this.storedRoutes = JSON.parse(stored);
            // We don't draw anything here anymore - discovered segments are handled by StreetService
            console.log(`Loaded ${this.storedRoutes.length} previous exploration sessions`);
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
        // XP is now calculated by discovered segments, not distance
        return this.discoveredSegments.size * 10; // 10 XP per segment
    }

    clearAllRoutes() {
        // Clear current route
        this.currentRoute = [];
        this.discoveredSegments.clear();
        
        // Clear stored routes
        this.storedRoutes = [];
        localStorage.removeItem('wanderlust_routes');
        
        // Clear XP
        localStorage.removeItem('userXP');
        
        // Clear street exploration data - use correct keys
        localStorage.removeItem('wanderlust_explored_segments');
        localStorage.removeItem('wanderlust_explored_segment_data');
        
        return true; // Indicate success
    }
} 