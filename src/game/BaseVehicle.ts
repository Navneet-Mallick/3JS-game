import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Input } from './Input';
import { Sound } from './Sound';
import { TouchControls } from './TouchControls';
import { events, GameEvents } from './Events';

export interface VehicleStats {
    name: string;
    mass: number;
    engineForce: number;
    maxSteer: number;
    maxSpeed: number;
    brakingForce: number;
    maxHealth: number;
    suspensionStiffness: number;
}

/**
 * BaseVehicle — The parent class for all drivable machines.
 * Handles physics, input, and basic state.
 */
export abstract class BaseVehicle {
    protected scene: THREE.Scene;
    protected world: CANNON.World;
    protected camera: THREE.PerspectiveCamera;
    protected sound: Sound;

    public chassisMesh!: THREE.Group;
    public chassisBody!: CANNON.Body;
    public vehicle!: CANNON.RaycastVehicle;
    protected wheelMeshes: THREE.Group[] = [];

    public isOccupied = false;
    public health: number;
    public stats: VehicleStats;

    // Camera state
    protected camYaw = Math.PI;
    protected camPitch = 0.28;
    protected readonly CAM_DIST = 10;

    protected smokeParticles: THREE.Group;

    constructor(
        scene: THREE.Scene,
        world: CANNON.World,
        camera: THREE.PerspectiveCamera,
        position: CANNON.Vec3,
        sound: Sound,
        stats: VehicleStats
    ) {
        this.scene = scene;
        this.world = world;
        this.camera = camera;
        this.sound = sound;
        this.stats = stats;
        this.health = stats.maxHealth;

        this.smokeParticles = new THREE.Group();
        this.scene.add(this.smokeParticles);

        this.initPhysics(position);
        this.initModel();
    }

    protected abstract initPhysics(position: CANNON.Vec3): void;
    protected abstract initModel(): void;

    public update(dt: number) {
        this.updateDamageEffects(dt);
        
        if (!this.isOccupied) {
            this.applyBrakes(100);
            this.syncMeshes();
            return;
        }

        this.handleInput(dt);
        this.updateCamera(dt);
        this.syncMeshes();
    }

    protected updateDamageEffects(dt: number) {
        if (this.health < this.stats.maxHealth * 0.5) {
            // Spawn smoke particle
            const p = new THREE.Mesh(
                new THREE.SphereGeometry(0.1 + Math.random() * 0.2),
                new THREE.MeshBasicMaterial({ 
                    color: this.health < this.stats.maxHealth * 0.25 ? 0x222222 : 0x888888, 
                    transparent: true, 
                    opacity: 0.5 
                })
            );
            p.position.copy(this.chassisBody.position as any).add(new THREE.Vector3(0, 0.5, 0));
            this.smokeParticles.add(p);
            
            // Move and fade particles
            this.smokeParticles.children.forEach((child: any) => {
                child.position.y += dt * 2;
                child.scale.multiplyScalar(1.02);
                child.material.opacity -= dt * 0.5;
                if (child.material.opacity <= 0) {
                    this.smokeParticles.remove(child);
                }
            });
        }
    }

    protected handleInput(dt: number) {
        const force = (Input.isKeyDown('w') || TouchControls.gasPressed) ? this.stats.engineForce : 
                      (Input.isKeyDown('s') || TouchControls.brakePressed) ? -this.stats.engineForce / 2 : 0;
        
        const steer = (Input.isKeyDown('a') || TouchControls.moveX < -0.1) ? this.stats.maxSteer :
                      (Input.isKeyDown('d') || TouchControls.moveX > 0.1) ? -this.stats.maxSteer : 0;

        this.applyEngineForce(force);
        this.setSteering(steer);
    }

    protected applyEngineForce(force: number) {
        // Simple implementation — children can override for 4WD vs RWD
        this.vehicle.applyEngineForce(force, 2);
        this.vehicle.applyEngineForce(force, 3);
    }

    protected setSteering(value: number) {
        this.vehicle.setSteeringValue(value, 0);
        this.vehicle.setSteeringValue(value, 1);
    }

    protected applyBrakes(force: number) {
        for (let i = 0; i < 4; i++) this.vehicle.setBrake(force, i);
    }

    public takeDamage(amount: number) {
        this.health -= amount;
        if (this.health <= 0) this.explode();
        
        // Visual feedback (smoke/fire could be added here)
        if (this.chassisMesh) {
            this.chassisMesh.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    (child.material as any).color?.multiplyScalar(0.9);
                }
            });
        }
    }

    protected explode() {
        this.sound.playExplosion();
        events.emit(GameEvents.CRIME_COMMITTED, { level: 3 });
        // Handled by Core usually, but we could trigger physics impulses here
    }

    protected syncMeshes() {
        this.chassisMesh.position.copy(this.chassisBody.position as any);
        this.chassisMesh.quaternion.copy(this.chassisBody.quaternion as any);

        for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
            this.vehicle.updateWheelTransform(i);
            const t = this.vehicle.wheelInfos[i].worldTransform;
            this.wheelMeshes[i].position.copy(t.position as any);
            this.wheelMeshes[i].quaternion.copy(t.quaternion as any);
        }
    }

    protected abstract updateCamera(dt: number): void;

    public getPosition() { return this.chassisBody.position; }
    
    public getSpeedKmh(): number {
        return Math.floor(this.chassisBody.velocity.length() * 3.6);
    }

    public setVisible(v: boolean) {
        this.chassisMesh.visible = v;
        this.wheelMeshes.forEach(w => w.visible = v);
    }
}
