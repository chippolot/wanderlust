// Street service for handling street data and segment tracking
export class StreetService {
    constructor() {
        this.streetCache = new Map(); // Cache for street data by bounding box
        this.exploredSegments = new Set(); // Track explored segments
        this.loadExploredSegments();
    }

    // Get nearby streets using Overpass API
    async getNearbyStreets(lat, lng, radiusMeters = 100) {
        const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;

        if (this.streetCache.has(key)) {
            console.log('Using cached street data for', key);
            return this.streetCache.get(key);
        }

        console.log('Fetching street data for', lat, lng);

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

            console.log('Bounding box:', bbox);

            const query = `
        [out:json][timeout:10];
        (
          way["highway"~"^(residential|tertiary|secondary|primary|trunk|unclassified|living_street)$"](${bbox.join(',')});
        );
        out geom;
      `;

            console.log('Overpass query:', query);

            const response = await fetch('https://overpass-api.de/api/interpreter', {
                method: 'POST',
                body: query,
                headers: { 'Content-Type': 'text/plain' }
            });

            console.log('Overpass response status:', response.status);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            console.log('Overpass data:', data);

            const streets = this.processStreetData(data.elements || []);
            console.log('Processed streets:', streets.length);

            this.streetCache.set(key, streets);
            return streets;

        } catch (error) {
            console.warn('Failed to fetch street data:', error);
            return [];
        }
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
    findClosestSegment(lat, lng, streets) {
        let closest = null;
        let minDistance = Infinity;

        for (const street of streets) {
            for (const segment of street.segments) {
                const distance = this.distanceToSegment([lat, lng], segment.start, segment.end);

                if (distance < minDistance) {
                    minDistance = distance;
                    closest = {
                        segment,
                        street,
                        distance,
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

        this.exploredSegments.add(segmentId);
        this.saveExploredSegments();

        // Award XP based on segment length (estimate ~50m average segment = 10 XP)
        return 10;
    }

    // Check if a segment has been explored
    isSegmentExplored(segmentId) {
        return this.exploredSegments.has(segmentId);
    }

    // Save explored segments to localStorage
    saveExploredSegments() {
        const segmentsArray = Array.from(this.exploredSegments);
        localStorage.setItem('wanderlust_explored_segments', JSON.stringify(segmentsArray));
    }

    // Load explored segments from localStorage
    loadExploredSegments() {
        try {
            const stored = localStorage.getItem('wanderlust_explored_segments');
            if (stored) {
                const segmentsArray = JSON.parse(stored);
                this.exploredSegments = new Set(segmentsArray);
            }
        } catch (error) {
            console.warn('Failed to load explored segments:', error);
            this.exploredSegments = new Set();
        }
    }

    // Clear all explored segments
    clearExploredSegments() {
        this.exploredSegments.clear();
        localStorage.removeItem('wanderlust_explored_segments');
    }

    // Get exploration statistics
    getExplorationStats() {
        return {
            segmentsExplored: this.exploredSegments.size,
            estimatedDistance: this.exploredSegments.size * 50 // Estimate 50m per segment
        };
    }
}