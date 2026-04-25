import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Bomb {
    private mesh: THREE.Mesh;
    private body: CANNON.Body;
    private fuseTimer: number = 3.0; // 3 second fuse
    private isExploded: boolean = false;
    private explosionRadius: number = 20;
    private explosionForce: number = 2000;
    private sound: any;
    public onExplode: ((pos: THREE.Vector3) => void) | null = null;

    constructor(
        scene: THREE.Scene,
        world: CANNON.World,
        position: THREE.Vector3,
        sound: any
    ) {
        this.sound = sound;
        // Create bomb mesh
        const geometry = new THREE.SphereGeometry(0.3, 8, 8);
        const material = new THREE.MeshStandardMaterial({
            color: 0x1a1a1a,
            metalness: 0.9,
            roughness: 0.1
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(position);
        scene.add(this.mesh);

        // Create physics body
        const shape = new CANNON.Sphere(0.3);
        this.body = new CANNON.Body({
            mass: 1,
            shape: shape,
            position: new CANNON.Vec3(position.x, position.y, position.z)
        });
        this.body.linearDamping = 0.3;
        this.body.angularDamping = 0.3;
        world.addBody(this.body);
    }

    public update(dt: number, scene: THREE.Scene, world: CANNON.World): boolean {
        if (this.isExploded) return true;

        this.fuseTimer -= dt;

        // Pulsing effect as fuse burns
        const pulseIntensity = Math.sin(this.fuseTimer * 10) * 0.3 + 0.7;
        this.mesh.scale.setScalar(pulseIntensity);

        if (this.fuseTimer <= 0) {
            this.explode(scene, world);
            return true;
        }

        // Sync mesh to physics
        this.mesh.position.copy(this.body.position as unknown as THREE.Vector3);
        this.mesh.quaternion.copy(this.body.quaternion as unknown as THREE.Quaternion);

        return false;
    }

    private explode(scene: THREE.Scene, world: CANNON.World) {
        this.isExploded = true;
        if (this.sound) this.sound.playExplosion();

        const explosionPos = this.mesh.position.clone();
        if (this.onExplode) this.onExplode(explosionPos);

        // Create explosion effect
        const explosionGeometry = new THREE.IcosahedronGeometry(this.explosionRadius * 0.3, 4);
        const explosionMaterial = new THREE.MeshBasicMaterial({
            color: 0xff4400,
            transparent: true,
            opacity: 1
        });
        const explosion = new THREE.Mesh(explosionGeometry, explosionMaterial);
        explosion.position.copy(explosionPos);
        scene.add(explosion);

        // Animate explosion
        let scale = 0.5;
        let opacity = 1;
        const animate = () => {
            scale += 0.2;
            opacity -= 0.1;
            
            explosion.scale.setScalar(scale);
            (explosion.material as THREE.MeshBasicMaterial).opacity = opacity;
            
            if (opacity > 0) {
                requestAnimationFrame(animate);
            } else {
                scene.remove(explosion);
            }
        };
        animate();

        // Apply explosion force to nearby bodies
        const bodies = world.bodies;
        for (const body of bodies) {
            const bodyPos = body.position;
            const dist = Math.sqrt(
                (bodyPos.x - explosionPos.x) ** 2 +
                (bodyPos.y - explosionPos.y) ** 2 +
                (bodyPos.z - explosionPos.z) ** 2
            );

            if (dist < this.explosionRadius && dist > 0) {
                const force = this.explosionForce * (1 - dist / this.explosionRadius);
                const dirX = bodyPos.x - explosionPos.x;
                const dirY = bodyPos.y - explosionPos.y;
                const dirZ = bodyPos.z - explosionPos.z;
                const len = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ);
                
                body.applyImpulse(
                    new CANNON.Vec3(
                        (dirX / len) * force,
                        (dirY / len) * force * 0.5,
                        (dirZ / len) * force
                    ),
                    bodyPos
                );
            }
        }

        // Remove bomb
        world.removeBody(this.body);
        scene.remove(this.mesh);
    }

    public getPosition(): THREE.Vector3 {
        return this.mesh.position;
    }

    public isExplodedStatus(): boolean {
        return this.isExploded;
    }
}
