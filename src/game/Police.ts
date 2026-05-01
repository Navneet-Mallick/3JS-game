import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { TrafficCar } from './TrafficCar';

// Pre-alloc to avoid per-frame GC
const _toTarget = new THREE.Vector3();
const _myFwd    = new THREE.Vector3();

export class Police extends TrafficCar {
    private isChasing     = false;
    private chaseTimer    = 0;
    private shootTimer    = 0;
    private sirensOn      = false;
    private sirenFlash    = 0;
    private sirenMeshes: THREE.Mesh[] = [];

    private readonly CHASE_TIMEOUT   = 30;
    private readonly DETECTION_RANGE = 100;  // increased from 80
    private readonly SHOOT_RANGE     = 25;
    private readonly SHOOT_INTERVAL  = 1.2;  // seconds between shots

    // Callback for when police shoots player (set by Core)
    public onShoot: ((damage: number) => void) | null = null;

    constructor(scene: THREE.Scene, world: CANNON.World, position: CANNON.Vec3) {
        super(scene, world, position);
        this.customizePoliceAppearance();
    }

    private customizePoliceAppearance() {
        const mesh = (this as any).chassisMesh as THREE.Group;
        if (!mesh) return;
        mesh.traverse((child: THREE.Object3D) => {
            if (!(child instanceof THREE.Mesh)) return;
            const mat = child.material as THREE.MeshLambertMaterial;
            if (!mat) return;
            const hex = mat.color.getHex();
            // Only repaint body panels, not glass/lights
            if (hex !== 0x223344 && hex !== 0xffffcc && hex !== 0xff2200) {
                // Checker-style: alternate blue / white based on mesh index
                const idx = mesh.children.indexOf(child);
                mat.color.setHex(idx % 2 === 0 ? 0x003399 : 0xffffff);
            }
        });

        // Add siren lights on roof
        const sirenGeo = new THREE.BoxGeometry(0.3, 0.18, 0.6);
        const sirenMatR = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const sirenMatB = new THREE.MeshBasicMaterial({ color: 0x0044ff });
        const sirenR = new THREE.Mesh(sirenGeo, sirenMatR);
        const sirenB = new THREE.Mesh(sirenGeo, sirenMatB);
        sirenR.position.set(-0.35, 0.78, 0.2);
        sirenB.position.set( 0.35, 0.78, 0.2);
        mesh.add(sirenR, sirenB);
        this.sirenMeshes = [sirenR, sirenB];
    }

    public update(dt: number, playerPosition?: THREE.Vector3, isWanted?: boolean) {
        super.update(dt);

        if (this.isOccupied || this.isDead) return;

        if (playerPosition && isWanted) {
            this.updateChase(dt, playerPosition);
        } else if (this.isChasing) {
            this.stopChase();
        }

        // Siren flash
        if (this.isChasing) {
            this.sirenFlash += dt * 5;
            const on = Math.sin(this.sirenFlash) > 0;
            if (this.sirenMeshes[0]) (this.sirenMeshes[0].material as THREE.MeshBasicMaterial).color.setHex(on ? 0xff2200 : 0x330000);
            if (this.sirenMeshes[1]) (this.sirenMeshes[1].material as THREE.MeshBasicMaterial).color.setHex(on ? 0x0044ff : 0x000033);
        } else {
            if (this.sirenMeshes[0]) (this.sirenMeshes[0].material as THREE.MeshBasicMaterial).color.setHex(0x330000);
            if (this.sirenMeshes[1]) (this.sirenMeshes[1].material as THREE.MeshBasicMaterial).color.setHex(0x000033);
        }
    }

    private updateChase(dt: number, playerPos: THREE.Vector3) {
        const myPos  = this.getPosition();
        const dist   = myPos.distanceTo(playerPos);

        // Enter/stay in chase if close enough
        if (dist < this.DETECTION_RANGE) {
            this.isChasing = true;
            this.chaseTimer = 0; // reset timeout while in range
        }

        if (!this.isChasing) return;

        this.chaseTimer += dt;
        if (this.chaseTimer > this.CHASE_TIMEOUT) {
            this.stopChase();
            return;
        }

        // ─── Steering toward player (better intercept) ────────────────────────
        // Aim slightly ahead of the player (future position)
        const spd = this.getSpeedKmh();

        _toTarget.subVectors(playerPos, myPos).normalize();
        _myFwd.set(0, 0, 1).applyQuaternion(this.chassisBody.quaternion as any);
        const cross = _myFwd.x * _toTarget.z - _myFwd.z * _toTarget.x;

        // Aggressive steering — clamp to ±0.7
        const steer = Math.max(-0.7, Math.min(0.7, -cross * 3.0));

        // Force: chase aggressively up to 70 km/h, then coast
        const force = spd < 70 ? 3200 : spd < 80 ? 800 : 0;

        // Hard brake when very close
        const brake = dist < 5 ? 2000 : 0;

        this.currentSteeringValue += (steer - this.currentSteeringValue) * Math.min(1, 10 * dt);
        for (let i = 0; i < 4; i++) {
            this.vehicle.applyEngineForce(force, i);
            this.vehicle.setBrake(brake, i);
        }
        this.vehicle.setSteeringValue(this.currentSteeringValue, 0);
        this.vehicle.setSteeringValue(this.currentSteeringValue, 1);

        // ─── Shoot at player when in range ────────────────────────────────────
        this.shootTimer -= dt;
        if (dist < this.SHOOT_RANGE && this.shootTimer <= 0) {
            this.shootTimer = this.SHOOT_INTERVAL;
            if (this.onShoot) this.onShoot(8); // 8 damage per shot
        }
    }

    public isChasing_() { return this.isChasing; }

    public stopChase() {
        this.isChasing  = false;
        this.chaseTimer = 0;
    }
}
