import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Input } from './Input';
import { GamepadInput } from './Gamepad';
import { Sound } from './Sound';

export class Vehicle {
    private scene:  THREE.Scene;
    private camera: THREE.PerspectiveCamera;

    public  chassisMesh: THREE.Group;
    public  chassisBody: CANNON.Body;
    private vehicle:     CANNON.RaycastVehicle;
    private wheelMeshes: THREE.Group[] = [];
    private taillightMats: THREE.MeshLambertMaterial[] = [];

    public isOccupied  = false;
    public lateralSpeed = 0;

    // In-car camera
    private camYaw   = Math.PI;
    private camPitch = 0.28;
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

        // ── Chassis ──────────────────────────────────────────────────────────
        // Half-extents: width=1.0, height=0.3, length=2.2
        // Spawn y must be above ground so wheels reach down: y = wheel_radius + suspension_rest + chassis_half_height
        // = 0.38 + 0.35 + 0.3 = ~1.05  →  use 1.2 for safety
        const chassisShape = new CANNON.Box(new CANNON.Vec3(1.0, 0.3, 2.2));
        this.chassisBody = new CANNON.Body({ mass: 1200, shape: chassisShape });
        this.chassisBody.position.set(position.x, position.y + 1.2, position.z);
        this.chassisBody.linearDamping  = 0.05;
        this.chassisBody.angularDamping = 0.6;
        world.addBody(this.chassisBody);

        this.chassisMesh = this.buildCarModel();
        this.scene.add(this.chassisMesh);

        // ── RaycastVehicle ───────────────────────────────────────────────────
        this.vehicle = new CANNON.RaycastVehicle({
            chassisBody:      this.chassisBody,
            indexForwardAxis: 2,
            indexRightAxis:   0,
            indexUpAxis:      1,
        });

        const wheelOpts = {
            radius:             0.38,
            directionLocal:     new CANNON.Vec3(0, -1, 0),
            suspensionStiffness:    35,
            suspensionRestLength:   0.35,   // shorter rest = car sits lower, less bounce
            frictionSlip:           2.5,    // was 12 — that caused violent launches
            dampingRelaxation:      2.3,
            dampingCompression:     4.4,
            maxSuspensionForce:     80000,
            rollInfluence:          0.01,   // near-zero = no roll-over
            axleLocal:              new CANNON.Vec3(1, 0, 0),
            chassisConnectionPointLocal: new CANNON.Vec3(1, 1, 0),
            maxSuspensionTravel:    0.3,
            customSlidingFrictionWheelStep: 1,
        };

        // Wheel positions: [x, y_offset_from_chassis_centre, z]
        // y = -0.1 means wheel hangs 0.1 below chassis centre
        const wheelPositions = [
            [-0.95, -0.1,  1.5],   // front-left
            [ 0.95, -0.1,  1.5],   // front-right
            [-0.95, -0.1, -1.5],   // rear-left
            [ 0.95, -0.1, -1.5],   // rear-right
        ];
        wheelPositions.forEach(([x, y, z]) => {
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
        const paint = new THREE.MeshLambertMaterial({ color: 0xcc2200 }); // Vice City red
        const glass = new THREE.MeshLambertMaterial({ color: 0x223344, transparent: true, opacity: 0.45 });
        const dark  = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const hlMat = new THREE.MeshBasicMaterial({ color: 0xffffcc });
        const tlMat = new THREE.MeshLambertMaterial({ color: 0xff2200, emissive: new THREE.Color(0xff1100) });
        this.taillightMats.push(tlMat);

        // Body
        const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.55, 4.6), paint);
        body.castShadow = true; g.add(body);

        // Hood
        const hood = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.16, 1.4), paint);
        hood.position.set(0, 0.34, 1.3); hood.rotation.x = 0.1; g.add(hood);

        // Cabin glass
        const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.52, 2.0), glass);
        cabin.position.set(0, 0.54, -0.1); g.add(cabin);

        // Roof
        const roof = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.07, 2.02), paint);
        roof.position.set(0, 0.80, -0.1); g.add(roof);

        // Front bumper
        const bumperF = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.22, 0.18), dark);
        bumperF.position.set(0, -0.14, 2.3); g.add(bumperF);

        // Rear bumper
        const bumperR = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.22, 0.18), dark);
        bumperR.position.set(0, -0.14, -2.3); g.add(bumperR);

        // Headlights
        const hlL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.13, 0.06), hlMat);
        hlL.position.set(-0.62, 0.1, 2.32); g.add(hlL);
        const hlR = hlL.clone(); hlR.position.set(0.62, 0.1, 2.32); g.add(hlR);

        // Taillights
        const tlL = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.13, 0.06), tlMat);
        tlL.position.set(-0.62, 0.1, -2.32); g.add(tlL);
        const tlR = tlL.clone(); tlR.position.set(0.62, 0.1, -2.32); g.add(tlR);

        return g;
    }

    private buildWheelModel(): THREE.Group {
        const g    = new THREE.Group();
        const tire = new THREE.Mesh(
            new THREE.CylinderGeometry(0.38, 0.38, 0.28, 10),
            new THREE.MeshLambertMaterial({ color: 0x111111 })
        );
        tire.rotation.z = Math.PI / 2; g.add(tire);

        const rim = new THREE.Mesh(
            new THREE.CylinderGeometry(0.22, 0.22, 0.30, 8),
            new THREE.MeshLambertMaterial({ color: 0xaaaaaa })
        );
        rim.rotation.z = Math.PI / 2; g.add(rim);
        return g;
    }

    // ── Update ────────────────────────────────────────────────────────────────
    public update(dt: number) {
        const spd = this.getSpeedKmh();

        // Speed boost
        if (this.speedBoostTimer > 0) { this.speedBoostTimer -= dt; this.speedBoostMultiplier = 1.6; }
        else                          { this.speedBoostMultiplier = 1.0; }

        // Gear shift
        this.gearTimer += dt;
        if (this.gearTimer > 0.5) {
            this.gearTimer = 0;
            if (spd > this.gear * 25 && this.gear < this.MAX_GEAR) this.gear++;
            else if (spd < (this.gear - 1) * 18 && this.gear > 1)  this.gear--;
        }

        const gearRatio   = this.GEAR_RATIOS[this.gear] ?? 1;
        // Reduced engine force — was 4800*3.5=16800, now max ~3500
        const ENGINE_FORCE = 1200 * gearRatio * this.speedBoostMultiplier;
        const BRAKE_FORCE  = 60;
        const MAX_STEER    = Math.max(0.2, 0.5 - spd * 0.004);
        const STEER_SPEED  = 5.0;

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
            // Parked — apply gentle brake so it doesn't roll
            brake = 8;
            this.taillightMats.forEach(m => m.emissive.setHex(0x220000));
        }

        // Lateral speed (for drift scoring)
        const carFwd = new THREE.Vector3(0, 0, 1)
            .applyQuaternion(this.chassisBody.quaternion as unknown as THREE.Quaternion);
        const vel    = new THREE.Vector3(this.chassisBody.velocity.x, 0, this.chassisBody.velocity.z);
        this.lateralSpeed = vel.clone().sub(carFwd.multiplyScalar(vel.dot(carFwd))).length();

        // Smooth steer
        this.currentSteeringValue += (steer - this.currentSteeringValue) * Math.min(1, STEER_SPEED * dt);

        this.vehicle.applyEngineForce(force, 2);
        this.vehicle.applyEngineForce(force, 3);
        this.vehicle.setSteeringValue(this.currentSteeringValue, 0);
        this.vehicle.setSteeringValue(this.currentSteeringValue, 1);

        if (handbrake) {
            this.vehicle.setBrake(0,   0); this.vehicle.setBrake(0,   1);
            this.vehicle.setBrake(BRAKE_FORCE * 4, 2);
            this.vehicle.setBrake(BRAKE_FORCE * 4, 3);
        } else {
            for (let i = 0; i < 4; i++) this.vehicle.setBrake(brake, i);
        }

        // Sync mesh to physics
        this.chassisMesh.position.copy(this.chassisBody.position as unknown as THREE.Vector3);
        this.chassisMesh.quaternion.copy(this.chassisBody.quaternion as unknown as THREE.Quaternion);

        for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
            this.vehicle.updateWheelTransform(i);
            const t = this.vehicle.wheelInfos[i].worldTransform;
            this.wheelMeshes[i].position.copy(t.position as unknown as THREE.Vector3);
            this.wheelMeshes[i].quaternion.copy(t.quaternion as unknown as THREE.Quaternion);
        }
    }

    // ── In-car camera ─────────────────────────────────────────────────────────
    private updateCamera(dt: number) {
        // Mouse rotates camera freely
        if (Input.movementX !== 0 || Input.movementY !== 0) {
            this.camYaw   -= Input.movementX * 0.003;
            this.camPitch -= Input.movementY * 0.003;
            this.camPitch  = Math.max(0.05, Math.min(0.6, this.camPitch));
            this.mouseIdleTimer = 1.8;
        }

        // Auto-align behind car when mouse idle
        if (this.mouseIdleTimer > 0) {
            this.mouseIdleTimer -= dt;
        } else {
            const carFwd    = new THREE.Vector3(0, 0, 1)
                .applyQuaternion(this.chassisBody.quaternion as unknown as THREE.Quaternion);
            const targetYaw = Math.atan2(carFwd.x, carFwd.z) + Math.PI;
            let diff = targetYaw - this.camYaw;
            while (diff >  Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            this.camYaw += diff * Math.min(1, 3 * dt);
        }

        const spd     = this.getSpeedKmh();
        const dynDist = this.CAM_DIST + spd * 0.05;

        const target = new THREE.Vector3(
            this.chassisMesh.position.x,
            this.chassisMesh.position.y + 1.2,
            this.chassisMesh.position.z
        );
        const cx = target.x + dynDist * Math.sin(this.camYaw) * Math.cos(this.camPitch);
        const cy = target.y + dynDist * Math.sin(this.camPitch);
        const cz = target.z + dynDist * Math.cos(this.camYaw) * Math.cos(this.camPitch);

        const lerpT = Math.min(0.2, 0.1 + spd * 0.002);
        this.camera.position.lerp(new THREE.Vector3(cx, cy, cz), lerpT);
        this.camera.lookAt(target);
    }

    // ── Public API ────────────────────────────────────────────────────────────
    public getPosition() { return this.chassisMesh.position; }
    public getGear()     { return this.gear; }

    public setVisible(visible: boolean) {
        this.chassisMesh.visible = visible;
        this.wheelMeshes.forEach(w => w.visible = visible);
    }

    public getSpeedKmh(): number {
        const v = this.chassisBody.velocity;
        return Math.round(Math.sqrt(v.x * v.x + v.z * v.z) * 3.6);
    }

    public boostSpeed() { this.speedBoostTimer = 5.0; }
}
