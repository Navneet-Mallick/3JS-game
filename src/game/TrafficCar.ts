import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Input } from './Input';
import { TouchControls } from './TouchControls';
import { GamepadInput } from './Gamepad';

const COLORS = [0x8b0000, 0x003366, 0x1a4a1a, 0x4a3000, 0x2a0050, 0x444444, 0x660033];

// Road grid constants (must match City.ts)
const BLOCK = 60;
const ROAD  = 18;
const STEP  = BLOCK + ROAD;

/** Snap a world position to the nearest road centre-line */
function nearestRoadPoint(x: number, z: number): THREE.Vector3 {
    // Road centres are at multiples of STEP offset by -STEP/2
    const snapX = Math.round((x + STEP / 2) / STEP) * STEP - STEP / 2;
    const snapZ = Math.round((z + STEP / 2) / STEP) * STEP - STEP / 2;
    // Pick whichever axis is closer
    const dX = Math.abs(x - snapX);
    const dZ = Math.abs(z - snapZ);
    return dX < dZ
        ? new THREE.Vector3(snapX, 0, z)
        : new THREE.Vector3(x, 0, snapZ);
}

/** Pick a random road waypoint within the city grid */
function randomWaypoint(): THREE.Vector3 {
    const EXTENT = 3;
    const i = Math.floor(Math.random() * (EXTENT * 2 + 1)) - EXTENT;
    const axis = Math.random() > 0.5;
    const along = (Math.random() * (EXTENT * 2 + 1) - EXTENT) * STEP;
    const road = i * STEP - STEP / 2;
    return axis
        ? new THREE.Vector3(along, 0, road)
        : new THREE.Vector3(road, 0, along);
}

export class TrafficCar {
    public chassisBody: CANNON.Body;
    private chassisMesh: THREE.Group;
    private vehicle: CANNON.RaycastVehicle;
    private wheelMeshes: THREE.Group[] = [];

    private waypoint: THREE.Vector3;
    private stuckTimer = 0;
    private lastPos = new THREE.Vector3();
    public health = 100;
    public isDead = false;
    public isOccupied = false;
    public lateralSpeed = 0;

    // Camera and Input
    private camera: THREE.PerspectiveCamera | null = null;
    private camYaw = Math.PI;
    private camPitch = 0.28;
    private readonly CAM_DIST = 10;
    private mouseIdleTimer = 0;
    private gear = 1;
    private currentSteeringValue = 0;

    constructor(scene: THREE.Scene, world: CANNON.World, position: CANNON.Vec3) {
        const color = COLORS[Math.floor(Math.random() * COLORS.length)];

        const chassisShape = new CANNON.Box(new CANNON.Vec3(0.9, 0.3, 2.0));
        this.chassisBody = new CANNON.Body({ mass: 1000, shape: chassisShape });
        // Spawn high enough so wheels reach ground: wheel_radius(0.35) + rest(0.28) + half_height(0.3) ≈ 1.0
        this.chassisBody.position.set(position.x, position.y + 1.0, position.z);
        this.chassisBody.linearDamping  = 0.1;
        this.chassisBody.angularDamping = 0.6;
        this.chassisBody.quaternion.setFromEuler(0, Math.random() * Math.PI * 2, 0);
        world.addBody(this.chassisBody);

        this.chassisMesh = this.buildModel(color);
        scene.add(this.chassisMesh);

        this.vehicle = new CANNON.RaycastVehicle({
            chassisBody: this.chassisBody,
            indexForwardAxis: 2,
            indexRightAxis: 0,
            indexUpAxis: 1,
        });

        const wheelOpts = {
            radius: 0.35,
            directionLocal: new CANNON.Vec3(0, -1, 0),
            suspensionStiffness: 65,
            suspensionRestLength: 0.3,
            frictionSlip: 2.5,
            dampingRelaxation: 4.5,
            dampingCompression: 6.5,
            maxSuspensionForce: 100000,
            rollInfluence: 0.001,
            axleLocal: new CANNON.Vec3(1, 0, 0),
            chassisConnectionPointLocal: new CANNON.Vec3(1, 1, 0),
            maxSuspensionTravel: 0.2,
            customSlidingFrictionWheelStep: 1,
        };

        const wPos = [[-0.85,-0.1,1.4],[0.85,-0.1,1.4],[-0.85,-0.1,-1.4],[0.85,-0.1,-1.4]];
        wPos.forEach(p => {
            wheelOpts.chassisConnectionPointLocal.set(p[0], p[1], p[2]);
            this.vehicle.addWheel({ ...wheelOpts });
            const wm = this.buildWheel();
            this.wheelMeshes.push(wm);
            scene.add(wm);
        });

        this.vehicle.addToWorld(world);

        // Start with a road-snapped waypoint
        this.waypoint = nearestRoadPoint(position.x, position.z);
        this.lastPos.set(position.x, position.y + 1.0, position.z);
    }

    private buildModel(color: number): THREE.Group {
        const g = new THREE.Group();
        const paint = new THREE.MeshLambertMaterial({ color });
        const glass = new THREE.MeshLambertMaterial({ color: 0x223344, transparent: true, opacity: 0.5 });
        const hlMat = new THREE.MeshBasicMaterial({ color: 0xffffcc });
        const tlMat = new THREE.MeshBasicMaterial({ color: 0xff2200 });

        const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 4.0), paint);
        body.castShadow = false;
        g.add(body);

        const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.42, 1.9), glass);
        cabin.position.set(0, 0.46, -0.1);
        g.add(cabin);

        const hlL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.06), hlMat);
        hlL.position.set(-0.55, 0.06, 2.03);
        g.add(hlL);
        const hlR = hlL.clone(); hlR.position.set(0.55, 0.06, 2.03); g.add(hlR);

        const tlL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.06), tlMat);
        tlL.position.set(-0.55, 0.06, -2.03);
        g.add(tlL);
        const tlR = tlL.clone(); tlR.position.set(0.55, 0.06, -2.03); g.add(tlR);

        return g;
    }

    private buildWheel(): THREE.Group {
        const g = new THREE.Group();
        const tire = new THREE.Mesh(
            new THREE.CylinderGeometry(0.35, 0.35, 0.28, 8), // 8 segments instead of 16
            new THREE.MeshLambertMaterial({ color: 0x111111 })
        );
        tire.rotation.z = Math.PI / 2;
        g.add(tire);
        return g;
    }

    public initCamera(camera: THREE.PerspectiveCamera, yaw: number, pitch: number) {
        this.camera = camera;
        this.camYaw = yaw;
        this.camPitch = Math.max(0.05, Math.min(0.6, pitch));
        this.mouseIdleTimer = 0;
    }

    public update(dt: number) {
        if (this.isDead) {
            this.vehicle.applyEngineForce(0, 0);
            this.vehicle.applyEngineForce(0, 1);
            this.vehicle.applyEngineForce(0, 2);
            this.vehicle.applyEngineForce(0, 3);
            for (let i = 0; i < 4; i++) this.vehicle.setBrake(100, i);
            return;
        }

        const spd = this.getSpeedKmh();
        let force = 0, steer = 0, brake = 0;
        let handbrake = false;

        if (this.isOccupied && this.camera) {
            const ENGINE_FORCE = 3000;
            const MAX_STEER = Math.max(0.35, 0.7 - spd * 0.004);

            if (Input.isKeyDown('w') || Input.isKeyDown('arrowup')) { force = ENGINE_FORCE; }
            if (Input.isKeyDown('s') || Input.isKeyDown('arrowdown')) { force = -ENGINE_FORCE * 0.6; }
            if (Input.isKeyDown('a') || Input.isKeyDown('arrowleft')) steer = MAX_STEER;
            if (Input.isKeyDown('d') || Input.isKeyDown('arrowright')) steer = -MAX_STEER;
            handbrake = Input.isKeyDown(' ');
            brake = handbrake ? 3000 : 0;
            
            if (TouchControls.active) {
                if (TouchControls.gasPressed) { force = ENGINE_FORCE; }
                if (TouchControls.brakePressed) { force = -ENGINE_FORCE * 0.6; }
                if (Math.abs(TouchControls.moveX) > 0.1) steer = -TouchControls.moveX * MAX_STEER;
            }

            if (GamepadInput.connected) {
                if (GamepadInput.rt > 0.05) { force = ENGINE_FORCE * GamepadInput.rt; }
                if (GamepadInput.lt > 0.05) force = -ENGINE_FORCE * GamepadInput.lt * 0.6;
                if (Math.abs(GamepadInput.leftX) > 0.05) steer = -GamepadInput.leftX * MAX_STEER;
            }

            this.updateCamera(dt);
            this.currentSteeringValue += (steer - this.currentSteeringValue) * Math.min(1, 15 * dt);
            
            for (let i = 0; i < 4; i++) {
                this.vehicle.applyEngineForce(force, i);
                this.vehicle.setBrake(brake, i);
            }
            this.vehicle.setSteeringValue(this.currentSteeringValue, 0);
            this.vehicle.setSteeringValue(this.currentSteeringValue, 1);

            // Lateral speed for drift
            const carFwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.chassisBody.quaternion as any);
            const vel = new THREE.Vector3(this.chassisBody.velocity.x, 0, this.chassisBody.velocity.z);
            this.lateralSpeed = vel.clone().sub(carFwd.clone().multiplyScalar(vel.dot(carFwd))).length();

        } else {
            // AI control logic
            const pos = this.chassisBody.position;
            const curPos = new THREE.Vector3(pos.x, pos.y, pos.z);

            // Reached waypoint → pick next road waypoint
            const flatDist = new THREE.Vector2(pos.x - this.waypoint.x, pos.z - this.waypoint.z).length();
            if (flatDist < 8) {
                this.waypoint = randomWaypoint();
            }

            // Steering toward waypoint
            const toWP = new THREE.Vector3(this.waypoint.x - pos.x, 0, this.waypoint.z - pos.z).normalize();
            const carFwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.chassisBody.quaternion as any);
            const cross = carFwd.x * toWP.z - carFwd.z * toWP.x;
            const steerVal = Math.max(-0.45, Math.min(0.45, -cross * 1.8));

            const aiForce = spd < 11 ? 1200 : 0;

            this.vehicle.applyEngineForce(aiForce, 2);
            this.vehicle.applyEngineForce(aiForce, 3);
            this.vehicle.setSteeringValue(steerVal, 0);
            this.vehicle.setSteeringValue(steerVal, 1);
            for (let i = 0; i < 4; i++) this.vehicle.setBrake(0, i);
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

    public getPosition() { return this.chassisMesh.position; }
    public getSpeedKmh(): number {
        const v = this.chassisBody.velocity;
        return Math.round(Math.sqrt(v.x * v.x + v.z * v.z) * 3.6);
    }
    public getGear() { return this.gear; }

    private updateCamera(dt: number) {
        if (!this.camera) return;
        const input = Input; 
        if (Input.movementX !== 0 || Input.movementY !== 0) {
            this.camYaw -= Input.movementX * 0.003;
            this.camPitch -= Input.movementY * 0.003;
            this.camPitch = Math.max(0.05, Math.min(0.6, this.camPitch));
            this.mouseIdleTimer = 1.8;
        }

        if (this.mouseIdleTimer > 0) {
            this.mouseIdleTimer -= dt;
        } else {
            const carFwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.chassisBody.quaternion as any);
            const targetYaw = Math.atan2(carFwd.x, carFwd.z) + Math.PI;
            let diff = targetYaw - this.camYaw;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            this.camYaw += diff * Math.min(1, 3 * dt);
        }

        const dynDist = this.CAM_DIST + this.getSpeedKmh() * 0.05;
        const target = new THREE.Vector3(this.chassisMesh.position.x, this.chassisMesh.position.y + 1.2, this.chassisMesh.position.z);
        const pos = new THREE.Vector3(
            target.x + dynDist * Math.sin(this.camYaw) * Math.cos(this.camPitch),
            target.y + dynDist * Math.sin(this.camPitch),
            target.z + dynDist * Math.cos(this.camYaw) * Math.cos(this.camPitch)
        );
        this.camera.position.lerp(pos, 0.15);
        this.camera.lookAt(target);
    }

    public setVisible(v: boolean) {
        this.chassisMesh.visible = v;
        this.wheelMeshes.forEach(w => w.visible = v);
    }

    public resetPosition() {
        this.chassisBody.position.y += 2;
        this.chassisBody.velocity.set(0, 0, 0);
        this.chassisBody.angularVelocity.set(0, 0, 0);
        this.chassisBody.quaternion.set(0, 0, 0, 1);
    }

    public takeDamage(damage: number): boolean {
        if (this.isDead) return false;
        this.health -= damage;
        if (this.health <= 0) {
            this.isDead = true;
            this.health = 0;
            // Visual feedback for destroyed car
            this.chassisMesh.traverse((child) => {
                if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshLambertMaterial) {
                    child.material.color.setHex(0x333333); // Blacken the car
                }
            });
            return true;
        }
        return false;
    }
}
