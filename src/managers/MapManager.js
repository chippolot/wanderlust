import L from 'leaflet';

export class MapManager {
    constructor() {
        this.map = null;
        this.userMarker = null;
        this.routeLayer = null;
        this.currentRouteLayer = null;
        this.exploredSegmentsLayer = null;
        this.autoCenter = false;
        this.keyboardMode = false;
        this.currentTileLayer = null;
        this.mapStyles = {
            'CartoDB Voyager': {
                url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
                attribution: '© OpenStreetMap contributors, © CartoDB'
            },
            'CartoDB Positron': {
                url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
                attribution: '© OpenStreetMap contributors, © CartoDB'
            }
        };
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

        // Add default map style (CartoDB Voyager)
        this.setMapStyle('CartoDB Voyager');

        // Add zoom control
        L.control.zoom({
            position: 'bottomright'
        }).addTo(this.map);

        // Add map style control
        this.addMapStyleControl();
    }

    setMapStyle(styleName) {
        if (!this.map || !this.mapStyles[styleName]) return;

        // Remove current tile layer if it exists
        if (this.currentTileLayer) {
            this.map.removeLayer(this.currentTileLayer);
        }

        // Add new tile layer
        const style = this.mapStyles[styleName];
        this.currentTileLayer = L.tileLayer(style.url, {
            attribution: style.attribution,
            maxZoom: 19
        }).addTo(this.map);
    }

    addMapStyleControl() {
        const styleControl = L.control({ position: 'bottomright' });
        
        styleControl.onAdd = () => {
            const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control map-style-control');
            div.innerHTML = `
                <select id="map-style-select">
                    ${Object.keys(this.mapStyles).map(style => 
                        `<option value="${style}">${style}</option>`
                    ).join('')}
                </select>
            `;
            
            div.querySelector('select').addEventListener('change', (e) => {
                this.setMapStyle(e.target.value);
            });
            
            return div;
        };
        
        styleControl.addTo(this.map);
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
            if (this.autoCenter && !this.keyboardMode) {
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

    setKeyboardMode(enabled) {
        this.keyboardMode = enabled;
        if (enabled) {
            this.autoCenter = false;
        }
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