import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { TrafficCar } from './TrafficCar';

export class Police extends TrafficCar {
    private isChasing = false;
    private chaseTimer = 0;
    private readonly CHASE_TIMEOUT = 30; // seconds before giving up chase
    private readonly DETECTION_RANGE = 80;
    private readonly CHASE_SPEED_BOOST = 1.5;

    constructor(
        scene: THREE.Scene,
        world: CANNON.World,
        position: CANNON.Vec3
    ) {
        super(scene, world, position);
        this.customizePoliceAppearance();
    }

    private customizePoliceAppearance() {
        // Make police car blue and white
        const mesh = (this as any).chassisMesh as THREE.Group;
        if (mesh) {
            mesh.traverse((child: THREE.Object3D) => {
                if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshLambertMaterial) {
                    const mat = child.material as THREE.MeshLambertMaterial;
                    // First mesh is body - make it blue
                    if (mat.color.getHex() !== 0x223344 && mat.color.getHex() !== 0xffffcc && mat.color.getHex() !== 0xff2200) {
                        mat.color.setHex(0x0033ff); // Police blue
                    }
                }
            });
        }
    }

    public update(dt: number, playerPosition?: THREE.Vector3, isWanted?: boolean) {
        // Call parent update for normal traffic behavior
        super.update(dt);

        // Only use AI logic if NOT occupied by player
        if (!this.isOccupied) {
            // If player position provided and player is wanted, chase
            if (playerPosition && isWanted) {
                this.updateChase(dt, playerPosition);
            } else if (this.isChasing) {
                // Stop chasing if player is no longer wanted
                this.stopChase();
            }
        }
    }

    private updateChase(dt: number, playerPosition: THREE.Vector3) {
        const policePos = this.getPosition();
        const distToPlayer = policePos.distanceTo(playerPosition);

        if (distToPlayer < this.DETECTION_RANGE) {
            this.isChasing = true;
            this.chaseTimer = 0;
        }

        if (this.isChasing) {
            this.chaseTimer += dt;
            if (this.chaseTimer > this.CHASE_TIMEOUT) {
                this.stopChase();
                return;
            }

            const targetPos = playerPosition;
            const myPos = this.getPosition();
            
            const toTarget = new THREE.Vector3().subVectors(targetPos, myPos).normalize();
            const myFwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.chassisBody.quaternion as any);
            const cross = myFwd.x * toTarget.z - myFwd.z * toTarget.x;
            const steer = Math.max(-0.6, Math.min(0.6, -cross * 2.5));
            
            const currentSpeed = this.getSpeedKmh();
            const force = currentSpeed < 50 ? 2500 : 0;
            
            this.currentSteeringValue = steer;
            for (let i = 0; i < 4; i++) {
                this.vehicle.applyEngineForce(force, i);
                this.vehicle.setBrake(distToPlayer < 6 ? 1000 : 0, i);
            }
            this.vehicle.setSteeringValue(steer, 0);
            this.vehicle.setSteeringValue(steer, 1);
        }
    }

    public isChasing_(): boolean {
        return this.isChasing;
    }

    public stopChase() {
        this.isChasing = false;
        this.chaseTimer = 0;
    }
}
