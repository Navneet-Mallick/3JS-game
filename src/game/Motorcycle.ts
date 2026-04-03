import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Input } from './Input';
import { GamepadInput } from './Gamepad';
import { Sound } from './Sound';
import { VehicleDamage } from './VehicleDamage';

export class Motorcycle {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private sound: Sound;

    public chassisMesh: THREE.Group;
    public chassisBody: CANNON.Body;
    private vehicle: CANNON.RaycastVehicle;
    private wheelMeshes: THREE.Group[] = [];
    
    public isOccupied = false;
    private currentSteeringValue = 0;
    private speedBoostTimer = 0;
    private speedBoostMultiplier = 1;
    private damageSystem: VehicleDamage;

    // Motorcycle-specific physics
    private readonly MASS = 200; // Much lighter than cars
    private readonly MAX_SPEED = 200;
    private readonly ACCELERATION = 2.2; // Faster acceleration
    private readonly HANDLING = 2.0; // Better handling

    constructor(
        scene: THREE.Scene,
        world: CANNON.World,
        camera: THREE.PerspectiveCamera,
        position: CANNON.Vec3,
        sound: Sound
    ) {
        this.scene = scene;
        this.camera = camera;
        this.sound = sound;

        this.chassisBody = this.buildMotorcyclePhysics(position);
        world.addBody(this.chassisBody);

        this.chassisMesh = this.buildMotorcycleModel();
        this.scene.add(this.chassisMesh);

        this.vehicle = this.buildMotorcycleWheels(world);
        this.vehicle.addToWorld(world);

        // Initialize damage system
        this.damageSystem = new VehicleDamage(this.chassisMesh, this.chassisBody);
    }

    private buildMotorcyclePhysics(position: CANNON.Vec3): CANNON.Body {
        const chassisShape = new CANNON.Box(new CANNON.Vec3(0.8, 0.3, 1.8)); // Narrower and longer
        const body = new CANNON.Body({ 
            mass: this.MASS, 
            shape: chassisShape,
            position: position.clone(),
            linearDamping: 0.05, // Less damping for speed
            angularDamping: 0.8,
        });
        return body;
    }

    private buildMotorcycleModel(): THREE.Group {
        const group = new THREE.Group();

        // Main body (fuel tank and seat area)
        const bodyGeometry = new THREE.BoxGeometry(1.2, 0.4, 1.0);
        const bodyMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x1a1a1a, 
            metalness: 0.8, 
            roughness: 0.2 
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.5;
        body.castShadow = true;
        group.add(body);

        // Fuel tank
        const tankGeometry = new THREE.CylinderGeometry(0.3, 0.4, 0.8, 8);
        const tankMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x8b0000, // Dark red
            metalness: 0.7,
            roughness: 0.3
        });
        const tank = new THREE.Mesh(tankGeometry, tankMaterial);
        tank.rotation.z = Math.PI / 2;
        tank.position.set(0, 0.7, 0.2);
        group.add(tank);

        // Seat
        const seatGeometry = new THREE.BoxGeometry(0.6, 0.1, 0.4);
        const seatMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x2c1810, // Brown leather
            roughness: 0.8
        });
        const seat = new THREE.Mesh(seatGeometry, seatMaterial);
        seat.position.set(0, 0.8, -0.2);
        group.add(seat);

        // Handlebars
        const handlebarGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.8, 6);
        const handlebarMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x444444, 
            metalness: 0.9,
            roughness: 0.1
        });
        const handlebar = new THREE.Mesh(handlebarGeometry, handlebarMaterial);
        handlebar.position.set(0, 1.0, -0.6);
        handlebar.rotation.x = Math.PI / 2;
        group.add(handlebar);

        // Front fork
        const forkGeometry = new THREE.CylinderGeometry(0.04, 0.04, 0.8, 6);
        const forkMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x666666,
            metalness: 0.8,
            roughness: 0.2
        });
        const frontFork = new THREE.Mesh(forkGeometry, forkMaterial);
        frontFork.position.set(0, 0.3, -0.8);
        group.add(frontFork);

        // Rear suspension
        const rearFork = new THREE.Mesh(forkGeometry, forkMaterial);
        rearFork.position.set(0, 0.3, 0.8);
        group.add(rearFork);

        // Headlight
        const headlightGeometry = new THREE.CylinderGeometry(0.15, 0.12, 0.1, 8);
        const headlightMaterial = new THREE.MeshStandardMaterial({
            color: 0xcccccc,
            emissive: 0xffffcc,
            emissiveIntensity: 0.5
        });
        const headlight = new THREE.Mesh(headlightGeometry, headlightMaterial);
        headlight.position.set(0, 0.6, -0.9);
        headlight.rotation.x = Math.PI / 2;
        group.add(headlight);

        // Tail light
        const taillightGeometry = new THREE.BoxGeometry(0.3, 0.1, 0.05);
        const taillightMaterial = new THREE.MeshStandardMaterial({
            color: 0xff0000,
            emissive: 0xff0000,
            emissiveIntensity: 0.3
        });
        const taillight = new THREE.Mesh(taillightGeometry, taillightMaterial);
        taillight.position.set(0, 0.7, 0.9);
        group.add(taillight);

        // Engine block (visible part)
        const engineGeometry = new THREE.BoxGeometry(0.4, 0.3, 0.5);
        const engineMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            metalness: 0.7,
            roughness: 0.4
        });
        const engine = new THREE.Mesh(engineGeometry, engineMaterial);
        engine.position.set(0, 0.2, 0.3);
        group.add(engine);

        // Exhaust pipe
        const exhaustGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.6, 6);
        const exhaustMaterial = new THREE.MeshStandardMaterial({
            color: 0x444444,
            metalness: 0.6,
            roughness: 0.5
        });
        const exhaust = new THREE.Mesh(exhaustGeometry, exhaustMaterial);
        exhaust.position.set(-0.3, 0.1, 0.8);
        exhaust.rotation.z = Math.PI / 6;
        group.add(exhaust);

        return group;
    }

    private buildMotorcycleWheels(world: CANNON.World): CANNON.RaycastVehicle {
        const vehicle = new CANNON.RaycastVehicle({
            chassisBody: this.chassisBody,
            indexForwardAxis: 2,
            indexRightAxis: 0,
            indexUpAxis: 1,
        });

        // Motorcycle-specific wheel settings
        const wheelConfig = {
            radius: 0.25, // Smaller wheels
            directionLocal: new CANNON.Vec3(0, -1, 0),
            suspensionStiffness: 40, // Stiffer for better handling
            suspensionRestLength: 0.4,
            frictionSlip: 15.0, // High grip for motorcycles
            dampingRelaxation: 2.0,
            dampingCompression: 3.0,
            maxSuspensionForce: 80000,
            rollInfluence: 0.01, // Very little roll for motorcycles
            axleLocal: new CANNON.Vec3(1, 0, 0),
            chassisConnectionPointLocal: new CANNON.Vec3(1, 0.5, 0),
            maxSuspensionTravel: 0.3,
            customSlidingFrictionWheelStep: 1,
        };

        // Front wheel
        wheelConfig.chassisConnectionPointLocal.set(0, 0.3, -0.8);
        vehicle.addWheel({ ...wheelConfig });
        const frontWheel = this.buildMotorcycleWheel();
        this.wheelMeshes.push(frontWheel);
        this.scene.add(frontWheel);

        // Rear wheel (with chain drive)
        wheelConfig.chassisConnectionPointLocal.set(0, 0.3, 0.8);
        vehicle.addWheel({ ...wheelConfig });
        const rearWheel = this.buildMotorcycleWheel();
        this.wheelMeshes.push(rearWheel);
        this.scene.add(rearWheel);

        return vehicle;
    }

    private buildMotorcycleWheel(): THREE.Group {
        const wheelGroup = new THREE.Group();

        // Tire
        const tireGeometry = new THREE.TorusGeometry(0.25, 0.08, 8, 12);
        const tireMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a1a1a,
            roughness: 0.8
        });
        const tire = new THREE.Mesh(tireGeometry, tireMaterial);
        tire.rotation.x = Math.PI / 2;
        wheelGroup.add(tire);

        // Rim
        const rimGeometry = new THREE.CylinderGeometry(0.17, 0.17, 0.05, 12);
        const rimMaterial = new THREE.MeshStandardMaterial({
            color: 0x888888,
            metalness: 0.9,
            roughness: 0.1
        });
        const rim = new THREE.Mesh(rimGeometry, rimMaterial);
        rim.rotation.x = Math.PI / 2;
        wheelGroup.add(rim);

        // Spokes
        for (let i = 0; i < 8; i++) {
            const spokeGeometry = new THREE.CylinderGeometry(0.005, 0.005, 0.34, 4);
            const spokeMaterial = new THREE.MeshStandardMaterial({
                color: 0x666666,
                metalness: 0.8,
                roughness: 0.2
            });
            const spoke = new THREE.Mesh(spokeGeometry, spokeMaterial);
            const angle = (i / 8) * Math.PI * 2;
            spoke.position.set(Math.cos(angle) * 0.17, 0, Math.sin(angle) * 0.17);
            wheelGroup.add(spoke);
        }

        return wheelGroup;
    }

    public update(dt: number): void {
        const spd = this.getSpeedKmh();

        // Update speed boost
        if (this.speedBoostTimer > 0) {
            this.speedBoostTimer -= dt;
            this.speedBoostMultiplier = 2.0;
        } else {
            this.speedBoostMultiplier = 1.0;
        }

        // Motorcycle-specific controls
        let force = 0, steer = 0, brake = 0;
        let handbrake = false, throttle = false;

        if (this.isOccupied) {
            if (Input.isKeyDown('w')) { 
                force = 4000 * this.speedBoostMultiplier * this.ACCELERATION; 
                throttle = true; 
            }
            if (Input.isKeyDown('s')) { 
                force = -2000 * this.ACCELERATION * 0.5; 
            }
            if (Input.isKeyDown('a')) steer = 0.6 * this.HANDLING; // More responsive steering
            if (Input.isKeyDown('d')) steer = -0.6 * this.HANDLING;
            handbrake = Input.isKeyDown(' ');

            // Motorcycle-specific leaning
            if (Math.abs(steer) > 0.1) {
                const leanAngle = steer * 0.3; // Lean into turns
                this.chassisMesh.rotation.z = leanAngle;
            } else {
                this.chassisMesh.rotation.z *= 0.9; // Return to upright
            }

            if (GamepadInput.connected) {
                if (GamepadInput.rt > 0.05) { 
                    force = 4000 * GamepadInput.rt * this.speedBoostMultiplier * this.ACCELERATION; 
                    throttle = true; 
                }
                if (GamepadInput.lt > 0.05)   force = -2000 * GamepadInput.lt * this.ACCELERATION * 0.5;
                if (Math.abs(GamepadInput.leftX) > 0.05) steer = -GamepadInput.leftX * 0.6 * this.HANDLING;
                if (GamepadInput.btnLB) handbrake = true;
            }

            // Engine sound
            if (throttle && this.sound) {
                const gearRatio = 1.5; // Simplified for motorcycle
                this.sound.updateEngine(spd * gearRatio * 0.8, throttle);
            }

            this.updateCamera(dt);
        } else {
            brake = 10; // Light brake when not occupied
        }

        // Apply controls with motorcycle-specific physics
        this.vehicle.applyEngineForce(force, 0); // Front wheel
        this.vehicle.applyEngineForce(force * 1.2, 1); // Rear wheel gets more power

        this.vehicle.setSteeringValue(steer, 0); // Only front wheel steers
        this.vehicle.setSteeringValue(0, 1); // Rear wheel doesn't steer

        for (let i = 0; i < 2; i++) {
            this.vehicle.setBrake(brake, i);
        }

        // Update wheel meshes
        this.updateWheelMeshes();

        // Update damage system
        this.damageSystem.updateExplosionParticles(dt);
    }

    private updateWheelMeshes(): void {
        for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
            const wheelInfo = this.vehicle.wheelInfos[i];
            const wheelMesh = this.wheelMeshes[i];
            
            wheelMesh.position.set(
                wheelInfo.worldTransform.position.x,
                wheelInfo.worldTransform.position.y,
                wheelInfo.worldTransform.position.z
            );
            
            wheelMesh.quaternion.set(
                wheelInfo.worldTransform.quaternion.x,
                wheelInfo.worldTransform.quaternion.y,
                wheelInfo.worldTransform.quaternion.z,
                wheelInfo.worldTransform.quaternion.w
            );
        }
    }

    private updateCamera(dt: number): void {
        const target = new THREE.Vector3(
            this.chassisMesh.position.x,
            this.chassisMesh.position.y + 1.2, // Lower camera for motorcycle
            this.chassisMesh.position.z
        );

        const distance = 6; // Closer camera for motorcycle
        const height = 2.5;

        // Use mesh rotation instead of body quaternion
        const euler = this.chassisMesh.rotation;
        
        const cx = target.x + distance * Math.sin(euler.y) * Math.cos(-0.1);
        const cy = target.y + height * Math.sin(-0.1);
        const cz = target.z + distance * Math.cos(euler.y) * Math.cos(-0.1);

        this.camera.position.lerp(new THREE.Vector3(cx, cy, cz), 0.1);
        this.camera.lookAt(target);
    }

    public getPosition(): THREE.Vector3 {
        return this.chassisMesh.position;
    }

    public getSpeedKmh(): number {
        const v = this.chassisBody.velocity;
        return Math.round(Math.sqrt(v.x * v.x + v.z * v.z) * 3.6);
    }

    public boostSpeed(): void {
        this.speedBoostTimer = 3.0; // Shorter boost for motorcycle
    }

    public applyDamage(damage: number, impactPoint?: THREE.Vector3, impactForce?: number): boolean {
        return this.damageSystem.applyDamage(damage, impactPoint, impactForce);
    }

    public getDamageSystem(): VehicleDamage {
        return this.damageSystem;
    }

    public getDamageLevel(): string {
        return this.damageSystem.getDamageLevel();
    }

    public getHealthPercent(): number {
        return this.damageSystem.getHealthPercent();
    }
}
