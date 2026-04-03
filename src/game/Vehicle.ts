import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Input } from './Input';
import { GamepadInput } from './Gamepad';
import { Sound } from './Sound';
import { VehicleDamage } from './VehicleDamage';

export class Vehicle {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;

    public chassisMesh: THREE.Group;
    public chassisBody: CANNON.Body;
    private vehicle: CANNON.RaycastVehicle;
    private wheelMeshes: THREE.Group[] = [];
    private taillightMats: THREE.MeshStandardMaterial[] = [];

    public isOccupied = false;
    public lateralSpeed = 0;

    private camYaw = Math.PI;
    private camPitch = 0.22;
    private readonly CAM_DIST = 11;
    private mouseIdleTimer = 0;
    private camShake = 0;

    // Gear simulation
    private gear = 1;
    private gearTimer = 0;
    private readonly GEAR_RATIOS = [0, 3.5, 2.1, 1.4, 1.0, 0.75, 0.6];
    private readonly MAX_GEAR = 6;

    private sound: Sound;
    private currentSteeringValue = 0;
    private speedBoostTimer = 0;
    private speedBoostMultiplier = 1;
    private damageSystem: VehicleDamage;

    constructor(
        scene: THREE.Scene,
        world: CANNON.World,
        camera: THREE.PerspectiveCamera,
        position: CANNON.Vec3,
        sound: Sound
    ) {
        this.sound  = sound;
        this.scene  = scene;
        this.camera = camera;

        const chassisShape = new CANNON.Box(new CANNON.Vec3(1.0, 0.3, 2.2));
        this.chassisBody = new CANNON.Body({ mass: 800, shape: chassisShape });
        this.chassisBody.position.copy(position);
        this.chassisBody.linearDamping  = 0.02;
        this.chassisBody.angularDamping = 0.35;
        world.addBody(this.chassisBody);

        this.chassisMesh = this.buildCarModel();
        this.scene.add(this.chassisMesh);

        this.vehicle = new CANNON.RaycastVehicle({
            chassisBody: this.chassisBody,
            indexForwardAxis: 2,
            indexRightAxis: 0,
            indexUpAxis: 1,
        });

        const base = {
            radius: 0.38,
            directionLocal: new CANNON.Vec3(0, -1, 0),
            suspensionStiffness: 30,
            suspensionRestLength: 0.6,
            frictionSlip: 12.0,
            dampingRelaxation: 2.2,
            dampingCompression: 4.5,
            maxSuspensionForce: 100000,
            rollInfluence: 0.02,
            axleLocal: new CANNON.Vec3(1, 0, 0),
            chassisConnectionPointLocal: new CANNON.Vec3(1, 1, 0),
            maxSuspensionTravel: 0.4,
            customSlidingFrictionWheelStep: 1,
        };

        [[-0.9,-0.28,1.55],[0.9,-0.28,1.55],[-0.9,-0.28,-1.55],[0.9,-0.28,-1.55]].forEach(p => {
            base.chassisConnectionPointLocal.set(p[0], p[1], p[2]);
            this.vehicle.addWheel({ ...base });
            const wm = this.buildWheelModel();
            this.wheelMeshes.push(wm);
            this.scene.add(wm);
        });

        this.vehicle.addToWorld(world);

        // Initialize damage system
        this.damageSystem = new VehicleDamage(this.chassisMesh, this.chassisBody);
    }

    private buildCarModel(): THREE.Group {
        const g = new THREE.Group();

        const paint = new THREE.MeshPhysicalMaterial({
            color: 0x2a4d8f, roughness: 0.2, metalness: 0.9,
            clearcoat: 1.0, clearcoatRoughness: 0.1
        });
        const glass = new THREE.MeshPhysicalMaterial({
            color: 0x001830, roughness: 0.0, metalness: 0.05,
            transparent: true, opacity: 0.55,
        });
        const chrome = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 1.0, roughness: 0.05 });
        const hlMat  = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffee, emissiveIntensity: 8 });
        const tlMat  = new THREE.MeshStandardMaterial({ color: 0xff2200, emissive: 0xff1100, emissiveIntensity: 3 });
        this.taillightMats.push(tlMat);

        // Main body — slightly tapered shape using scaled boxes
        const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.52, 4.6), paint);
        body.castShadow = true; g.add(body);

        // Hood slope
        const hood = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.18, 1.4), paint);
        hood.position.set(0, 0.32, 1.3); hood.rotation.x = 0.12;
        hood.castShadow = true; g.add(hood);

        // Cabin
        const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.5, 2.0), glass);
        cabin.position.set(0, 0.52, -0.1); g.add(cabin);

        const roof = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.07, 2.02), paint);
        roof.position.set(0, 0.78, -0.1); g.add(roof);

        // Side skirts
        [-1.01, 1.01].forEach(x => {
            const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 4.2), paint);
            skirt.position.set(x, -0.22, 0); g.add(skirt);
        });

        // Front bumper + grille
        const bumperF = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.22, 0.18), paint);
        bumperF.position.set(0, -0.16, 2.3); g.add(bumperF);
        const grille = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.06), chrome);
        grille.position.set(0, -0.05, 2.32); g.add(grille);

        // Rear bumper + diffuser
        const bumperR = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.22, 0.18), paint);
        bumperR.position.set(0, -0.16, -2.3); g.add(bumperR);
        const diffuser = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.12), chrome);
        diffuser.position.set(0, -0.28, -2.3); g.add(diffuser);

        // Headlights
        const hlL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.13, 0.06), hlMat);
        hlL.position.set(-0.62, 0.1, 2.32); g.add(hlL);
        const hlR = hlL.clone(); hlR.position.set(0.62, 0.1, 2.32); g.add(hlR);

        // Headlight beams
        [-0.62, 0.62].forEach(x => {
            const spot = new THREE.SpotLight(0xfff8e8, 8, 50, Math.PI / 8, 0.35, 1.2);
            spot.position.set(x, 0.1, 2.35);
            const tgt = new THREE.Object3D();
            tgt.position.set(x * 0.4, -0.8, 18);
            g.add(tgt); spot.target = tgt;
            spot.castShadow = false; g.add(spot);
        });

        // Taillights
        const tlL = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.13, 0.06), tlMat);
        tlL.position.set(-0.62, 0.1, -2.32); g.add(tlL);
        const tlR = tlL.clone(); tlR.position.set(0.62, 0.1, -2.32); g.add(tlR);

        // Exhaust pipes
        [-0.4, 0.4].forEach(x => {
            const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.2, 8), chrome);
            pipe.rotation.x = Math.PI / 2;
            pipe.position.set(x, -0.28, -2.38); g.add(pipe);
        });

        // Underglow
        const underglow = new THREE.PointLight(0x4400ff, 2.5, 8);
        underglow.position.set(0, -0.45, 0); g.add(underglow);

        return g;
    }

    private buildWheelModel(): THREE.Group {
        const g = new THREE.Group();
        const tire = new THREE.Mesh(
            new THREE.CylinderGeometry(0.38, 0.38, 0.28, 24),
            new THREE.MeshStandardMaterial({ color: 0x0d0d0d, roughness: 0.95 })
        );
        tire.rotation.z = Math.PI / 2; tire.castShadow = true; g.add(tire);

        // Rim with spokes feel
        const rim = new THREE.Mesh(
            new THREE.CylinderGeometry(0.26, 0.26, 0.3, 12),
            new THREE.MeshStandardMaterial({ color: 0xbbbbbb, metalness: 0.95, roughness: 0.1 })
        );
        rim.rotation.z = Math.PI / 2; g.add(rim);

        const hub = new THREE.Mesh(
            new THREE.CylinderGeometry(0.06, 0.06, 0.32, 8),
            new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 1.0, roughness: 0.05 })
        );
        hub.rotation.z = Math.PI / 2; g.add(hub);

        return g;
    }

    public update(dt: number) {
        const spd = this.getSpeedKmh();

        // Update speed boost
        if (this.speedBoostTimer > 0) {
            this.speedBoostTimer -= dt;
            this.speedBoostMultiplier = 2.0; // 2x speed boost
        } else {
            this.speedBoostMultiplier = 1.0;
        }

        // Gear logic
        this.gearTimer += dt;
        if (this.gearTimer > 0.4) {
            this.gearTimer = 0;
            if (spd > this.gear * 28 && this.gear < this.MAX_GEAR) this.gear++;
            else if (spd < (this.gear - 1) * 20 && this.gear > 1) this.gear--;
        }

        // Torque curve — peaks at mid-gear, falls off at top
        const gearRatio = this.GEAR_RATIOS[this.gear] ?? 1;
        const ENGINE_BASE = 4800;
        const ENGINE_FORCE = ENGINE_BASE * gearRatio * this.speedBoostMultiplier;
        const BRAKE_FORCE  = 200;
        const MAX_STEER = Math.max(0.15, 0.48 - spd * 0.003);
        const STEER_SPEED = 4.0;

        let force = 0, steer = 0, brake = 0;
        let handbrake = false, throttle = false;

        if (this.isOccupied) {
            if (Input.isKeyDown('w')) { force =  ENGINE_FORCE; throttle = true; }
            if (Input.isKeyDown('s')) { force = -ENGINE_FORCE * 0.45; }
            if (Input.isKeyDown('a')) steer =  MAX_STEER;
            if (Input.isKeyDown('d')) steer = -MAX_STEER;
            handbrake = Input.isKeyDown(' ');

            if (GamepadInput.connected) {
                if (GamepadInput.rt > 0.05) { force =  ENGINE_FORCE * GamepadInput.rt; throttle = true; }
                if (GamepadInput.lt > 0.05)   force = -ENGINE_FORCE * GamepadInput.lt * 0.45;
                if (Math.abs(GamepadInput.leftX) > 0.05) steer = -GamepadInput.leftX * MAX_STEER;
                if (GamepadInput.btnLB) handbrake = true;
            }

            const braking = Input.isKeyDown('s') || handbrake || (GamepadInput.connected && GamepadInput.lt > 0.1);
            this.taillightMats.forEach(m => m.emissiveIntensity = braking ? 10 : 3);

            this.sound.updateEngine(spd * gearRatio * 0.6, throttle);
            this.updateCamera(dt);
        } else {
            brake = 18;
            this.taillightMats.forEach(m => m.emissiveIntensity = 0.8);
        }

        // Lateral speed for drift
        const carFwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.chassisBody.quaternion as unknown as THREE.Quaternion);
        const vel = new THREE.Vector3(this.chassisBody.velocity.x, 0, this.chassisBody.velocity.z);
        const fwdSpd = vel.dot(carFwd);
        this.lateralSpeed = vel.clone().sub(carFwd.clone().multiplyScalar(fwdSpd)).length();

        // Smooth steering interpolation
        const targetSteer = steer;
        this.currentSteeringValue += (targetSteer - this.currentSteeringValue) * Math.min(1.0, STEER_SPEED * dt);
        
        this.vehicle.applyEngineForce(force, 2);
        this.vehicle.applyEngineForce(force, 3);
        this.vehicle.setSteeringValue(this.currentSteeringValue, 0);
        this.vehicle.setSteeringValue(this.currentSteeringValue, 1);

        if (handbrake) {
            // Enhanced handbrake for drifting
            this.vehicle.setBrake(0, 0); this.vehicle.setBrake(0, 1);
            this.vehicle.setBrake(BRAKE_FORCE * 6, 2); this.vehicle.setBrake(BRAKE_FORCE * 6, 3);
            // Reduce rear friction for drifting
            this.vehicle.wheelInfos[2].frictionSlip = 3.0;
            this.vehicle.wheelInfos[3].frictionSlip = 3.0;
        } else {
            for (let i = 0; i < 4; i++) this.vehicle.setBrake(brake, i);
            // Restore normal friction
            this.vehicle.wheelInfos[2].frictionSlip = 10.5;
            this.vehicle.wheelInfos[3].frictionSlip = 10.5;
        }

        this.chassisMesh.position.copy(this.chassisBody.position as unknown as THREE.Vector3);
        this.chassisMesh.quaternion.copy(this.chassisBody.quaternion as unknown as THREE.Quaternion);

        for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
            this.vehicle.updateWheelTransform(i);
            const t = this.vehicle.wheelInfos[i].worldTransform;
            this.wheelMeshes[i].position.copy(t.position as unknown as THREE.Vector3);
            this.wheelMeshes[i].quaternion.copy(t.quaternion as unknown as THREE.Quaternion);
        }
    }

    private updateCamera(dt: number) {
        if (Input.isPointerLocked && (Input.movementX !== 0 || Input.movementY !== 0)) {
            this.camYaw   -= Input.movementX * 0.0025;
            this.camPitch -= Input.movementY * 0.0025;
            this.camPitch  = Math.max(-0.08, Math.min(0.55, this.camPitch));
            this.mouseIdleTimer = 2.0;
        }
        if (GamepadInput.connected && (Math.abs(GamepadInput.rightX) > 0.05 || Math.abs(GamepadInput.rightY) > 0.05)) {
            this.camYaw   -= GamepadInput.rightX * 0.04;
            this.camPitch -= GamepadInput.rightY * 0.03;
            this.camPitch  = Math.max(-0.08, Math.min(0.55, this.camPitch));
            this.mouseIdleTimer = 2.0;
        }

        if (this.mouseIdleTimer > 0) {
            this.mouseIdleTimer -= dt;
        } else {
            const carFwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.chassisBody.quaternion as unknown as THREE.Quaternion);
            const targetYaw = Math.atan2(carFwd.x, carFwd.z) + Math.PI;
            let diff = targetYaw - this.camYaw;
            while (diff >  Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            this.camYaw += diff * 0.06;
        }

        // Speed-based camera distance
        const spd = this.getSpeedKmh();
        const dynDist = this.CAM_DIST + spd * 0.04;

        // Camera shake from bumps
        const upVel = Math.abs(this.chassisBody.velocity.y);
        this.camShake = Math.max(0, this.camShake + (upVel > 2 ? upVel * 0.015 : -dt * 2));
        const shake = (Math.random() - 0.5) * this.camShake * 0.04;

        const target = new THREE.Vector3(
            this.chassisMesh.position.x,
            this.chassisMesh.position.y + 1.1,
            this.chassisMesh.position.z
        );
        const cx = target.x + dynDist * Math.sin(this.camYaw) * Math.cos(this.camPitch);
        const cy = target.y + dynDist * Math.sin(this.camPitch) + shake;
        const cz = target.z + dynDist * Math.cos(this.camYaw) * Math.cos(this.camPitch);

        // Faster lerp at high speed
        const lerpT = Math.min(0.18, 0.08 + spd * 0.001);
        this.camera.position.lerp(new THREE.Vector3(cx, cy, cz), lerpT);
        this.camera.lookAt(target);
    }

    public getPosition() { return this.chassisMesh.position; }
    public getGear()     { return this.gear; }

    public getSpeedKmh(): number {
        const v = this.chassisBody.velocity;
        return Math.round(Math.sqrt(v.x * v.x + v.z * v.z) * 3.6);
    }

    public boostSpeed() {
        this.speedBoostTimer = 5.0; // 5 second boost
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
