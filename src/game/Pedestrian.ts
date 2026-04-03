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
        
        // Body
        const bodyGeometry = new THREE.CylinderGeometry(0.3, 0.4, 0.8, 8);
        const bodyMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x2a4d8f, // Blue shirt
            roughness: 0.7
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.8;
        body.castShadow = true;
        group.add(body);

        // Head
        const headGeometry = new THREE.SphereGeometry(0.25, 8, 8);
        const headMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xf4c2a1, // Skin tone
            roughness: 0.8
        });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 1.4;
        head.castShadow = true;
        group.add(head);

        // Legs
        const legGeometry = new THREE.CylinderGeometry(0.1, 0.12, 0.6, 6);
        const legMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x1a1a1a, // Dark pants
            roughness: 0.9
        });
        
        const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
        leftLeg.position.set(-0.15, 0.2, 0);
        leftLeg.castShadow = true;
        group.add(leftLeg);

        const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
        rightLeg.position.set(0.15, 0.2, 0);
        rightLeg.castShadow = true;
        group.add(rightLeg);

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
