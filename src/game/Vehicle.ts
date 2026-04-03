import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Input } from './Input';
import { GamepadInput } from './Gamepad';
import { Sound } from './Sound';

export class Vehicle {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;

    public chassisMesh: THREE.Group;
    public chassisBody: CANNON.Body;
    private vehicle: CANNON.RaycastVehicle;
    private wheelMeshes: THREE.Group[] = [];
    private taillightMats: THREE.MeshStandardMaterial[] = [];

    public isOccupied = false;

    private camYaw = Math.PI;
    private camPitch = 0.25;
    private readonly CAM_DIST = 12;
    private mouseIdleTimer = 0;

    // Drift tracking for score
    public lateralSpeed = 0;

    private sound: Sound;

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

        const chassisShape = new CANNON.Box(new CANNON.Vec3(1.0, 0.35, 2.2));
        this.chassisBody = new CANNON.Body({ mass: 1200, shape: chassisShape });
        this.chassisBody.position.copy(position);
        this.chassisBody.linearDamping  = 0.05;
        this.chassisBody.angularDamping = 0.4;
        world.addBody(this.chassisBody);

        this.chassisMesh = this.buildCarModel();
        this.scene.add(this.chassisMesh);

        this.vehicle = new CANNON.RaycastVehicle({
            chassisBody: this.chassisBody,
            indexForwardAxis: 2,
            indexRightAxis: 0,
            indexUpAxis: 1,
        });

        const wheelOpts = {
            radius: 0.38,
            directionLocal: new CANNON.Vec3(0, -1, 0),
            suspensionStiffness: 40,
            suspensionRestLength: 0.3,
            frictionSlip: 2.0,
            dampingRelaxation: 2.3,
            dampingCompression: 4.5,
            maxSuspensionForce: 100000,
            rollInfluence: 0.01,
            axleLocal: new CANNON.Vec3(1, 0, 0),
            chassisConnectionPointLocal: new CANNON.Vec3(1, 1, 0),
            maxSuspensionTravel: 0.25,
            customSlidingFrictionWheelStep: 1,
        };

        const wheelPositions = [
            [-0.9, -0.3,  1.5],
            [ 0.9, -0.3,  1.5],
            [-0.9, -0.3, -1.5],
            [ 0.9, -0.3, -1.5],
        ];

        wheelPositions.forEach((pos) => {
            wheelOpts.chassisConnectionPointLocal.set(pos[0], pos[1], pos[2]);
            this.vehicle.addWheel({ ...wheelOpts });
            const wm = this.buildWheelModel();
            this.wheelMeshes.push(wm);
            this.scene.add(wm);
        });

        this.vehicle.addToWorld(world);
    }

    private buildCarModel(): THREE.Group {
        const g = new THREE.Group();

        const paint = new THREE.MeshPhysicalMaterial({
            color: 0x080818, roughness: 0.15, metalness: 0.9,
            clearcoat: 1.0, clearcoatRoughness: 0.05,
        });
        const glass = new THREE.MeshPhysicalMaterial({
            color: 0x001122, roughness: 0.05, metalness: 0.1,
            transparent: true, opacity: 0.7,
        });
        const hlMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffcc, emissiveIntensity: 6 });
        const tlMat = new THREE.MeshStandardMaterial({ color: 0xff1111, emissive: 0xff0000, emissiveIntensity: 2 });
        this.taillightMats.push(tlMat);

        const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.55, 4.4), paint);
        body.castShadow = true; g.add(body);

        const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.48, 2.2), glass);
        cabin.position.set(0, 0.5, -0.15); g.add(cabin);

        const roof = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.06, 2.22), paint);
        roof.position.set(0, 0.75, -0.15); g.add(roof);

        const bumperF = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.2, 0.15), paint);
        bumperF.position.set(0, -0.18, 2.27); g.add(bumperF);

        const bumperR = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.2, 0.15), paint);
        bumperR.position.set(0, -0.18, -2.27); g.add(bumperR);

        const hlL = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.14, 0.08), hlMat);
        hlL.position.set(-0.62, 0.08, 2.24); g.add(hlL);
        const hlR = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.14, 0.08), hlMat);
        hlR.position.set(0.62, 0.08, 2.24); g.add(hlR);

        [-0.62, 0.62].forEach(x => {
            const spot = new THREE.SpotLight(0xfff5e0, 6, 40, Math.PI / 7, 0.4, 1.5);
            spot.position.set(x, 0.08, 2.3);
            const tgt = new THREE.Object3D();
            tgt.position.set(x * 0.5, -0.5, 12);
            g.add(tgt);
            spot.target = tgt;
            spot.castShadow = false;
            g.add(spot);
        });

        const tlL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.08), tlMat);
        tlL.position.set(-0.6, 0.1, -2.24); g.add(tlL);
        const tlR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.08), tlMat);
        tlR.position.set(0.6, 0.1, -2.24); g.add(tlR);

        const underglow = new THREE.PointLight(0x7000ff, 3, 6);
        underglow.position.set(0, -0.4, 0);
        g.add(underglow);

        return g;
    }

    private buildWheelModel(): THREE.Group {
        const g = new THREE.Group();
        const tire = new THREE.Mesh(
            new THREE.CylinderGeometry(0.38, 0.38, 0.3, 20),
            new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1.0 })
        );
        tire.rotation.z = Math.PI / 2; tire.castShadow = true; g.add(tire);

        const rim = new THREE.Mesh(
            new THREE.CylinderGeometry(0.24, 0.24, 0.32, 10),
            new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.9, roughness: 0.2 })
        );
        rim.rotation.z = Math.PI / 2; g.add(rim);
        return g;
    }

    public update(_dt: number) {
        const ENGINE_FORCE = 5000;
        const BRAKE_FORCE  = 120;
        const spd = this.getSpeedKmh();
        const MAX_STEER = Math.max(0.15, 0.42 - spd * 0.002);

        let force = 0, steer = 0, brake = 0;
        let handbrake = false;
        let throttle  = false;

        if (this.isOccupied) {
            // Keyboard
            if (Input.isKeyDown('w')) { force =  ENGINE_FORCE; throttle = true; }
            if (Input.isKeyDown('s')) { force = -ENGINE_FORCE * 0.55; }
            if (Input.isKeyDown('a')) steer =  MAX_STEER;
            if (Input.isKeyDown('d')) steer = -MAX_STEER;
            handbrake = Input.isKeyDown(' ');

            // Gamepad
            if (GamepadInput.connected) {
                if (GamepadInput.rt > 0.05) { force =  ENGINE_FORCE * GamepadInput.rt; throttle = true; }
                if (GamepadInput.lt > 0.05)   force = -ENGINE_FORCE * GamepadInput.lt * 0.55;
                if (Math.abs(GamepadInput.leftX) > 0.05) steer = -GamepadInput.leftX * MAX_STEER;
                if (GamepadInput.btnLB) handbrake = true;
            }

            const braking = Input.isKeyDown('s') || handbrake || (GamepadInput.connected && GamepadInput.lt > 0.1);
            this.taillightMats.forEach(m => m.emissiveIntensity = braking ? 8 : 2);

            this.sound.updateEngine(spd, throttle);
            this.updateCamera();
        } else {
            brake = 12;
            this.taillightMats.forEach(m => m.emissiveIntensity = 0.5);
        }

        // Lateral speed for drift scoring
        const carFwd = new THREE.Vector3(0, 0, 1).applyQuaternion(
            this.chassisBody.quaternion as unknown as THREE.Quaternion
        );
        const vel = new THREE.Vector3(
            this.chassisBody.velocity.x, 0, this.chassisBody.velocity.z
        );
        const fwdSpeed  = vel.dot(carFwd);
        const latVec    = vel.clone().sub(carFwd.clone().multiplyScalar(fwdSpeed));
        this.lateralSpeed = latVec.length();

        this.vehicle.applyEngineForce(force, 2);
        this.vehicle.applyEngineForce(force, 3);
        this.vehicle.setSteeringValue(steer, 0);
        this.vehicle.setSteeringValue(steer, 1);

        if (handbrake) {
            this.vehicle.setBrake(0, 0);
            this.vehicle.setBrake(0, 1);
            this.vehicle.setBrake(BRAKE_FORCE * 3, 2);
            this.vehicle.setBrake(BRAKE_FORCE * 3, 3);
        } else {
            for (let i = 0; i < 4; i++) this.vehicle.setBrake(brake, i);
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

    private updateCamera() {
        if (Input.isPointerLocked && (Input.movementX !== 0 || Input.movementY !== 0)) {
            this.camYaw   -= Input.movementX * 0.0025;
            this.camPitch -= Input.movementY * 0.0025;
            this.camPitch  = Math.max(-0.1, Math.min(0.6, this.camPitch));
            this.mouseIdleTimer = 1.5;
        }
        if (GamepadInput.connected && (Math.abs(GamepadInput.rightX) > 0.05 || Math.abs(GamepadInput.rightY) > 0.05)) {
            this.camYaw   -= GamepadInput.rightX * 0.04;
            this.camPitch -= GamepadInput.rightY * 0.03;
            this.camPitch  = Math.max(-0.1, Math.min(0.6, this.camPitch));
            this.mouseIdleTimer = 1.5;
        }

        if (this.mouseIdleTimer > 0) {
            this.mouseIdleTimer -= 1 / 60;
        } else {
            const carFwd = new THREE.Vector3(0, 0, 1).applyQuaternion(
                this.chassisBody.quaternion as unknown as THREE.Quaternion
            );
            const targetYaw = Math.atan2(carFwd.x, carFwd.z) + Math.PI;
            let diff = targetYaw - this.camYaw;
            while (diff >  Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            this.camYaw += diff * 0.08;
        }

        const target = new THREE.Vector3(
            this.chassisMesh.position.x,
            this.chassisMesh.position.y + 1.2,
            this.chassisMesh.position.z
        );
        const cx = target.x + this.CAM_DIST * Math.sin(this.camYaw) * Math.cos(this.camPitch);
        const cy = target.y + this.CAM_DIST * Math.sin(this.camPitch);
        const cz = target.z + this.CAM_DIST * Math.cos(this.camYaw) * Math.cos(this.camPitch);
        this.camera.position.lerp(new THREE.Vector3(cx, cy, cz), 0.1);
        this.camera.lookAt(target);
    }

    public getPosition() { return this.chassisMesh.position; }

    public getSpeedKmh(): number {
        const v = this.chassisBody.velocity;
        return Math.round(Math.sqrt(v.x * v.x + v.z * v.z) * 3.6);
    }
}
