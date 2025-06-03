// Street service for handling street data and segment tracking
export class StreetService {
    constructor() {
        this.exploredSegments = new Set(); // Track explored segment IDs
        this.exploredSegmentData = new Map(); // Store actual segment data with coordinates
        this.currentBBox = null; // Track current bounding box
        this.cachedStreets = null; // Single cache for current bbox
        this.SEARCH_RADIUS = 200; // Increased search radius to 200 meters
        this.BBOX_BUFFER = 0.7; // How far into the bbox (70%) before requesting new data
        this.loadExploredSegments();
    }

    // Initialize and draw all previously discovered segments
    async initializeDiscoveredSegments(mapManager) {
        this.mapManager = mapManager;
        
        // Draw all stored discovered segments
        for (const [segmentId, segmentData] of this.exploredSegmentData) {
            this.mapManager.drawExploredSegment(segmentData);
        }
        
        console.log(`Drew ${this.exploredSegmentData.size} previously discovered segments`);
    }

    // Get nearby streets using Overpass API
    async getNearbyStreets(lat, lng, radiusMeters = null) {
        // Use class-level search radius if none provided
        radiusMeters = radiusMeters || this.SEARCH_RADIUS;

        // Check if point is within current bounding box (with buffer)
        if (this.isWithinBufferedBBox(lat, lng) && this.cachedStreets) {
            console.log('Using cached street data from current bbox');
            // Update exploration status of cached segments
            this.updateCachedSegmentsExplorationStatus();
            return this.cachedStreets;
        }

        console.log('Outside current bbox, fetching new street data for', lat, lng);

        try {
            // Create bounding box around point
            const latDelta = radiusMeters / 111000; // ~111km per degree latitude
            const lngDelta = radiusMeters / (111000 * Math.cos(lat * Math.PI / 180));

            const bbox = [
                lat - latDelta,  // south
                lng - lngDelta,  // west  
                lat + latDelta,  // north
                lng + lngDelta   // east
            ];

            // Store new bounding box
            this.currentBBox = bbox;

            const query = `
        [out:json][timeout:10];
        (
          way["highway"~"^(residential|tertiary|secondary|primary|trunk|unclassified|living_street)$"](${bbox.join(',')});
        );
        out geom;
      `;

            const response = await fetch('https://overpass-api.de/api/interpreter', {
                method: 'POST',
                body: query,
                headers: { 'Content-Type': 'text/plain' }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            const streets = this.processStreetData(data.elements || []);
            console.log('Fetched and processed new streets:', streets.length);

            // Update the cache with new data
            this.cachedStreets = streets;

            return streets;

        } catch (error) {
            console.warn('Failed to fetch street data:', error);
            // Return existing cache if available, otherwise empty array
            return this.cachedStreets || [];
        }
    }

    // Update cached segments with current exploration status
    updateCachedSegmentsExplorationStatus() {
        if (!this.cachedStreets) return;
        
        for (const street of this.cachedStreets) {
            for (const segment of street.segments) {
                segment.explored = this.exploredSegments.has(segment.id);
            }
        }
    }

    // Check if a point is within the current bounding box, accounting for buffer
    isWithinBufferedBBox(lat, lng) {
        if (!this.currentBBox) return false;

        const [south, west, north, east] = this.currentBBox;

        // Calculate the buffer size (as a portion of the total box size)
        const latBuffer = (north - south) * (1 - this.BBOX_BUFFER) / 2;
        const lngBuffer = (east - west) * (1 - this.BBOX_BUFFER) / 2;

        // Check if point is within the buffered box
        return lat >= (south + latBuffer) &&
            lat <= (north - latBuffer) &&
            lng >= (west + lngBuffer) &&
            lng <= (east - lngBuffer);
    }

    // Calculate haversine distance between two points in meters
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

    // Process raw Overpass data into usable street segments
    processStreetData(elements) {
        const streets = [];

        for (const element of elements) {
            if (element.type === 'way' && element.geometry) {
                const street = {
                    id: element.id,
                    name: element.tags?.name || 'Unnamed Road',
                    highway: element.tags.highway,
                    coordinates: element.geometry.map(point => [point.lat, point.lon]),
                    segments: []
                };

                // Create segments between consecutive points
                for (let i = 0; i < street.coordinates.length - 1; i++) {
                    const segmentId = `${element.id}-${i}`;
                    street.segments.push({
                        id: segmentId,
                        start: street.coordinates[i],
                        end: street.coordinates[i + 1],
                        explored: this.exploredSegments.has(segmentId)
                    });
                }

                streets.push(street);
            }
        }

        return streets;
    }

    // Find closest street segment to a GPS point
    findClosestSegment(lat, lng, streets, currentSegmentId = null) {
        let closest = null;
        let minDistance = Infinity;
        const CURRENT_SEGMENT_BIAS = 5; // 5 meter bias for current segment

        for (const street of streets) {
            for (const segment of street.segments) {
                let distance = this.distanceToSegment([lat, lng], segment.start, segment.end);

                // Apply bias if this is the current segment
                if (currentSegmentId && segment.id === currentSegmentId) {
                    distance -= CURRENT_SEGMENT_BIAS;
                }

                if (distance < minDistance) {
                    minDistance = distance;
                    closest = {
                        segment,
                        street,
                        distance: distance + (currentSegmentId && segment.id === currentSegmentId ? CURRENT_SEGMENT_BIAS : 0), // Return actual distance
                        snapPoint: this.snapToSegment([lat, lng], segment.start, segment.end)
                    };
                }
            }
        }

        return closest;
    }

    // Calculate distance from point to line segment
    distanceToSegment(point, segStart, segEnd) {
        const [px, py] = point;
        const [ax, ay] = segStart;
        const [bx, by] = segEnd;

        const A = px - ax;
        const B = py - ay;
        const C = bx - ax;
        const D = by - ay;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;

        if (lenSq === 0) return Math.sqrt(A * A + B * B);

        let t = Math.max(0, Math.min(1, dot / lenSq));

        const projection = [ax + t * C, ay + t * D];
        const dx = px - projection[0];
        const dy = py - projection[1];

        return Math.sqrt(dx * dx + dy * dy) * 111000; // Convert to meters
    }

    // Snap point to nearest position on line segment
    snapToSegment(point, segStart, segEnd) {
        const [px, py] = point;
        const [ax, ay] = segStart;
        const [bx, by] = segEnd;

        const A = px - ax;
        const B = py - ay;
        const C = bx - ax;
        const D = by - ay;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;

        if (lenSq === 0) return [ax, ay];

        let t = Math.max(0, Math.min(1, dot / lenSq));

        return [ax + t * C, ay + t * D];
    }

    // Mark a segment as explored and return XP if it's new
    exploreSegment(segmentId) {
        if (this.exploredSegments.has(segmentId)) {
            return 0; // No XP for already explored segments
        }

        // Find the segment in current data to store its coordinates
        let segmentData = null;
        if (this.cachedStreets) {
            for (const street of this.cachedStreets) {
                for (const segment of street.segments) {
                    if (segment.id === segmentId) {
                        segmentData = {
                            id: segmentId,
                            start: segment.start,
                            end: segment.end,
                            streetName: street.name
                        };
                        break;
                    }
                }
                if (segmentData) break;
            }
        }

        this.exploredSegments.add(segmentId);
        if (segmentData) {
            this.exploredSegmentData.set(segmentId, segmentData);
        }
        this.saveExploredSegments();

        // Award XP based on segment length - 0.2 XP per meter (was 1 XP per meter)
        const segmentLength = segmentData ? this.calculateSegmentLength(segmentData) : 50; // Default 50m if no data
        return Math.round(segmentLength * 0.2);
    }

    // Calculate the length of a segment in meters
    calculateSegmentLength(segmentData) {
        return this.haversineDistance(segmentData.start, segmentData.end);
    }

    // Check if a segment has been explored
    isSegmentExplored(segmentId) {
        return this.exploredSegments.has(segmentId);
    }

    // Save explored segments to localStorage
    saveExploredSegments() {
        const segmentsArray = Array.from(this.exploredSegments);
        const segmentDataArray = Array.from(this.exploredSegmentData.entries());
        
        localStorage.setItem('wanderlust_explored_segments', JSON.stringify(segmentsArray));
        localStorage.setItem('wanderlust_explored_segment_data', JSON.stringify(segmentDataArray));
    }

    // Load explored segments from localStorage
    loadExploredSegments() {
        try {
            const stored = localStorage.getItem('wanderlust_explored_segments');
            const storedData = localStorage.getItem('wanderlust_explored_segment_data');
            
            if (stored) {
                const segmentsArray = JSON.parse(stored);
                this.exploredSegments = new Set(segmentsArray);
            }
            
            if (storedData) {
                const segmentDataArray = JSON.parse(storedData);
                this.exploredSegmentData = new Map(segmentDataArray);
            }
        } catch (error) {
            console.warn('Failed to load explored segments:', error);
            this.exploredSegments = new Set();
            this.exploredSegmentData = new Map();
        }
    }

    // Clear all explored segments
    clearExploredSegments() {
        this.exploredSegments.clear();
        this.exploredSegmentData.clear();
        localStorage.removeItem('wanderlust_explored_segments');
        localStorage.removeItem('wanderlust_explored_segment_data');
        // Clear the street cache to force a refresh
        this.cachedStreets = null;
        this.currentBBox = null;
    }

    // Get exploration statistics
    getExplorationStats() {
        return {
            segmentsExplored: this.exploredSegments.size
        };
    }
}