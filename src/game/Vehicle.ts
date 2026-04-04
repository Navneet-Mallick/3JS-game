import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Input } from './Input';
import { GamepadInput } from './Gamepad';
import { Sound } from './Sound';

// ── Pre-allocated — zero per-frame heap allocations ──────────────────────────
const _carFwd    = new THREE.Vector3();
const _vel       = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _camPos    = new THREE.Vector3();

export class Vehicle {
    private scene:  THREE.Scene;
    private camera: THREE.PerspectiveCamera;

    public  chassisMesh: THREE.Group;
    public  chassisBody: CANNON.Body;
    private vehicle:     CANNON.RaycastVehicle;
    private wheelMeshes: THREE.Group[] = [];
    private taillightMats: THREE.MeshLambertMaterial[] = [];

    public isOccupied   = false;
    public lateralSpeed = 0;

    // Camera
    private camYaw         = Math.PI;
    private camPitch       = 0.28;
    private readonly CAM_DIST = 10;
    private mouseIdleTimer = 0;

    // Gear
    private gear      = 1;
    private gearTimer = 0;
    private readonly GEAR_RATIOS = [0, 2.8, 1.8, 1.2, 0.9, 0.7, 0.55];
    private readonly MAX_GEAR    = 6;

    private sound: Sound;
    private currentSteeringValue = 0;
    private speedBoostTimer      = 0;
    private speedBoostMultiplier = 1;

    constructor(
        scene:    THREE.Scene,
        world:    CANNON.World,
        camera:   THREE.PerspectiveCamera,
        position: CANNON.Vec3,
        sound:    Sound
    ) {
        this.sound  = sound;
        this.scene  = scene;
        this.camera = camera;

        // Chassis — spawn y = wheel_radius(0.38) + suspension_rest(0.35) + half_height(0.3) + margin = 1.2
        const chassisShape = new CANNON.Box(new CANNON.Vec3(1.0, 0.3, 2.2));
        this.chassisBody = new CANNON.Body({ mass: 1200, shape: chassisShape });
        this.chassisBody.position.set(position.x, position.y + 1.2, position.z);
        this.chassisBody.linearDamping  = 0.05;
        this.chassisBody.angularDamping = 0.6;
        world.addBody(this.chassisBody);

        this.chassisMesh = this.buildCarModel();
        this.scene.add(this.chassisMesh);

        this.vehicle = new CANNON.RaycastVehicle({
            chassisBody:      this.chassisBody,
            indexForwardAxis: 2,
            indexRightAxis:   0,
            indexUpAxis:      1,
        });

        const wheelOpts = {
            radius:                      0.38,
            directionLocal:              new CANNON.Vec3(0, -1, 0),
            suspensionStiffness:         35,
            suspensionRestLength:        0.35,
            frictionSlip:                2.5,
            dampingRelaxation:           2.3,
            dampingCompression:          4.4,
            maxSuspensionForce:          80000,
            rollInfluence:               0.01,
            axleLocal:                   new CANNON.Vec3(1, 0, 0),
            chassisConnectionPointLocal: new CANNON.Vec3(1, 1, 0),
            maxSuspensionTravel:         0.3,
            customSlidingFrictionWheelStep: 1,
        };

        const wPos = [[-0.95,-0.1,1.5],[0.95,-0.1,1.5],[-0.95,-0.1,-1.5],[0.95,-0.1,-1.5]];
        wPos.forEach(([x, y, z]) => {
            wheelOpts.chassisConnectionPointLocal.set(x, y, z);
            this.vehicle.addWheel({ ...wheelOpts });
            const wm = this.buildWheelModel();
            this.wheelMeshes.push(wm);
            this.scene.add(wm);
        });

        this.vehicle.addToWorld(world);
    }

    // ── Car model ─────────────────────────────────────────────────────────────
    private buildCarModel(): THREE.Group {
        const g     = new THREE.Group();
        const paint = new THREE.MeshLambertMaterial({ color: 0xcc2200 });
        const glass = new THREE.MeshLambertMaterial({ color: 0x223344, transparent: true, opacity: 0.45 });
        const dark  = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const hlMat = new THREE.MeshBasicMaterial({ color: 0xffffcc });
        const tlMat = new THREE.MeshLambertMaterial({ color: 0xff2200, emissive: new THREE.Color(0xff1100) });
        this.taillightMats.push(tlMat);

        const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x=0, y=0, z=0, rx=0) => {
            const m = new THREE.Mesh(geo, mat);
            m.position.set(x, y, z);
            if (rx) m.rotation.x = rx;
            g.add(m);
            return m;
        };

        add(new THREE.BoxGeometry(2.0, 0.55, 4.6), paint);                        // body
        add(new THREE.BoxGeometry(1.96, 0.16, 1.4), paint, 0, 0.34, 1.3, 0.1);   // hood
        add(new THREE.BoxGeometry(1.7, 0.52, 2.0),  glass, 0, 0.54, -0.1);       // cabin
        add(new THREE.BoxGeometry(1.72, 0.07, 2.02), paint, 0, 0.80, -0.1);      // roof
        add(new THREE.BoxGeometry(2.0, 0.22, 0.18),  dark,  0, -0.14, 2.3);      // front bumper
        add(new THREE.BoxGeometry(2.0, 0.22, 0.18),  dark,  0, -0.14, -2.3);     // rear bumper
        // Headlights
        const hlL = add(new THREE.BoxGeometry(0.5, 0.13, 0.06), hlMat, -0.62, 0.1, 2.32);
        const hlR = hlL.clone(); hlR.position.set(0.62, 0.1, 2.32); g.add(hlR);
        // Taillights
        const tlL = add(new THREE.BoxGeometry(0.55, 0.13, 0.06), tlMat, -0.62, 0.1, -2.32);
        const tlR = tlL.clone(); tlR.position.set(0.62, 0.1, -2.32); g.add(tlR);

        return g;
    }

    // Shared wheel geometry/material — created once
    private static _tireGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 10);
    private static _rimGeo  = new THREE.CylinderGeometry(0.22, 0.22, 0.30, 8);
    private static _tireMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    private static _rimMat  = new THREE.MeshLambertMaterial({ color: 0xaaaaaa });

    private buildWheelModel(): THREE.Group {
        const g    = new THREE.Group();
        const tire = new THREE.Mesh(Vehicle._tireGeo, Vehicle._tireMat);
        tire.rotation.z = Math.PI / 2; g.add(tire);
        const rim = new THREE.Mesh(Vehicle._rimGeo, Vehicle._rimMat);
        rim.rotation.z = Math.PI / 2; g.add(rim);
        return g;
    }

    // ── Update — zero allocations ─────────────────────────────────────────────
    public update(dt: number) {
        const spd = this.getSpeedKmh();

        // Speed boost
        if (this.speedBoostTimer > 0) { this.speedBoostTimer -= dt; this.speedBoostMultiplier = 1.6; }
        else                          { this.speedBoostMultiplier = 1.0; }

        // Gear
        this.gearTimer += dt;
        if (this.gearTimer > 0.5) {
            this.gearTimer = 0;
            if (spd > this.gear * 25 && this.gear < this.MAX_GEAR) this.gear++;
            else if (spd < (this.gear - 1) * 18 && this.gear > 1)  this.gear--;
        }

        const gearRatio    = this.GEAR_RATIOS[this.gear] ?? 1;
        const ENGINE_FORCE = 1200 * gearRatio * this.speedBoostMultiplier;
        const BRAKE_FORCE  = 60;
        const MAX_STEER    = Math.max(0.2, 0.5 - spd * 0.004);

        let force = 0, steer = 0, brake = 0;
        let handbrake = false, throttle = false;

        if (this.isOccupied) {
            if (Input.isKeyDown('w') || Input.isKeyDown('arrowup'))    { force =  ENGINE_FORCE; throttle = true; }
            if (Input.isKeyDown('s') || Input.isKeyDown('arrowdown'))  { force = -ENGINE_FORCE * 0.5; }
            if (Input.isKeyDown('a') || Input.isKeyDown('arrowleft'))  steer =  MAX_STEER;
            if (Input.isKeyDown('d') || Input.isKeyDown('arrowright')) steer = -MAX_STEER;
            handbrake = Input.isKeyDown(' ');

            if (GamepadInput.connected) {
                if (GamepadInput.rt > 0.05) { force =  ENGINE_FORCE * GamepadInput.rt; throttle = true; }
                if (GamepadInput.lt > 0.05)   force = -ENGINE_FORCE * GamepadInput.lt * 0.5;
                if (Math.abs(GamepadInput.leftX) > 0.05) steer = -GamepadInput.leftX * MAX_STEER;
                if (GamepadInput.btnLB) handbrake = true;
            }

            const braking = Input.isKeyDown('s') || Input.isKeyDown('arrowdown') || handbrake;
            this.taillightMats.forEach(m => m.emissive.setHex(braking ? 0xff4400 : 0x550000));

            this.sound.updateEngine(spd * 0.5, throttle);
            this.updateCamera(dt);
        } else {
            brake = 8;
            this.taillightMats.forEach(m => m.emissive.setHex(0x220000));
        }

        // Lateral speed — reuse pre-allocated vectors
        _carFwd.set(0, 0, 1).applyQuaternion(this.chassisBody.quaternion as unknown as THREE.Quaternion);
        _vel.set(this.chassisBody.velocity.x, 0, this.chassisBody.velocity.z);
        this.lateralSpeed = _vel.clone().sub(_carFwd.multiplyScalar(_vel.dot(_carFwd))).length();

        // Smooth steer
        this.currentSteeringValue += (steer - this.currentSteeringValue) * Math.min(1, 5 * dt);

        this.vehicle.applyEngineForce(force, 2);
        this.vehicle.applyEngineForce(force, 3);
        this.vehicle.setSteeringValue(this.currentSteeringValue, 0);
        this.vehicle.setSteeringValue(this.currentSteeringValue, 1);

        if (handbrake) {
            this.vehicle.setBrake(0, 0); this.vehicle.setBrake(0, 1);
            this.vehicle.setBrake(BRAKE_FORCE * 4, 2);
            this.vehicle.setBrake(BRAKE_FORCE * 4, 3);
        } else {
            for (let i = 0; i < 4; i++) this.vehicle.setBrake(brake, i);
        }

        // Sync mesh — direct copy, no allocation
        this.chassisMesh.position.copy(this.chassisBody.position as unknown as THREE.Vector3);
        this.chassisMesh.quaternion.copy(this.chassisBody.quaternion as unknown as THREE.Quaternion);

        for (let i = 0; i < 4; i++) {
            this.vehicle.updateWheelTransform(i);
            const t = this.vehicle.wheelInfos[i].worldTransform;
            this.wheelMeshes[i].position.copy(t.position as unknown as THREE.Vector3);
            this.wheelMeshes[i].quaternion.copy(t.quaternion as unknown as THREE.Quaternion);
        }
    }

    // ── In-car camera — zero allocations ─────────────────────────────────────
    private updateCamera(dt: number) {
        if (Input.movementX !== 0 || Input.movementY !== 0) {
            this.camYaw   -= Input.movementX * 0.003;
            this.camPitch -= Input.movementY * 0.003;
            this.camPitch  = Math.max(0.05, Math.min(0.6, this.camPitch));
            this.mouseIdleTimer = 1.8;
        }

        if (this.mouseIdleTimer > 0) {
            this.mouseIdleTimer -= dt;
        } else {
            // Auto-align behind car
            _carFwd.set(0, 0, 1).applyQuaternion(this.chassisBody.quaternion as unknown as THREE.Quaternion);
            const targetYaw = Math.atan2(_carFwd.x, _carFwd.z) + Math.PI;
            let diff = targetYaw - this.camYaw;
            while (diff >  Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            this.camYaw += diff * Math.min(1, 3 * dt);
        }

        const spd     = this.getSpeedKmh();
        const dynDist = this.CAM_DIST + spd * 0.05;

        _camTarget.set(
            this.chassisMesh.position.x,
            this.chassisMesh.position.y + 1.2,
            this.chassisMesh.position.z
        );

        const sinY = Math.sin(this.camYaw);
        const cosY = Math.cos(this.camYaw);
        const cosP = Math.cos(this.camPitch);
        const sinP = Math.sin(this.camPitch);
        _camPos.set(
            _camTarget.x + dynDist * sinY * cosP,
            _camTarget.y + dynDist * sinP,
            _camTarget.z + dynDist * cosY * cosP
        );

        const lerpT = Math.min(0.2, 0.1 + spd * 0.002);
        this.camera.position.lerp(_camPos, lerpT);
        this.camera.lookAt(_camTarget);
    }

    // ── Public API ────────────────────────────────────────────────────────────
    public getPosition() { return this.chassisMesh.position; }
    public getGear()     { return this.gear; }

    public setVisible(v: boolean) {
        this.chassisMesh.visible = v;
        this.wheelMeshes.forEach(w => w.visible = v);
    }

    public getSpeedKmh(): number {
        const v = this.chassisBody.velocity;
        return Math.round(Math.sqrt(v.x * v.x + v.z * v.z) * 3.6);
    }

    public boostSpeed() { this.speedBoostTimer = 5.0; }
}
