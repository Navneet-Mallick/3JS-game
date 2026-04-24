import * as THREE from 'three';

// Pre-allocated — zero per-frame allocations
const _dir = new THREE.Vector3();

export class Pedestrian {
    public mesh: THREE.Group;
    public health: number = 100;
    public isDead: boolean = false;

    private walkSpeed  = 2.0;
    private runSpeed   = 4.5;
    private targetX    = 0;
    private targetZ    = 0;
    private wanderTimer = 0;
    private isAlive    = true;

    // Shared geometry + materials across all pedestrians
    private static _bodyGeo = new THREE.BoxGeometry(0.5, 0.8, 0.3);
    private static _headGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
    private static _legGeo  = new THREE.BoxGeometry(0.18, 0.55, 0.18);
    private static _mats    = [
        new THREE.MeshLambertMaterial({ color: 0x2a4d8f }),
        new THREE.MeshLambertMaterial({ color: 0x8b2222 }),
        new THREE.MeshLambertMaterial({ color: 0x228b22 }),
        new THREE.MeshLambertMaterial({ color: 0x8b6914 }),
    ];
    private static _headMat = new THREE.MeshLambertMaterial({ color: 0xf4c2a1 });
    private static _legMat  = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    private static _pedIdx  = 0;

    constructor(scene: THREE.Scene, _world: unknown, position: THREE.Vector3) {
        this.mesh = this.buildModel();
        this.mesh.position.copy(position);
        this.mesh.position.y = 0; // sit on ground
        scene.add(this.mesh);
        this.targetX = position.x;
        this.targetZ = position.z;
    }

    private buildModel(): THREE.Group {
        const g   = new THREE.Group();
        const mat = Pedestrian._mats[Pedestrian._pedIdx++ % Pedestrian._mats.length];

        const body = new THREE.Mesh(Pedestrian._bodyGeo, mat);
        body.position.y = 0.8; g.add(body);

        const head = new THREE.Mesh(Pedestrian._headGeo, Pedestrian._headMat);
        head.position.y = 1.45; g.add(head);

        const lLeg = new THREE.Mesh(Pedestrian._legGeo, Pedestrian._legMat);
        lLeg.position.set(-0.14, 0.22, 0); g.add(lLeg);
        const rLeg = new THREE.Mesh(Pedestrian._legGeo, Pedestrian._legMat);
        rLeg.position.set(0.14, 0.22, 0); g.add(rLeg);

        return g;
    }

    // Throttled update — called only when near player (LOD in Core)
    public update(dt: number, playerPos: THREE.Vector3) {
        if (!this.isAlive || this.isDead) {
            this.mesh.visible = false;
            return;
        }

        // Wander timer
        this.wanderTimer -= dt;
        if (this.wanderTimer <= 0) {
            this.wanderTimer = 3 + Math.random() * 4;
            this.pickTarget();
        }

        // Flee if player is close
        const dx = this.mesh.position.x - playerPos.x;
        const dz = this.mesh.position.z - playerPos.z;
        const distSq = dx * dx + dz * dz;
        const speed  = distSq < 25 ? this.runSpeed : this.walkSpeed; // 5m radius

        if (distSq < 25) {
            // Flee direction — no allocation
            const len = Math.sqrt(distSq) || 1;
            this.targetX = this.mesh.position.x + (dx / len) * 12;
            this.targetZ = this.mesh.position.z + (dz / len) * 12;
        }

        // Move toward target — reuse _dir
        _dir.set(this.targetX - this.mesh.position.x, 0, this.targetZ - this.mesh.position.z);
        const dist = _dir.length();
        if (dist > 0.5) {
            _dir.multiplyScalar(speed * dt / dist);
            this.mesh.position.x += _dir.x;
            this.mesh.position.z += _dir.z;
            // Face movement direction
            this.mesh.rotation.y = Math.atan2(_dir.x, _dir.z);
        }
    }

    private pickTarget() {
        const angle = Math.random() * Math.PI * 2;
        const dist  = 8 + Math.random() * 12;
        this.targetX = this.mesh.position.x + Math.sin(angle) * dist;
        this.targetZ = this.mesh.position.z + Math.cos(angle) * dist;
    }

    public getPosition() { return this.mesh.position; }
    
    // Apply damage to pedestrian
    public takeDamage(damage: number): boolean {
        if (this.isDead) return false;
        
        this.health -= damage;
        if (this.health <= 0) {
            this.health = 0;
            this.isDead = true;
            this.isAlive = false;
            // Simple death animation - fall down
            this.mesh.rotation.x = Math.PI / 2;
            this.mesh.position.y = 0.3;
            return true; // Killed
        }
        return false; // Damaged but alive
    }
}
