import L from 'leaflet';

export class MapManager {
    constructor() {
        this.map = null;
        this.userMarker = null;
        this.currentRouteLayer = null;
        this.routeLayers = [];
        this.exploredSegmentLayers = [];
        this.autoCenter = true;
    }

    initMap() {
        // Initialize map centered on a populated area (San Francisco downtown)
        this.map = L.map('map').setView([37.7749, -122.4194], 16);

        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(this.map);

        // Add zoom control
        L.control.zoom({
            position: 'bottomright'
        }).addTo(this.map);
    }

    createUserMarker(position) {
        if (this.userMarker) {
            this.map.removeLayer(this.userMarker);
        }

        this.userMarker = L.marker(position, {
            icon: L.divIcon({
                className: 'user-marker',
                html: '📍',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            })
        }).addTo(this.map);

        if (this.autoCenter) {
            this.centerOnUser();
        }
    }

    updateUserMarker(position) {
        if (this.userMarker) {
            this.userMarker.setLatLng(position);
            if (this.autoCenter) {
                this.centerOnUser();
            }
        } else {
            this.createUserMarker(position);
        }
    }

    centerOnUser() {
        if (this.userMarker) {
            this.map.setView(this.userMarker.getLatLng(), 16);
        }
    }

    setAutoCenter(enabled) {
        this.autoCenter = enabled;
    }

    drawCurrentRoute(route) {
        // Remove previous current route layer
        if (this.currentRouteLayer) {
            this.map.removeLayer(this.currentRouteLayer);
        }

        if (route.length > 1) {
            this.currentRouteLayer = L.polyline(route, {
                color: '#e74c3c',
                weight: 4,
                opacity: 0.8,
                dashArray: '5, 5'
            }).addTo(this.map);
        }
    }

    drawSavedRoute(routeData) {
        const routeLayer = L.polyline(routeData.points, {
            color: '#27ae60',
            weight: 3,
            opacity: 0.7
        }).addTo(this.map);

        this.routeLayers.push(routeLayer);
    }

    drawExploredSegment(segment) {
        const segmentLayer = L.polyline([segment.start, segment.end], {
            color: '#2ecc71',
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
        // Remove route layers from map
        this.routeLayers.forEach(layer => this.map.removeLayer(layer));
        this.routeLayers = [];

        // Remove explored segment layers
        this.exploredSegmentLayers.forEach(item => this.map.removeLayer(item.layer));
        this.exploredSegmentLayers = [];
    }
} 