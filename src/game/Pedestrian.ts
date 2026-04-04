import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Input } from './Input';

export class Pedestrian {
    private scene: THREE.Scene;
    private body: CANNON.Body;
    public mesh: THREE.Group;
    
    private walkSpeed = 2.5;
    private runSpeed = 5.0;
    private currentSpeed = 0;
    private targetPosition: THREE.Vector3;
    private wanderTimer = 0;
    private health = 100;
    private isAlive = true;

    constructor(scene: THREE.Scene, world: CANNON.World, position: THREE.Vector3) {
        this.scene = scene;
        this.targetPosition = position.clone();
        
        this.mesh = this.buildPedestrianModel();
        this.mesh.position.copy(position);
        this.scene.add(this.mesh);

        this.body = new CANNON.Body({
            mass: 70,
            shape: new CANNON.Sphere(0.4),
            position: new CANNON.Vec3(position.x, position.y, position.z),
            fixedRotation: true,
            linearDamping: 0.8,
            angularDamping: 1.0,
        });
        world.addBody(this.body);
    }

    private buildPedestrianModel(): THREE.Group {
        const group = new THREE.Group();
        const bodyMat = new THREE.MeshLambertMaterial({ color: 0x2a4d8f });
        const headMat = new THREE.MeshLambertMaterial({ color: 0xf4c2a1 });
        const legMat  = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });

        // Body — box instead of cylinder (cheaper)
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.3), bodyMat);
        body.position.y = 0.8;
        group.add(body);

        // Head — box instead of sphere (cheaper)
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), headMat);
        head.position.y = 1.45;
        group.add(head);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.18, 0.55, 0.18);
        const lLeg = new THREE.Mesh(legGeo, legMat);
        lLeg.position.set(-0.14, 0.22, 0);
        group.add(lLeg);
        const rLeg = new THREE.Mesh(legGeo, legMat);
        rLeg.position.set(0.14, 0.22, 0);
        group.add(rLeg);

        return group;
    }

    public update(dt: number, playerPosition: THREE.Vector3) {
        if (!this.isAlive) return;

        // Wander behavior
        this.wanderTimer -= dt;
        if (this.wanderTimer <= 0) {
            this.wanderTimer = Math.random() * 4 + 2; // 2-6 seconds
            this.setNewTarget();
        }

        // Check distance to player
        const distanceToPlayer = this.mesh.position.distanceTo(playerPosition);
        
        // Run away from player if too close
        if (distanceToPlayer < 5) {
            const fleeDirection = this.mesh.position.clone().sub(playerPosition).normalize();
            this.targetPosition = this.mesh.position.clone().add(fleeDirection.multiplyScalar(10));
            this.currentSpeed = this.runSpeed;
        } else {
            this.currentSpeed = this.walkSpeed;
        }

        // Move towards target
        const direction = this.targetPosition.clone().sub(this.mesh.position).normalize();
        if (direction.length() > 0.1) {
            this.body.velocity.x = direction.x * this.currentSpeed;
            this.body.velocity.z = direction.z * this.currentSpeed;
            
            // Rotate to face movement direction
            const targetY = Math.atan2(direction.x, direction.z);
            this.mesh.rotation.y += (targetY - this.mesh.rotation.y) * 0.1;
        }

        // Sync physics with mesh
        this.mesh.position.set(
            this.body.position.x,
            this.body.position.y - 0.4,
            this.body.position.z
        );
    }

    private setNewTarget() {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * 15 + 5;
        this.targetPosition = new THREE.Vector3(
            this.mesh.position.x + Math.sin(angle) * distance,
            this.mesh.position.y,
            this.mesh.position.z + Math.cos(angle) * distance
        );
    }

    public takeDamage(damage: number) {
        this.health -= damage;
        if (this.health <= 0 && this.isAlive) {
            this.isAlive = false;
            this.mesh.visible = false;
            // Ragdoll effect could be added here
        }
    }

    public getPosition(): THREE.Vector3 {
        return this.mesh.position;
    }

    public isAliveStatus(): boolean {
        return this.isAlive;
    }
}
