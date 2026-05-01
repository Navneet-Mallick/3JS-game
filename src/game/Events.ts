type Callback = (data?: any) => void;

/**
 * Global Event Bus for system-wide communication
 * Decouples systems like Economy, Missions, and AI.
 */
class EventEmitter {
    private events: Map<string, Callback[]> = new Map();

    public on(event: string, callback: Callback) {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }
        this.events.get(event)!.push(callback);
    }

    public off(event: string, callback: Callback) {
        if (!this.events.has(event)) return;
        const callbacks = this.events.get(event)!;
        this.events.set(event, callbacks.filter(cb => cb !== callback));
    }

    public emit(event: string, data?: any) {
        if (!this.events.has(event)) return;
        this.events.get(event)!.forEach(callback => callback(data));
    }
}

export const events = new EventEmitter();

// Global Event Names
export const GameEvents = {
    MISSION_STARTED: 'mission_started',
    MISSION_COMPLETED: 'mission_completed',
    MISSION_FAILED: 'mission_failed',
    MONEY_CHANGED: 'money_changed',
    CRIME_COMMITTED: 'crime_committed',
    PLAYER_DIED: 'player_died',
    VEHICLE_ENTERED: 'vehicle_entered',
    VEHICLE_EXITED: 'vehicle_exited',
    ITEM_PURCHASED: 'item_purchased',
};
