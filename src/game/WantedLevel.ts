import * as THREE from 'three';

export class WantedLevel {
    private currentLevel = 0;
    private maxLevel = 5;
    private levelDecayTimer = 0;
    private readonly DECAY_RATE = 20.0; // 20 seconds per level
    private mesh: THREE.Group;

    constructor(scene: THREE.Scene) {
        this.mesh = this.createWantedLevelUI();
        scene.add(this.mesh);
    }

    private createWantedLevelUI(): THREE.Group {
        const group = new THREE.Group();
        // UI will be handled in HTML, this is just a placeholder
        return group;
    }

    public update(dt: number) {
        if (this.currentLevel > 0) {
            this.levelDecayTimer += dt;
            if (this.levelDecayTimer >= this.DECAY_RATE) {
                this.currentLevel = Math.max(0, this.currentLevel - 1);
                this.levelDecayTimer = 0;
            }
        }
    }

    public addWantedLevel(amount: number = 1) {
        this.currentLevel = Math.min(this.maxLevel, this.currentLevel + amount);
        this.levelDecayTimer = 0;
    }

    public removeWantedLevel(amount: number = 1) {
        this.currentLevel = Math.max(0, this.currentLevel - amount);
    }

    public getLevel(): number {
        return this.currentLevel;
    }

    public setLevel(level: number) {
        this.currentLevel = Math.max(0, Math.min(this.maxLevel, level));
        this.levelDecayTimer = 0;
    }

    public clearWantedLevel() {
        this.currentLevel = 0;
        this.levelDecayTimer = 0;
    }

    public isWanted(): boolean {
        return this.currentLevel > 0;
    }

    public getMesh(): THREE.Group {
        return this.mesh;
    }
}
