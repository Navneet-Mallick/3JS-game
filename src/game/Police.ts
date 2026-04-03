import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Vehicle } from './Vehicle';
import { Sound } from './Sound';

export class Police {
    private scene: THREE.Scene;
    public vehicle: Vehicle;
    private targetPlayer: THREE.Vector3;
    private aggressiveMode = false;
    private sirenTimer = 0;
    private wanderTimer = 0;

    constructor(scene: THREE.Scene, world: CANNON.World, camera: THREE.PerspectiveCamera, position: CANNON.Vec3, sound: Sound) {
        this.scene = scene;
        this.targetPlayer = new THREE.Vector3();
        
        // Create a dummy sound object for police car
        const dummySound = sound || new Sound();
        
        this.vehicle = new Vehicle(scene, world, camera, position, dummySound);
        this.vehicle.isOccupied = true; // Police car is always "occupied" by AI
        
        // Make police car distinctive
        this.makePoliceCar();
        
        // Add siren lights
        this.addSirenLights();
    }

    private makePoliceCar() {
        // Change the car appearance to police colors
        const carGroup = this.vehicle.chassisMesh;
        carGroup.traverse((child) => {
            if (child instanceof THREE.Mesh && child.material) {
                const material = child.material as THREE.MeshStandardMaterial;
                if (material.color.getHex() === 0x2a4d8f) {
                    material.color.setHex(0x1a1a1a); // Black body
                    material.metalness = 0.3;
                    material.roughness = 0.7;
                }
            }
        });

        // Add police markings
        const stripeGeometry = new THREE.BoxGeometry(2.1, 0.01, 4.7);
        const stripeMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xffffff, 
            emissive: 0xffffff, 
            emissiveIntensity: 0.2 
        });
        const stripe = new THREE.Mesh(stripeGeometry, stripeMaterial);
        stripe.position.y = 0.3;
        stripe.position.z = 0.1;
        carGroup.add(stripe);

        // Add police text (simplified as colored rectangles)
        const doorGeometry = new THREE.BoxGeometry(0.8, 0.3, 0.01);
        const doorMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x0066cc, 
            emissive: 0x0066cc, 
            emissiveIntensity: 0.3 
        });
        
        const leftDoor = new THREE.Mesh(doorGeometry, doorMaterial);
        leftDoor.position.set(-0.6, 0.5, 1.0);
        leftDoor.rotation.y = Math.PI / 2;
        carGroup.add(leftDoor);

        const rightDoor = new THREE.Mesh(doorGeometry, doorMaterial);
        rightDoor.position.set(0.6, 0.5, 1.0);
        rightDoor.rotation.y = Math.PI / 2;
        carGroup.add(rightDoor);
    }

    private addSirenLights() {
        // Red siren light
        const redLight = new THREE.PointLight(0xff0000, 2, 20);
        redLight.position.set(0.8, 1.2, 1.5);
        this.vehicle.chassisMesh.add(redLight);

        // Blue siren light  
        const blueLight = new THREE.PointLight(0x0000ff, 2, 20);
        blueLight.position.set(-0.8, 1.2, 1.5);
        this.vehicle.chassisMesh.add(blueLight);
    }

    public update(dt: number, playerPosition: THREE.Vector3, playerInVehicle: boolean, wantedLevel: number) {
        this.targetPlayer = playerPosition;
        
        // Animate siren lights
        this.sirenTimer += dt;
        const sirenPhase = Math.sin(this.sirenTimer * 10);
        
        // Update siren lights
        this.vehicle.chassisMesh.traverse((child) => {
            if (child instanceof THREE.PointLight) {
                child.intensity = sirenPhase > 0 ? 2 : 0.1;
            }
        });
        
        // Simple AI behavior - just update vehicle
        this.vehicle.update(dt);
        
        // Basic pursuit AI - move towards player if wanted
        if (wantedLevel > 0) {
            this.moveTowardsPlayer(playerPosition, wantedLevel);
        }
    }

    private moveTowardsPlayer(playerPosition: THREE.Vector3, wantedLevel: number) {
        const currentPos = this.vehicle.getPosition();
        const direction = playerPosition.clone().sub(currentPos).normalize();
        const distance = currentPos.distanceTo(playerPosition);
        
        if (distance > 10) {
            // Apply force towards player (simplified physics)
            const forceMagnitude = wantedLevel * 500;
            this.vehicle.chassisBody.applyImpulse(
                new CANNON.Vec3(direction.x * forceMagnitude, 0, direction.z * forceMagnitude),
                new CANNON.Vec3(0, 0, 0)
            );
        }
    }

    public getPosition(): THREE.Vector3 {
        return this.vehicle.getPosition();
    }

    public getSpeedKmh(): number {
        return this.vehicle.getSpeedKmh();
    }
}
