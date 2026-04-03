import * as THREE from 'three';

export class WantedLevel {
    private currentLevel = 0;
    private maxLevel = 6;
    private levelDecayTimer = 0;
    private lastCrimeTime = 0;
    private wantedStars: THREE.Mesh[] = [];
    private scene: THREE.Scene;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.createWantedStars();
    }

    private createWantedStars() {
        // Create 6 star shapes for wanted level display
        for (let i = 0; i < 6; i++) {
            const starGeometry = new THREE.BufferGeometry();
            const vertices = [];
            
            // Create star shape
            for (let j = 0; j < 10; j++) {
                const angle = (j / 10) * Math.PI * 2;
                const radius = j % 2 === 0 ? 0.3 : 0.15;
                vertices.push(
                    Math.cos(angle) * radius,
                    Math.sin(angle) * radius,
                    0
                );
            }
            
            starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            
            const starMaterial = new THREE.MeshBasicMaterial({
                color: 0xffff00,
                transparent: true,
                opacity: 0.8
            });
            
            const star = new THREE.Mesh(starGeometry, starMaterial);
            star.position.set(2.5 + i * 0.6, 3.5, -5);
            star.visible = false;
            
            this.scene.add(star);
            this.wantedStars.push(star);
        }
    }

    public addCrime(crimeType: 'violent' | 'theft' | 'property' | 'traffic') {
        const now = Date.now();
        this.lastCrimeTime = now;
        
        switch (crimeType) {
            case 'violent':
                this.increaseLevel(3);
                break;
            case 'theft':
                this.increaseLevel(2);
                break;
            case 'property':
                this.increaseLevel(1);
                break;
            case 'traffic':
                if (Math.random() > 0.7) { // 30% chance of getting wanted for traffic violations
                    this.increaseLevel(1);
                }
                break;
        }
        
        this.updateStarDisplay();
    }

    private increaseLevel(amount: number) {
        this.currentLevel = Math.min(this.currentLevel + amount, this.maxLevel);
        this.levelDecayTimer = 30; // Start 30 second decay timer
    }

    public update(dt: number) {
        // Decay wanted level over time
        if (this.currentLevel > 0) {
            this.levelDecayTimer -= dt;
            
            if (this.levelDecayTimer <= 0) {
                this.currentLevel = Math.max(0, this.currentLevel - 1);
                this.levelDecayTimer = 20; // 20 seconds for next level decay
                this.updateStarDisplay();
            }
        }
    }

    private updateStarDisplay() {
        this.wantedStars.forEach((star, index) => {
            star.visible = index < this.currentLevel;
            
            // Make stars pulse when active
            if (star.visible) {
                const pulse = Math.sin(Date.now() * 0.005 + index) * 0.3 + 0.7;
                (star.material as THREE.MeshBasicMaterial).opacity = pulse;
            }
        });
    }

    public getCurrentLevel(): number {
        return this.currentLevel;
    }

    public isWanted(): boolean {
        return this.currentLevel > 0;
    }

    public clearWantedLevel() {
        this.currentLevel = 0;
        this.levelDecayTimer = 0;
        this.updateStarDisplay();
    }

    public getPoliceResponse(): {
        spawnCount: number;
        aggressiveness: number;
        description: string;
    } {
        const response = {
            spawnCount: 0,
            aggressiveness: 0,
            description: ''
        };

        switch (this.currentLevel) {
            case 0:
                response.description = 'Clean';
                break;
            case 1:
                response.spawnCount = 1;
                response.aggressiveness = 0.3;
                response.description = '1 Star - Police Observing';
                break;
            case 2:
                response.spawnCount = 2;
                response.aggressiveness = 0.5;
                response.description = '2 Stars - Police Responding';
                break;
            case 3:
                response.spawnCount = 3;
                response.aggressiveness = 0.7;
                response.description = '3 Stars - Helicopter Called';
                break;
            case 4:
                response.spawnCount = 4;
                response.aggressiveness = 0.8;
                response.description = '4 Stars - SWAT En Route';
                break;
            case 5:
                response.spawnCount = 5;
                response.aggressiveness = 0.9;
                response.description = '5 Stars - Federal Agents';
                break;
            case 6:
                response.spawnCount = 6;
                response.aggressiveness = 1.0;
                response.description = '6 Stars - Maximum Force';
                break;
        }

        return response;
    }
}
