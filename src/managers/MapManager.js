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
                        `<option value="${style}" ${style === 'CartoDB Voyager' ? 'selected' : ''}>${style}</option>`
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

    drawRoute(route, style = 'current') {
        if (!this.map || !route || route.length < 2) return;

        const routeStyle = this.routeStyles[style] || this.routeStyles.current;
        const polyline = L.polyline(route, routeStyle).addTo(this.map);

        if (style === 'current') {
            if (this.currentRouteLayer) {
                this.map.removeLayer(this.currentRouteLayer);
            }
            this.currentRouteLayer = polyline;
        }
    }

    clearCurrentRoute() {
        if (this.currentRouteLayer) {
            this.map.removeLayer(this.currentRouteLayer);
            this.currentRouteLayer = null;
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
        // Clear current route
        this.clearCurrentRoute();
        
        // Clear explored segments
        if (this.exploredSegmentsLayer) {
            this.map.removeLayer(this.exploredSegmentsLayer);
            this.exploredSegmentsLayer = null;
        }
        
        // Clear suggested route
        this.clearSuggestedRoute();
    }

    // Methods for route suggestions
    drawSuggestedRoute(routePoints, waypoints = null) {
        if (!this.map || !routePoints || routePoints.length < 2) return;

        // Clear any existing suggested route
        this.clearSuggestedRoute();

        const routeStyle = {
            color: '#e74c3c',
            weight: 4,
            opacity: 0.8,
            dashArray: '10, 5'
        };

        this.suggestedRouteLayer = L.polyline(routePoints, routeStyle).addTo(this.map);
        
        // Add numbered waypoints if provided
        if (waypoints && waypoints.length > 0) {
            this.drawWaypoints(waypoints);
        }
        
        // Fit map to show the entire suggested route
        this.map.fitBounds(this.suggestedRouteLayer.getBounds(), {
            padding: [20, 20]
        });
    }

    drawWaypoints(waypoints) {
        if (!this.map || !waypoints) return;

        // Clear existing waypoints
        this.clearWaypoints();

        this.waypointsLayer = L.layerGroup().addTo(this.map);

        waypoints.forEach((waypoint, index) => {
            const { position, instruction, type } = waypoint;
            
            // Different styling based on waypoint type
            let iconHtml, className;
            
            switch (type) {
                case 'start':
                    iconHtml = '🏁';
                    className = 'waypoint-start';
                    break;
                case 'return':
                    iconHtml = '🏁';
                    className = 'waypoint-end';
                    break;
                case 'turnaround':
                    iconHtml = '↩️';
                    className = 'waypoint-turnaround';
                    break;
                default:
                    iconHtml = `${index + 1}`;
                    className = 'waypoint-numbered';
            }

            const waypoint_marker = L.marker(position, {
                icon: L.divIcon({
                    className: `waypoint-marker ${className}`,
                    html: `<div class="waypoint-icon">${iconHtml}</div>`,
                    iconSize: [30, 30],
                    iconAnchor: [15, 15]
                })
            });

            // Add popup with instruction
            waypoint_marker.bindPopup(`<strong>Step ${index + 1}:</strong><br>${instruction}`, {
                offset: [0, -15]
            });

            waypoint_marker.addTo(this.waypointsLayer);
        });
    }

    clearWaypoints() {
        if (this.waypointsLayer) {
            this.map.removeLayer(this.waypointsLayer);
            this.waypointsLayer = null;
        }
    }

    clearSuggestedRoute() {
        if (this.suggestedRouteLayer) {
            this.map.removeLayer(this.suggestedRouteLayer);
            this.suggestedRouteLayer = null;
        }
        this.clearWaypoints();
    }

    // Reduce opacity of suggested route during tracking
    setSuggestedRouteTrackingMode(isTracking) {
        if (this.suggestedRouteLayer) {
            const opacity = isTracking ? 0.3 : 0.8;
            this.suggestedRouteLayer.setStyle({ opacity });
        }
        
        if (this.waypointsLayer && isTracking) {
            // Reduce waypoint visibility during tracking
            this.waypointsLayer.eachLayer(layer => {
                if (layer.getElement) {
                    const element = layer.getElement();
                    if (element) {
                        element.style.opacity = '0.5';
                    }
                }
            });
        } else if (this.waypointsLayer) {
            // Restore full visibility when not tracking
            this.waypointsLayer.eachLayer(layer => {
                if (layer.getElement) {
                    const element = layer.getElement();
                    if (element) {
                        element.style.opacity = '1';
                    }
                }
            });
        }
    }

    highlightUndiscoveredSegments(segments) {
        // Clear existing highlights
        this.clearUndiscoveredHighlights();

        if (!segments || segments.length === 0) return;

        this.undiscoveredHighlightsLayer = L.layerGroup().addTo(this.map);

        const highlightStyle = {
            color: '#f39c12',
            weight: 3,
            opacity: 0.9
        };

        segments.forEach(segment => {
            const segmentLine = L.polyline([segment.start, segment.end], highlightStyle);
            segmentLine.addTo(this.undiscoveredHighlightsLayer);
        });
    }

    clearUndiscoveredHighlights() {
        if (this.undiscoveredHighlightsLayer) {
            this.map.removeLayer(this.undiscoveredHighlightsLayer);
            this.undiscoveredHighlightsLayer = null;
        }
    }
} 