export class AchievementService {
    constructor() {
        this.achievements = this.defineAchievements();
        this.unlockedAchievements = new Set();
        this.achievementProgress = new Map();
        this.loadAchievements();
    }

    defineAchievements() {
        return {
            // Basic exploration achievements
            first_steps: {
                id: 'first_steps',
                name: 'First Steps',
                description: 'Discover your first street segment',
                category: 'exploration',
                icon: '👣',
                criteria: { type: 'segments_discovered', target: 1 },
                xpReward: 20
            },
            getting_around: {
                id: 'getting_around',
                name: 'Getting Around',
                description: 'Discover 25 street segments',
                category: 'exploration',
                icon: '🚶‍♂️',
                criteria: { type: 'segments_discovered', target: 25 },
                xpReward: 30
            },
            street_scholar: {
                id: 'street_scholar',
                name: 'Street Scholar',
                description: 'Discover 100 street segments',
                category: 'exploration',
                icon: '📚',
                criteria: { type: 'segments_discovered', target: 100 },
                xpReward: 50
            },
            neighborhood_navigator: {
                id: 'neighborhood_navigator',
                name: 'Neighborhood Navigator',
                description: 'Discover 300 street segments',
                category: 'exploration',
                icon: '🗺️',
                criteria: { type: 'segments_discovered', target: 300 },
                xpReward: 100
            },
            urban_explorer: {
                id: 'urban_explorer',
                name: 'Urban Explorer',
                description: 'Discover 500 street segments',
                category: 'exploration',
                icon: '🏙️',
                criteria: { type: 'segments_discovered', target: 500 },
                xpReward: 150
            },
            street_master: {
                id: 'street_master',
                name: 'Street Master',
                description: 'Discover 1000 street segments',
                category: 'exploration',
                icon: '🏆',
                criteria: { type: 'segments_discovered', target: 1000 },
                xpReward: 250
            },

            // XP-based achievements
            novice_wanderer: {
                id: 'novice_wanderer',
                name: 'Novice Wanderer',
                description: 'Earn 1000 XP from exploration',
                category: 'progression',
                icon: '🌟',
                criteria: { type: 'total_xp', target: 1000 },
                xpReward: 30
            },
            experienced_explorer: {
                id: 'experienced_explorer',
                name: 'Experienced Explorer',
                description: 'Earn 3000 XP from exploration',
                category: 'progression',
                icon: '⭐',
                criteria: { type: 'total_xp', target: 3000 },
                xpReward: 60
            },
            seasoned_explorer: {
                id: 'seasoned_explorer',
                name: 'Seasoned Explorer',
                description: 'Earn 8000 XP from exploration',
                category: 'progression',
                icon: '🎯',
                criteria: { type: 'total_xp', target: 8000 },
                xpReward: 100
            },
            master_wanderer: {
                id: 'master_wanderer',
                name: 'Master Wanderer',
                description: 'Earn 20000 XP from exploration',
                category: 'progression',
                icon: '👑',
                criteria: { type: 'total_xp', target: 20000 },
                xpReward: 200
            },

            // Session-based achievements
            good_walk: {
                id: 'good_walk',
                name: 'Good Walk',
                description: 'Earn 50+ XP in a single exploration session',
                category: 'session',
                icon: '🚶',
                criteria: { type: 'session_xp', target: 50 },
                xpReward: 25
            },
            marathon_session: {
                id: 'marathon_session',
                name: 'Marathon Session',
                description: 'Earn 150+ XP in a single exploration session',
                category: 'session',
                icon: '🏃‍♂️',
                criteria: { type: 'session_xp', target: 150 },
                xpReward: 40
            },
            epic_journey: {
                id: 'epic_journey',
                name: 'Epic Journey',
                description: 'Earn 300+ XP in a single exploration session',
                category: 'session',
                icon: '🚀',
                criteria: { type: 'session_xp', target: 300 },
                xpReward: 75
            },
            legendary_expedition: {
                id: 'legendary_expedition',
                name: 'Legendary Expedition',
                description: 'Earn 500+ XP in a single exploration session',
                category: 'session',
                icon: '🏔️',
                criteria: { type: 'session_xp', target: 500 },
                xpReward: 125
            },

            // Level-based achievements
            rising_explorer: {
                id: 'rising_explorer',
                name: 'Rising Explorer',
                description: 'Reach level 3',
                category: 'progression',
                icon: '📈',
                criteria: { type: 'level_reached', target: 3 },
                xpReward: 40
            },
            skilled_navigator: {
                id: 'skilled_navigator',
                name: 'Skilled Navigator',
                description: 'Reach level 5',
                category: 'progression',
                icon: '⚡',
                criteria: { type: 'level_reached', target: 5 },
                xpReward: 60
            },
            level_up_warrior: {
                id: 'level_up_warrior',
                name: 'Level Up Warrior',
                description: 'Reach level 8',
                category: 'progression',
                icon: '⚔️',
                criteria: { type: 'level_reached', target: 8 },
                xpReward: 100
            },
            exploration_master: {
                id: 'exploration_master',
                name: 'Exploration Master',
                description: 'Reach level 12',
                category: 'progression',
                icon: '👑',
                criteria: { type: 'level_reached', target: 12 },
                xpReward: 150
            },
            wanderlust_legend: {
                id: 'wanderlust_legend',
                name: 'Wanderlust Legend',
                description: 'Reach level 20',
                category: 'progression',
                icon: '🌟',
                criteria: { type: 'level_reached', target: 20 },
                xpReward: 300
            },

            // Dedication achievements
            return_visitor: {
                id: 'return_visitor',
                name: 'Return Visitor',
                description: 'Start exploring on 3 different days',
                category: 'dedication',
                icon: '📅',
                criteria: { type: 'exploration_days', target: 3 },
                xpReward: 50
            },
            regular_explorer: {
                id: 'regular_explorer',
                name: 'Regular Explorer',
                description: 'Start exploring on 7 different days',
                category: 'dedication',
                icon: '📆',
                criteria: { type: 'exploration_days', target: 7 },
                xpReward: 75
            },
            dedicated_wanderer: {
                id: 'dedicated_wanderer',
                name: 'Dedicated Wanderer',
                description: 'Start exploring on 15 different days',
                category: 'dedication',
                icon: '🗓️',
                criteria: { type: 'exploration_days', target: 15 },
                xpReward: 125
            },
            streak_starter: {
                id: 'streak_starter',
                name: 'Streak Starter',
                description: 'Explore for 3 consecutive days',
                category: 'dedication',
                icon: '🔥',
                criteria: { type: 'consecutive_days', target: 3 },
                xpReward: 40
            },
            week_warrior: {
                id: 'week_warrior',
                name: 'Week Warrior',
                description: 'Explore for 7 consecutive days',
                category: 'dedication',
                icon: '🏆',
                criteria: { type: 'consecutive_days', target: 7 },
                xpReward: 100
            },
            consistency_champion: {
                id: 'consistency_champion',
                name: 'Consistency Champion',
                description: 'Explore for 14 consecutive days',
                category: 'dedication',
                icon: '💎',
                criteria: { type: 'consecutive_days', target: 14 },
                xpReward: 200
            }
        };
    }

    // Check achievements against current stats
    checkAchievements(stats) {
        const newUnlocks = [];

        for (const [id, achievement] of Object.entries(this.achievements)) {
            if (this.unlockedAchievements.has(id)) continue;

            const { criteria } = achievement;
            let isUnlocked = false;

            switch (criteria.type) {
                case 'segments_discovered':
                    isUnlocked = stats.segmentsExplored >= criteria.target;
                    break;
                case 'total_xp':
                    isUnlocked = stats.totalXP >= criteria.target;
                    break;
                case 'session_xp':
                    isUnlocked = stats.sessionXP >= criteria.target;
                    break;
                case 'level_reached':
                    isUnlocked = stats.currentLevel >= criteria.target;
                    break;
                case 'exploration_days':
                    isUnlocked = stats.explorationDays >= criteria.target;
                    break;
                case 'consecutive_days':
                    isUnlocked = stats.consecutiveDays >= criteria.target;
                    break;
            }

            if (isUnlocked) {
                this.unlockAchievement(id);
                newUnlocks.push(achievement);
            }
        }

        return newUnlocks;
    }

    unlockAchievement(achievementId) {
        if (this.unlockedAchievements.has(achievementId)) return false;
        
        this.unlockedAchievements.add(achievementId);
        this.saveAchievements();
        return true;
    }

    getAchievement(achievementId) {
        return this.achievements[achievementId];
    }

    getAllAchievements() {
        return Object.values(this.achievements);
    }

    getUnlockedAchievements() {
        return Array.from(this.unlockedAchievements)
            .map(id => this.achievements[id])
            .filter(Boolean);
    }

    getProgress(achievementId, currentStats) {
        const achievement = this.achievements[achievementId];
        if (!achievement || this.unlockedAchievements.has(achievementId)) {
            return { completed: true, progress: 1, current: achievement?.criteria.target || 0 };
        }

        const { criteria } = achievement;
        let current = 0;

        switch (criteria.type) {
            case 'segments_discovered':
                current = currentStats.segmentsExplored || 0;
                break;
            case 'total_xp':
                current = currentStats.totalXP || 0;
                break;
            case 'session_xp':
                current = currentStats.sessionXP || 0;
                break;
            case 'level_reached':
                current = currentStats.currentLevel || 1;
                break;
            case 'exploration_days':
                current = currentStats.explorationDays || 0;
                break;
            case 'consecutive_days':
                current = currentStats.consecutiveDays || 0;
                break;
        }

        const progress = Math.min(current / criteria.target, 1);
        return { completed: false, progress, current, target: criteria.target };
    }

    // Save/load achievements from localStorage
    saveAchievements() {
        const data = {
            unlocked: Array.from(this.unlockedAchievements),
            progress: Array.from(this.achievementProgress.entries())
        };
        localStorage.setItem('wanderlust_achievements', JSON.stringify(data));
    }

    loadAchievements() {
        try {
            const stored = localStorage.getItem('wanderlust_achievements');
            if (stored) {
                const data = JSON.parse(stored);
                this.unlockedAchievements = new Set(data.unlocked || []);
                this.achievementProgress = new Map(data.progress || []);
            }
        } catch (error) {
            console.warn('Failed to load achievements:', error);
        }
    }

    clearAchievements() {
        this.unlockedAchievements.clear();
        this.achievementProgress.clear();
        localStorage.removeItem('wanderlust_achievements');
    }

    // Get achievement statistics
    getAchievementStats() {
        const total = Object.keys(this.achievements).length;
        const unlocked = this.unlockedAchievements.size;
        const totalXPFromAchievements = this.getUnlockedAchievements()
            .reduce((sum, achievement) => sum + achievement.xpReward, 0);

        return {
            total,
            unlocked,
            percentage: Math.round((unlocked / total) * 100),
            totalXPFromAchievements
        };
    }
} 