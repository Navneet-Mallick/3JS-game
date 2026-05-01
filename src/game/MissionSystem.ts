import { events, GameEvents } from './Events';

export enum MissionStatus {
    LOCKED,
    AVAILABLE,
    ACTIVE,
    COMPLETED,
    FAILED
}

export interface Mission {
    id: string;
    name: string;
    description: string;
    reward: number;
    status: MissionStatus;
    startPosition: THREE.Vector3;
    update: (dt: number) => void;
}

/**
 * MissionManager — Handles mission lifecycle and rewards.
 */
export class MissionManager {
    private missions: Map<string, Mission> = new Map();
    private activeMission: Mission | null = null;

    public addMission(mission: Mission) {
        this.missions.set(mission.id, mission);
    }

    public startMission(id: string) {
        const m = this.missions.get(id);
        if (m && m.status === MissionStatus.AVAILABLE) {
            m.status = MissionStatus.ACTIVE;
            this.activeMission = m;
            events.emit(GameEvents.MISSION_STARTED, m);
            this.notifyHUD(`MISSION: ${m.name}`, m.description);
        }
    }

    public completeMission() {
        if (this.activeMission) {
            this.activeMission.status = MissionStatus.COMPLETED;
            events.emit(GameEvents.MISSION_COMPLETED, this.activeMission);
            this.notifyHUD("MISSION COMPLETED!", `Reward: $${this.activeMission.reward}`);
            this.activeMission = null;
        }
    }

    public failMission(reason: string) {
        if (this.activeMission) {
            this.activeMission.status = MissionStatus.AVAILABLE;
            events.emit(GameEvents.MISSION_FAILED, { mission: this.activeMission, reason });
            this.notifyHUD("MISSION FAILED", reason);
            this.activeMission = null;
        }
    }

    public update(dt: number) {
        if (this.activeMission) {
            this.activeMission.update(dt);
        }
    }

    private notifyHUD(title: string, msg: string) {
        const el = document.getElementById('mission-notification');
        if (el) {
            el.innerHTML = `<h3>${title}</h3><p>${msg}</p>`;
            el.classList.add('visible');
            setTimeout(() => el.classList.remove('visible'), 5000);
        }
    }
}
