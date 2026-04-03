import * as THREE from 'three';

export interface MissionDef {
    id: string;
    title: string;
    description: string;
    type: 'reach' | 'collect' | 'survive';
    target?: THREE.Vector3;
    duration?: number;   // for survive
    reward: number;
}

const MISSIONS: MissionDef[] = [
    { id: 'm1', title: 'UPTOWN RUN',      description: 'Reach the north district',  type: 'reach',   target: new THREE.Vector3(0, 0, -200),  reward: 500  },
    { id: 'm2', title: 'EAST SIDE',       description: 'Reach the east district',   type: 'reach',   target: new THREE.Vector3(200, 0, 0),   reward: 500  },
    { id: 'm3', title: 'GHOST PROTOCOL',  description: 'Survive 60 seconds',        type: 'survive', duration: 60,                           reward: 800  },
    { id: 'm4', title: 'DEEP SOUTH',      description: 'Reach the south district',  type: 'reach',   target: new THREE.Vector3(0, 0, 200),   reward: 500  },
    { id: 'm5', title: 'IRON WILL',       description: 'Survive 120 seconds',       type: 'survive', duration: 120,                          reward: 1500 },
    { id: 'm6', title: 'WEST END',        description: 'Reach the west district',   type: 'reach',   target: new THREE.Vector3(-200, 0, 0),  reward: 500  },
];

export class MissionSystem {
    private current: MissionDef | null = null;
    private missionIndex = 0;
    private timer = 0;
    private active = false;
    private completed = false;

    // Marker mesh
    public markerMesh: THREE.Mesh | null = null;
    private markerLight: THREE.PointLight | null = null;
    private scene: THREE.Scene;

    // UI
    private missionPanel  = document.getElementById('mission-panel');
    private missionTitle  = document.getElementById('mission-title');
    private missionDesc   = document.getElementById('mission-desc');
    private missionTimer  = document.getElementById('mission-timer');
    private missionDist   = document.getElementById('mission-dist');

    constructor(scene: THREE.Scene) {
        this.scene = scene;
    }

    public start() {
        this.missionIndex = 0;
        this.loadMission(this.missionIndex);
    }

    private loadMission(idx: number) {
        if (idx >= MISSIONS.length) {
            this.showComplete();
            return;
        }
        this.current = MISSIONS[idx];
        this.timer = this.current.duration ?? 0;
        this.active = true;
        this.completed = false;

        this.removeMarker();
        if (this.current.target) this.spawnMarker(this.current.target);

        if (this.missionPanel)  this.missionPanel.style.display  = 'flex';
        if (this.missionTitle)  this.missionTitle.textContent    = this.current.title;
        if (this.missionDesc)   this.missionDesc.textContent     = this.current.description;
        if (this.missionTimer)  this.missionTimer.style.display  = this.current.type === 'survive' ? 'block' : 'none';
        if (this.missionDist)   this.missionDist.style.display   = this.current.type === 'reach'   ? 'block' : 'none';
    }

    private spawnMarker(pos: THREE.Vector3) {
        const geo  = new THREE.CylinderGeometry(0, 2, 6, 6);
        const mat  = new THREE.MeshBasicMaterial({ color: 0x00f2ff, wireframe: true });
        this.markerMesh = new THREE.Mesh(geo, mat);
        this.markerMesh.position.set(pos.x, 1, pos.z);
        this.scene.add(this.markerMesh);

        this.markerLight = new THREE.PointLight(0x00f2ff, 4, 40);
        this.markerLight.position.set(pos.x, 8, pos.z);
        this.scene.add(this.markerLight);
    }

    private removeMarker() {
        if (this.markerMesh)  { this.scene.remove(this.markerMesh);  this.markerMesh  = null; }
        if (this.markerLight) { this.scene.remove(this.markerLight); this.markerLight = null; }
    }

    public update(dt: number, playerPos: THREE.Vector3): number {
        if (!this.active || !this.current) return 0;

        // Animate marker
        if (this.markerMesh) {
            this.markerMesh.rotation.y += dt * 1.2;
            this.markerMesh.position.y = 1 + Math.sin(Date.now() * 0.002) * 0.5;
        }

        if (this.current.type === 'reach' && this.current.target) {
            const dist = new THREE.Vector2(playerPos.x - this.current.target.x, playerPos.z - this.current.target.z).length();
            if (this.missionDist) this.missionDist.textContent = `${Math.round(dist)}m`;
            if (dist < 12) return this.completeMission();
        }

        if (this.current.type === 'survive') {
            this.timer -= dt;
            if (this.missionTimer) this.missionTimer.textContent = `${Math.max(0, Math.ceil(this.timer))}s`;
            if (this.timer <= 0) return this.completeMission();
        }

        return 0;
    }

    private completeMission(): number {
        if (!this.current) return 0;
        const reward = this.current.reward;
        this.active = false;
        this.completed = true;
        this.removeMarker();

        const flash = document.getElementById('mission-flash');
        if (flash) {
            flash.textContent = `✓ ${this.current.title} — +${reward}`;
            flash.classList.add('show');
            setTimeout(() => flash.classList.remove('show'), 3000);
        }

        setTimeout(() => {
            this.missionIndex++;
            this.loadMission(this.missionIndex);
        }, 3500);

        return reward;
    }

    private showComplete() {
        if (this.missionPanel) this.missionPanel.style.display = 'none';
        const flash = document.getElementById('mission-flash');
        if (flash) {
            flash.textContent = '★ ALL MISSIONS COMPLETE ★';
            flash.classList.add('show');
        }
    }

    public getCurrentTarget(): THREE.Vector3 | null {
        return this.current?.target ?? null;
    }
}
