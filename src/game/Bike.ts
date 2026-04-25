import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Input } from './Input';
import { GamepadInput } from './Gamepad';
import { Sound } from './Sound';
import { TouchControls } from './TouchControls';

const _bikeFwd    = new THREE.Vector3();
const _vel        = new THREE.Vector3();
const _camTarget  = new THREE.Vector3();
const _camPos     = new THREE.Vector3();

export class Bike {
    private scene:  THREE.Scene;
    private camera: THREE.PerspectiveCamera;

    public  chassisMesh: THREE.Group;
    public  chassisBody: CANNON.Body;
    private vehicle:     CANNON.RaycastVehicle;
    private wheelMeshes: THREE.Group[] = [];

    public isOccupied   = false;
    public lateralSpeed = 0;

    // Camera
    private camYaw         = Math.PI;
    private camPitch       = 0.28;
    private readonly CAM_DIST = 6; 
    private mouseIdleTimer = 0;

    private sound: Sound;
    private currentSteeringValue = 0;
    private speedBoostTimer      = 0;
    private speedBoostMultiplier = 1;
    private stuckTimer = 0;

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

        const chassisShape = new CANNON.Box(new CANNON.Vec3(0.3, 0.4, 0.9));
        this.chassisBody = new CANNON.Body({ mass: 200, shape: chassisShape });
        this.chassisBody.position.set(position.x, position.y + 1.0, position.z);
        this.chassisBody.linearDamping  = 0.15;
        this.chassisBody.angularDamping = 0.6;
        world.addBody(this.chassisBody);

        this.chassisMesh = this.buildBikeModel();
        this.scene.add(this.chassisMesh);

        this.vehicle = new CANNON.RaycastVehicle({
            chassisBody:      this.chassisBody,
            indexForwardAxis: 2,
            indexRightAxis:   0,
            indexUpAxis:      1,
        });

        const wheelOpts = {
            radius:                         0.32,
            directionLocal:                 new CANNON.Vec3(0, -1, 0),
            suspensionStiffness: 65,
            suspensionRestLength: 0.3,
            frictionSlip: 2.5,
            dampingRelaxation: 4.5,
            dampingCompression: 6.5,
            maxSuspensionForce: 100000,
            rollInfluence: 0.001,
            axleLocal:                      new CANNON.Vec3(1, 0, 0),
            chassisConnectionPointLocal:    new CANNON.Vec3(0, 0, 0),
            maxSuspensionTravel:            0.25,
            customSlidingFrictionWheelStep: 1,
        };

        const wPos = [
            [0, -0.2,  0.7],  // Front wheel
            [0, -0.2, -0.7],  // Rear wheel
        ];
        
        wPos.forEach(([x, y, z]) => {
            wheelOpts.chassisConnectionPointLocal.set(x, y, z);
            this.vehicle.addWheel({ ...wheelOpts });
            const wm = this.buildWheelModel();
            this.wheelMeshes.push(wm);
            this.scene.add(wm);
        });

        this.vehicle.addToWorld(world);
    }

    private buildBikeModel(): THREE.Group {
        const g = new THREE.Group();
        const bikeMetal = new THREE.MeshLambertMaterial({ color: 0xff0000 });
        const bikeSeat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
        const bikeChrome = new THREE.MeshLambertMaterial({ color: 0xcccccc });

        const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x=0, y=0, z=0, rx=0) => {
            const m = new THREE.Mesh(geo, mat);
            m.position.set(x, y, z);
            if (rx) m.rotation.x = rx;
            m.castShadow = true;
            g.add(m);
            return m;
        };

        add(new THREE.BoxGeometry(0.15, 0.3, 1.4), bikeMetal, 0, 0, 0);
        add(new THREE.BoxGeometry(0.35, 0.25, 0.5), bikeMetal, 0, 0.2, 0.2);
        add(new THREE.BoxGeometry(0.4, 0.15, 0.6), bikeSeat, 0, 0.3, -0.3);
        add(new THREE.BoxGeometry(0.6, 0.05, 0.05), bikeChrome, 0, 0.4, 0.6);
        add(new THREE.BoxGeometry(0.08, 0.5, 0.08), bikeChrome, 0, -0.15, 0.7);
        add(new THREE.BoxGeometry(0.08, 0.4, 0.08), bikeChrome, 0, -0.1, -0.7);

        return g;
    }

    private static _tireGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.15, 12);
    private static _rimGeo  = new THREE.CylinderGeometry(0.18, 0.18, 0.16, 8);
    private static _tireMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    private static _rimMat  = new THREE.MeshLambertMaterial({ color: 0xaaaaaa });

    private buildWheelModel(): THREE.Group {
        const g    = new THREE.Group();
        const tire = new THREE.Mesh(Bike._tireGeo, Bike._tireMat);
        tire.rotation.z = Math.PI / 2;
        g.add(tire);
        const rim = new THREE.Mesh(Bike._rimGeo, Bike._rimMat);
        rim.rotation.z = Math.PI / 2;
        g.add(rim);
        return g;
    }

    public initCamera(yaw: number, pitch: number) {
        this.camYaw   = yaw;
        this.camPitch = Math.max(0.05, Math.min(0.6, pitch));
        this.mouseIdleTimer = 0;
    }

    public update(dt: number) {
        this.chassisMesh.position.copy(this.chassisBody.position as unknown as THREE.Vector3);
        this.chassisMesh.quaternion.copy(this.chassisBody.quaternion as unknown as THREE.Quaternion);

        for (let i = 0; i < 2; i++) {
            this.vehicle.updateWheelTransform(i);
            const t = this.vehicle.wheelInfos[i].worldTransform;
            this.wheelMeshes[i].position.copy(t.position as unknown as THREE.Vector3);
            this.wheelMeshes[i].quaternion.copy(t.quaternion as unknown as THREE.Quaternion);
        }

        const spd = this.getSpeedKmh();

        if (this.speedBoostTimer > 0) { this.speedBoostTimer -= dt; this.speedBoostMultiplier = 1.6; }
        else                          { this.speedBoostMultiplier = 1.0; }

        const ENGINE_FORCE = 1800 * this.speedBoostMultiplier;
        const BRAKE_FORCE  = 180;
        const MAX_STEER    = Math.max(0.4, 0.8 - spd * 0.005);

        let force = 0, steer = 0, brake = 0;
        let throttle = false, handbrake = false;

        if (this.isOccupied) {
            if (Input.isKeyDown('w') || Input.isKeyDown('arrowup'))    { force =  ENGINE_FORCE; throttle = true; }
            if (Input.isKeyDown('s') || Input.isKeyDown('arrowdown'))  { force = -ENGINE_FORCE * 0.6; }
            if (Input.isKeyDown('a') || Input.isKeyDown('arrowleft'))  steer =  MAX_STEER;
            if (Input.isKeyDown('d') || Input.isKeyDown('arrowright')) steer = -MAX_STEER;
            handbrake = Input.isKeyDown(' ');
            brake = handbrake ? 500 : 0;

            if (TouchControls.active) {
                if (TouchControls.gasPressed) { force = ENGINE_FORCE; throttle = true; }
                if (TouchControls.brakePressed) { force = -ENGINE_FORCE * 0.6; }
                if (Math.abs(TouchControls.moveX) > 0.1) steer = -TouchControls.moveX * MAX_STEER;
            }

            this.sound.updateEngine(spd * 0.7, throttle);
            this.updateCamera(dt);
        } else {
            brake = 10;
            force = 0;
        }

        _bikeFwd.set(0, 0, 1).applyQuaternion(this.chassisBody.quaternion as unknown as THREE.Quaternion);
        
        // --- Active Stabilization ---
        const currentUp = new THREE.Vector3(0, 1, 0).applyQuaternion(this.chassisBody.quaternion as any);
        const worldUp = new THREE.Vector3(0, 1, 0);
        const tilt = currentUp.cross(worldUp);
        const stabilityFactor = 800;
        this.chassisBody.angularVelocity.x += tilt.x * stabilityFactor * dt;
        this.chassisBody.angularVelocity.z += tilt.z * stabilityFactor * dt;

        _vel.set(this.chassisBody.velocity.x, 0, this.chassisBody.velocity.z);
        this.lateralSpeed = _vel.clone().sub(_bikeFwd.clone().multiplyScalar(_vel.dot(_bikeFwd))).length();

        this.currentSteeringValue += (steer - this.currentSteeringValue) * Math.min(1, 15 * dt);

        this.vehicle.applyEngineForce(force, 0);
        this.vehicle.applyEngineForce(force, 1);
        for (let i = 0; i < 2; i++) this.vehicle.setBrake(brake, i);
        const downforce = spd * 25;
        this.chassisBody.applyForce(new CANNON.Vec3(0, -downforce, 0), new CANNON.Vec3(0, 0, 0));
        this.vehicle.setSteeringValue(this.currentSteeringValue, 0);

        if (handbrake) {
            this.vehicle.setBrake(0, 0);
            this.vehicle.setBrake(BRAKE_FORCE * 6, 1);
        } else {
            for (let i = 0; i < 2; i++) this.vehicle.setBrake(brake, i);
        }

        if (this.chassisBody.position.y < 0.4) {
            this.chassisBody.position.y += (0.5 - this.chassisBody.position.y) * 0.4;
            if (this.chassisBody.velocity.y < 0) this.chassisBody.velocity.y = 1.0;
        }

        if (this.isOccupied && throttle && spd < 4) {
            this.stuckTimer += dt;
            if (this.stuckTimer > 0.6) {
                const nudge = new CANNON.Vec3((Math.random()-0.5)*2000, 8000, (Math.random()-0.5)*2000);
                this.chassisBody.applyImpulse(nudge, new CANNON.Vec3(0,0,0));
                this.stuckTimer = 0;
            }
        } else {
            this.stuckTimer = 0;
        }
    }

    private updateCamera(dt: number) {
        if (Input.movementX !== 0 || Input.movementY !== 0) {
            this.camYaw -= Input.movementX * 0.003;
            this.camPitch -= Input.movementY * 0.003;
            this.camPitch = Math.max(0.05, Math.min(0.6, this.camPitch));
            this.mouseIdleTimer = 1.8;
        }
        if (this.mouseIdleTimer > 0) this.mouseIdleTimer -= dt;
        else {
            _bikeFwd.set(0, 0, 1).applyQuaternion(this.chassisBody.quaternion as unknown as THREE.Quaternion);
            const targetYaw = Math.atan2(_bikeFwd.x, _bikeFwd.z) + Math.PI;
            let diff = targetYaw - this.camYaw;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            this.camYaw += diff * Math.min(1, 4 * dt);
        }
        _camTarget.set(this.chassisMesh.position.x, this.chassisMesh.position.y + 1, this.chassisMesh.position.z);
        _camPos.set(_camTarget.x + this.CAM_DIST * Math.sin(this.camYaw) * Math.cos(this.camPitch), _camTarget.y + this.CAM_DIST * Math.sin(this.camPitch), _camTarget.z + this.CAM_DIST * Math.cos(this.camYaw) * Math.cos(this.camPitch));
        this.camera.position.lerp(_camPos, 0.15);
        this.camera.lookAt(_camTarget);
    }

    public getPosition() { return this.chassisMesh.position; }
    public setVisible(v: boolean) {
        this.chassisMesh.visible = v;
        this.wheelMeshes.forEach(w => w.visible = v);
    }
    public getSpeedKmh(): number {
        const v = this.chassisBody.velocity;
        return Math.round(Math.sqrt(v.x * v.x + v.z * v.z) * 3.6);
    }
    public resetPosition() {
        this.chassisBody.position.y += 2;
        this.chassisBody.velocity.set(0,0,0);
        this.chassisBody.angularVelocity.set(0,0,0);
        this.chassisBody.quaternion.set(0,0,0,1);
    }
    public takeDamage(d: number) { return false; }
}
