// XP and gamification service - for future expansion

export class XPService {
    constructor() {
        this.achievements = [
            { id: 'first_steps', name: 'First Steps', description: 'Complete your first route', xp: 50 },
            { id: 'explorer', name: 'Explorer', description: 'Walk 1km total', xp: 100 },
            { id: 'adventurer', name: 'Adventurer', description: 'Walk 5km total', xp: 250 },
            { id: 'wanderer', name: 'Wanderer', description: 'Walk 10km total', xp: 500 }
        ];
    }

    // Future: Add more sophisticated XP/gamification
    // - Achievement system
    // - Levels and rewards
    // - Streak tracking
    // - Social features
}