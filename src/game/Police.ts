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

        // Detect player
        if (distToPlayer < this.DETECTION_RANGE) {
            this.isChasing = true;
            this.chaseTimer = 0;
        }

        // Chase logic
        if (this.isChasing) {
            this.chaseTimer += dt;

            // Give up chase after timeout
            if (this.chaseTimer > this.CHASE_TIMEOUT) {
                this.isChasing = false;
                this.chaseTimer = 0;
            }

            // Chase the player - boost speed
            if (distToPlayer > 5) {
                const body = this.chassisBody;
                const vx = body.velocity.x;
                const vz = body.velocity.z;
                const spd = Math.sqrt(vx * vx + vz * vz);

                // Apply boosted force when chasing
                const force = spd < 15 ? 1800 * this.CHASE_SPEED_BOOST : 0;

                body.velocity.x *= 0.98; // Slight damping
                body.velocity.z *= 0.98;

                // Direction to player
                const direction = new THREE.Vector3()
                    .subVectors(playerPosition, policePos)
                    .normalize();

                // Add chase force
                body.velocity.x += direction.x * force * dt * 0.5;
                body.velocity.z += direction.z * force * dt * 0.5;

                // Limit max speed
                const newSpeed = Math.sqrt(body.velocity.x ** 2 + body.velocity.z ** 2);
                if (newSpeed > 45) {
                    const scale = 45 / newSpeed;
                    body.velocity.x *= scale;
                    body.velocity.z *= scale;
                }
            }
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
