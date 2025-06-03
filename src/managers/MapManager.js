import L from 'leaflet';

export class MapManager {
    constructor() {
        this.map = null;
        this.userMarker = null;
        this.routeLayer = null;
        this.currentRouteLayer = null;
        this.exploredSegmentsLayer = null;
        this.autoCenter = false;
        this.routeStyles = {
            discovered: {
                color: '#2196F3',
                weight: 3,
                opacity: 0.4,
                dashArray: '5, 5'
            },
            current: {
                color: '#2196F3',
                weight: 4,
                opacity: 0.7,
                dashArray: '10, 10'
            },
            new: {
                color: '#FF5722',
                weight: 5,
                opacity: 1.0
            }
        };
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

    drawRoute(route, style = 'discovered') {
        if (!this.map || !route || route.length < 2) return;

        const routeStyle = this.routeStyles[style] || this.routeStyles.discovered;
        const polyline = L.polyline(route, routeStyle).addTo(this.map);

        if (style === 'current') {
            if (this.currentRouteLayer) {
                this.map.removeLayer(this.currentRouteLayer);
            }
            this.currentRouteLayer = polyline;
        } else {
            if (!this.routeLayer) {
                this.routeLayer = L.layerGroup().addTo(this.map);
            }
            polyline.addTo(this.routeLayer);
        }
    }

    drawExploredSegment(segment) {
        if (!this.map) return;

        const segmentLine = L.polyline([segment.start, segment.end], this.routeStyles.new).addTo(this.map);
        
        if (!this.exploredSegmentsLayer) {
            this.exploredSegmentsLayer = L.layerGroup().addTo(this.map);
        }
        segmentLine.addTo(this.exploredSegmentsLayer);
    }

    clearAllRoutes() {
        if (this.routeLayer) {
            this.map.removeLayer(this.routeLayer);
            this.routeLayer = null;
        }
        if (this.currentRouteLayer) {
            this.map.removeLayer(this.currentRouteLayer);
            this.currentRouteLayer = null;
        }
        if (this.exploredSegmentsLayer) {
            this.map.removeLayer(this.exploredSegmentsLayer);
            this.exploredSegmentsLayer = null;
        }
    }
} 