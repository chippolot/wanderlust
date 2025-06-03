export class RouteSuggestionService {
    constructor(streetService) {
        this.streetService = streetService;
    }

    // Main method to suggest routes
    async suggestRoute(userPosition, maxDistanceKm = 2, targetRouteKm = 2) {
        console.log(`🎯 Finding route suggestion: ${targetRouteKm}km route within ${maxDistanceKm}km of current position`);
        
        try {
            // Get streets within the search radius
            const searchRadiusMeters = maxDistanceKm * 1000;
            const streets = await this.streetService.getNearbyStreets(
                userPosition[0], 
                userPosition[1], 
                searchRadiusMeters
            );

            if (!streets || streets.length === 0) {
                return { success: false, error: 'No streets found in the area' };
            }

            // Find undiscovered segments within distance
            const undiscoveredSegments = this.findUndiscoveredSegments(streets, userPosition, maxDistanceKm);
            
            if (undiscoveredSegments.length === 0) {
                return { success: false, error: 'No undiscovered streets in the area! Try a larger search radius.' };
            }

            console.log(`📍 Found ${undiscoveredSegments.length} undiscovered segments`);

            // Generate route suggestion
            const routeSuggestion = this.generateOptimalRoute(
                userPosition, 
                undiscoveredSegments, 
                targetRouteKm
            );

            if (!routeSuggestion) {
                return { success: false, error: 'Could not generate a suitable route' };
            }

            return {
                success: true,
                route: routeSuggestion,
                stats: {
                    totalDistance: routeSuggestion.totalDistance,
                    undiscoveredSegments: routeSuggestion.segmentCount,
                    estimatedXP: Math.round(routeSuggestion.estimatedXP),
                    estimatedDuration: Math.round(routeSuggestion.totalDistance * 12) // ~12 minutes per km
                }
            };

        } catch (error) {
            console.error('Route suggestion error:', error);
            return { success: false, error: 'Failed to generate route suggestion' };
        }
    }

    // Find undiscovered segments within distance from user
    findUndiscoveredSegments(streets, userPosition, maxDistanceKm) {
        const undiscovered = [];
        const maxDistanceMeters = maxDistanceKm * 1000;

        for (const street of streets) {
            for (const segment of street.segments) {
                // Skip if already explored
                if (segment.explored) continue;

                // Check distance from user to segment midpoint
                const segmentMidpoint = this.getSegmentMidpoint(segment);
                const distance = this.haversineDistance(userPosition, segmentMidpoint);

                if (distance <= maxDistanceMeters) {
                    undiscovered.push({
                        ...segment,
                        streetName: street.name,
                        distanceFromUser: distance,
                        midpoint: segmentMidpoint,
                        length: this.haversineDistance(segment.start, segment.end)
                    });
                }
            }
        }

        // Sort by distance from user (closest first)
        return undiscovered.sort((a, b) => a.distanceFromUser - b.distanceFromUser);
    }

    // Generate optimal route using clustering and pathfinding
    generateOptimalRoute(userPosition, undiscoveredSegments, targetRouteKm) {
        const targetDistanceMeters = targetRouteKm * 1000;
        
        // Try different strategies and pick the best one
        const strategies = [
            () => this.generateLinearWalkingRoute(userPosition, undiscoveredSegments, targetDistanceMeters),
            () => this.generateSimpleOutAndBackRoute(userPosition, undiscoveredSegments, targetDistanceMeters),
            () => this.generateNearbySegmentsRoute(userPosition, undiscoveredSegments, targetDistanceMeters)
        ];

        let bestRoute = null;
        let bestScore = -1;

        for (const strategy of strategies) {
            try {
                const route = strategy();
                if (route) {
                    const score = this.scoreRoute(route, targetDistanceMeters);
                    if (score > bestScore) {
                        bestScore = score;
                        bestRoute = route;
                    }
                }
            } catch (error) {
                console.warn('Strategy failed:', error);
            }
        }

        return bestRoute;
    }

    // Strategy 1: Simple linear walking route - minimal backtracking
    generateLinearWalkingRoute(userPosition, segments, targetDistance) {
        if (segments.length === 0) return null;

        // Find a good starting direction - pick segments that are roughly in a line
        const startSegment = this.findBestStartingSegment(userPosition, segments);
        
        const waypoints = [];
        const visitedSegments = [];
        let totalDistance = 0;
        let currentPosition = userPosition;

        // Add starting waypoint
        waypoints.push({
            position: userPosition,
            instruction: "Start here",
            type: "start"
        });

        // Walk to the starting segment
        const walkToStart = this.haversineDistance(userPosition, startSegment.start);
        totalDistance += walkToStart;
        
        waypoints.push({
            position: startSegment.start,
            instruction: `Walk to ${startSegment.streetName}`,
            type: "walk"
        });
        currentPosition = startSegment.start;

        // Follow connected segments in a linear fashion
        const remainingSegments = segments.filter(seg => seg !== startSegment);
        let currentSegment = startSegment;

        while (totalDistance < targetDistance * 0.7 && remainingSegments.length > 0) {
            // Add current segment
            visitedSegments.push(currentSegment);
            
            waypoints.push({
                position: currentSegment.end,
                instruction: `Follow ${currentSegment.streetName}`,
                type: "follow"
            });
            
            totalDistance += currentSegment.length;
            currentPosition = currentSegment.end;

            // Find the next segment that continues in roughly the same direction
            const nextSegment = this.findContinuingSegment(currentSegment, remainingSegments, currentPosition);
            
            if (!nextSegment) break;
            
            // Remove from remaining segments
            const index = remainingSegments.indexOf(nextSegment);
            remainingSegments.splice(index, 1);
            
            // If there's a gap, add a walking waypoint
            const walkDistance = this.haversineDistance(currentPosition, nextSegment.start);
            if (walkDistance > 50) {
                totalDistance += walkDistance;
                waypoints.push({
                    position: nextSegment.start,
                    instruction: `Walk to ${nextSegment.streetName}`,
                    type: "walk"
                });
                currentPosition = nextSegment.start;
            }
            
            currentSegment = nextSegment;
        }

        // Add final segment if we have one
        if (currentSegment && !visitedSegments.includes(currentSegment)) {
            visitedSegments.push(currentSegment);
            waypoints.push({
                position: currentSegment.end,
                instruction: `Follow ${currentSegment.streetName}`,
                type: "follow"
            });
            totalDistance += currentSegment.length;
            currentPosition = currentSegment.end;
        }

        // Return to start
        const returnDistance = this.haversineDistance(currentPosition, userPosition);
        totalDistance += returnDistance;
        
        waypoints.push({
            position: userPosition,
            instruction: "Return to start",
            type: "return"
        });

        return this.buildWaypointRouteResult(waypoints, visitedSegments, totalDistance);
    }

    // Strategy 2: Simple out and back - very easy to follow
    generateSimpleOutAndBackRoute(userPosition, segments, targetDistance) {
        if (segments.length === 0) return null;

        const halfDistance = targetDistance / 2;
        const waypoints = [];
        const visitedSegments = [];
        let totalDistance = 0;
        let currentPosition = userPosition;

        // Add starting waypoint
        waypoints.push({
            position: userPosition,
            instruction: "Start here",
            type: "start"
        });

        // Pick the 3-5 best segments in roughly the same direction
        const directionSegments = this.findSegmentsInDirection(userPosition, segments, 5);
        
        let segmentCount = 0;
        // Go out - visit segments
        for (const segment of directionSegments) {
            if (totalDistance > halfDistance || segmentCount >= 4) break;

            const walkDistance = this.haversineDistance(currentPosition, segment.start);
            if (totalDistance + walkDistance + segment.length > halfDistance) break;

            // Walk to segment
            totalDistance += walkDistance;
            waypoints.push({
                position: segment.start,
                instruction: `Walk to ${segment.streetName}`,
                type: "walk"
            });

            // Follow segment
            visitedSegments.push(segment);
            totalDistance += segment.length;
            currentPosition = segment.end;
            
            waypoints.push({
                position: segment.end,
                instruction: `Follow ${segment.streetName}`,
                type: "follow"
            });
            
            segmentCount++;
        }

        // Turn around point
        waypoints.push({
            position: currentPosition,
            instruction: "Turn around and head back",
            type: "turnaround"
        });

        // Return to start (simple direct route)
        const returnDistance = this.haversineDistance(currentPosition, userPosition);
        totalDistance += returnDistance;
        
        waypoints.push({
            position: userPosition,
            instruction: "Return to start",
            type: "return"
        });

        return this.buildWaypointRouteResult(waypoints, visitedSegments, totalDistance);
    }

    // Strategy 3: Nearby segments only - minimal walking between segments
    generateNearbySegmentsRoute(userPosition, segments, targetDistance) {
        if (segments.length === 0) return null;

        // Only use segments within 300m of each other
        const nearbySegments = this.findTightlyClusteredSegments(segments, 300);
        if (nearbySegments.length === 0) return null;

        const waypoints = [];
        const visitedSegments = [];
        let totalDistance = 0;
        let currentPosition = userPosition;

        waypoints.push({
            position: userPosition,
            instruction: "Start here",
            type: "start"
        });

        // Visit nearby segments with minimal walking
        for (const segment of nearbySegments) {
            if (totalDistance > targetDistance * 0.8) break;

            const walkDistance = this.haversineDistance(currentPosition, segment.start);
            if (walkDistance > 200) continue; // Skip if too far

            // Walk to segment
            totalDistance += walkDistance;
            if (walkDistance > 50) {
                waypoints.push({
                    position: segment.start,
                    instruction: `Walk to ${segment.streetName}`,
                    type: "walk"
                });
            }

            // Follow segment
            visitedSegments.push(segment);
            totalDistance += segment.length;
            currentPosition = segment.end;
            
            waypoints.push({
                position: segment.end,
                instruction: `Explore ${segment.streetName}`,
                type: "follow"
            });
        }

        // Return to start
        const returnDistance = this.haversineDistance(currentPosition, userPosition);
        totalDistance += returnDistance;
        
        waypoints.push({
            position: userPosition,
            instruction: "Return to start",
            type: "return"
        });

        return this.buildWaypointRouteResult(waypoints, visitedSegments, totalDistance);
    }

    // Helper methods for improved routing
    findBestStartingSegment(userPosition, segments) {
        // Find segment that's close but has other segments nearby (good for continuing)
        let bestSegment = segments[0];
        let bestScore = -1;

        for (const segment of segments) {
            const distance = segment.distanceFromUser;
            const nearbyCount = segments.filter(other => 
                other !== segment && 
                this.haversineDistance(segment.midpoint, other.midpoint) < 400
            ).length;
            
            const score = (nearbyCount + 1) / (distance + 100);
            if (score > bestScore) {
                bestScore = score;
                bestSegment = segment;
            }
        }

        return bestSegment;
    }

    findContinuingSegment(currentSegment, remainingSegments, currentPosition) {
        // Find segment that continues in roughly the same direction
        const currentDirection = this.getSegmentDirection(currentSegment);
        
        let bestSegment = null;
        let bestScore = -1;

        for (const segment of remainingSegments) {
            const distance = this.haversineDistance(currentPosition, segment.start);
            if (distance > 300) continue; // Too far away

            const segmentDirection = this.getSegmentDirection(segment);
            const directionDiff = Math.abs(currentDirection - segmentDirection);
            const normalizedDirectionDiff = Math.min(directionDiff, 360 - directionDiff);
            
            // Prefer segments that continue in the same direction and are close
            const directionScore = 1 - (normalizedDirectionDiff / 180);
            const distanceScore = 1 / (distance + 50);
            const score = directionScore * 0.7 + distanceScore * 0.3;

            if (score > bestScore) {
                bestScore = score;
                bestSegment = segment;
            }
        }

        return bestSegment;
    }

    findSegmentsInDirection(userPosition, segments, maxCount) {
        // Find segments that are roughly in the same direction from user
        if (segments.length === 0) return [];

        const firstSegment = segments[0];
        const baseDirection = Math.atan2(
            firstSegment.midpoint[1] - userPosition[1],
            firstSegment.midpoint[0] - userPosition[0]
        );

        return segments
            .filter(segment => {
                const segmentDirection = Math.atan2(
                    segment.midpoint[1] - userPosition[1],
                    segment.midpoint[0] - userPosition[0]
                );
                const diff = Math.abs(baseDirection - segmentDirection);
                return diff < Math.PI / 3; // Within 60 degrees
            })
            .sort((a, b) => a.distanceFromUser - b.distanceFromUser)
            .slice(0, maxCount);
    }

    findTightlyClusteredSegments(segments, maxDistance) {
        // Find segments that are all close to each other
        const clustered = [];
        
        for (const segment of segments) {
            const nearbyCount = segments.filter(other => 
                this.haversineDistance(segment.midpoint, other.midpoint) <= maxDistance
            ).length;
            
            if (nearbyCount >= 2) { // At least one other segment nearby
                clustered.push(segment);
            }
        }
        
        return clustered.sort((a, b) => a.distanceFromUser - b.distanceFromUser);
    }

    getSegmentDirection(segment) {
        // Get direction of segment in degrees
        const dx = segment.end[1] - segment.start[1];
        const dy = segment.end[0] - segment.start[0];
        const radians = Math.atan2(dy, dx);
        return (radians * 180 / Math.PI + 360) % 360;
    }

    buildWaypointRouteResult(waypoints, visitedSegments, totalDistance) {
        const estimatedXP = visitedSegments.reduce((sum, seg) => sum + (seg.length * 0.2), 0);
        
        // Extract just the positions for the polyline
        const routePoints = waypoints.map(wp => wp.position);
        
        return {
            points: routePoints,
            waypoints: waypoints, // New: include waypoints for numbered markers
            segments: visitedSegments,
            totalDistance: totalDistance / 1000, // Convert to km
            segmentCount: visitedSegments.length,
            estimatedXP
        };
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

    getSegmentMidpoint(segment) {
        const lat = (segment.start[0] + segment.end[0]) / 2;
        const lng = (segment.start[1] + segment.end[1]) / 2;
        return [lat, lng];
    }

    scoreRoute(route, targetDistance) {
        const distanceScore = 1 - Math.abs(route.totalDistance - targetDistance) / targetDistance;
        const segmentScore = route.segmentCount / 10; // Normalize segment count
        const xpScore = route.estimatedXP / 100; // Normalize XP
        
        return (distanceScore * 0.4) + (segmentScore * 0.4) + (xpScore * 0.2);
    }
} 