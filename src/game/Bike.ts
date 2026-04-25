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
    private readonly CAM_DIST = 6; // Closer camera for bike
    private mouseIdleTimer = 0;

    private sound: Sound;
    private currentSteeringValue = 0;
    private speedBoostTimer      = 0;
    private speedBoostMultiplier = 1;
    // Stuck detection: counts seconds player is throttling but speed < 3 km/h
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

        // Lighter, smaller chassis for bike
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

        // Bike wheels - only 2 wheels
        const wheelOpts = {
            radius:                         0.32,
            directionLocal:                 new CANNON.Vec3(0, -1, 0),
            suspensionStiffness: 45,
            suspensionRestLength: 0.3,
            frictionSlip: 5.5,
            dampingRelaxation: 3.5,
            dampingCompression: 5.5,
            maxSuspensionForce: 100000,
            rollInfluence: 0.02, // Lower for stability
            axleLocal:                      new CANNON.Vec3(1, 0, 0),
            chassisConnectionPointLocal:    new CANNON.Vec3(1, 1, 0),
            maxSuspensionTravel:            0.25,
            customSlidingFrictionWheelStep: 1,
        };

        // Front and rear wheels
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
        const bikeMetal = new THREE.MeshLambertMaterial({ color: 0xff0000 }); // Red bike
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

        // Main body/frame
        add(new THREE.BoxGeometry(0.15, 0.3, 1.4), bikeMetal, 0, 0, 0);
        
        // Fuel tank
        add(new THREE.BoxGeometry(0.35, 0.25, 0.5), bikeMetal, 0, 0.2, 0.2);
        
        // Seat
        add(new THREE.BoxGeometry(0.4, 0.15, 0.6), bikeSeat, 0, 0.3, -0.3);
        
        // Handlebars
        add(new THREE.BoxGeometry(0.6, 0.05, 0.05), bikeChrome, 0, 0.4, 0.6);
        
        // Front fork
        add(new THREE.BoxGeometry(0.08, 0.5, 0.08), bikeChrome, 0, -0.15, 0.7);
        
        // Rear fork
        add(new THREE.BoxGeometry(0.08, 0.4, 0.08), bikeChrome, 0, -0.1, -0.7);
        
        // Headlight
        const headlight = add(new THREE.BoxGeometry(0.15, 0.12, 0.08), 
            new THREE.MeshBasicMaterial({ color: 0xffffcc }), 0, 0.15, 0.75);

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

    // Allow Core to pre-seed camera direction on vehicle entry
    public initCamera(yaw: number, pitch: number) {
        this.camYaw   = yaw;
        this.camPitch = Math.max(0.05, Math.min(0.6, pitch));
        this.mouseIdleTimer = 0;
    }

    public update(dt: number) {
        // Always update physics sync first
        this.chassisMesh.position.copy(
            this.chassisBody.position as unknown as THREE.Vector3
        );
        this.chassisMesh.quaternion.copy(
            this.chassisBody.quaternion as unknown as THREE.Quaternion
        );

        for (let i = 0; i < 2; i++) { // Only 2 wheels
            this.vehicle.updateWheelTransform(i);
            const t = this.vehicle.wheelInfos[i].worldTransform;
            this.wheelMeshes[i].position.copy(t.position as unknown as THREE.Vector3);
            this.wheelMeshes[i].quaternion.copy(t.quaternion as unknown as THREE.Quaternion);
        }

        const spd = this.getSpeedKmh();

        if (this.speedBoostTimer > 0) { this.speedBoostTimer -= dt; this.speedBoostMultiplier = 1.6; }
        else                          { this.speedBoostMultiplier = 1.0; }

        // Bike has simpler power delivery - no gears
        const ENGINE_FORCE = 1800 * this.speedBoostMultiplier; // Lighter, faster acceleration
        const BRAKE_FORCE  = 180;
        const MAX_STEER    = Math.max(0.4, 0.8 - spd * 0.005); // More agile steering

        let force = 0, steer = 0, brake = 0;
        let handbrake = false, throttle = false;

        if (this.isOccupied) {
            // Keyboard controls
            if (Input.isKeyDown('w') || Input.isKeyDown('arrowup'))    { force =  ENGINE_FORCE; throttle = true; }
            if (Input.isKeyDown('s') || Input.isKeyDown('arrowdown'))  { force = -ENGINE_FORCE * 0.6; }
            if (Input.isKeyDown('a') || Input.isKeyDown('arrowleft'))  steer =  MAX_STEER;
            if (Input.isKeyDown('d') || Input.isKeyDown('arrowright')) steer = -MAX_STEER;
            handbrake = Input.isKeyDown(' ');
            
            // Touch controls
            if (TouchControls.active) {
                if (TouchControls.gasPressed) { force = ENGINE_FORCE; throttle = true; }
                if (TouchControls.brakePressed) { force = -ENGINE_FORCE * 0.6; }
                if (Math.abs(TouchControls.moveX) > 0.1) {
                    steer = -TouchControls.moveX * MAX_STEER;
                }
            }

            // Gamepad controls
            if (GamepadInput.connected) {
                if (GamepadInput.rt > 0.05) { force =  ENGINE_FORCE * GamepadInput.rt; throttle = true; }
                if (GamepadInput.lt > 0.05)   force = -ENGINE_FORCE * GamepadInput.lt * 0.6;
                if (Math.abs(GamepadInput.leftX) > 0.05) steer = -GamepadInput.leftX * MAX_STEER;
                if (GamepadInput.btnLB) handbrake = true;
            }

            this.sound.updateEngine(spd * 0.7, throttle); // Higher pitch for bike
            this.updateCamera(dt);
        } else {
            // When not occupied, apply a light brake so the bike doesn't drift
            brake = 10;
            force = 0;
        }

        // Lateral speed for drift detection
        // FIX: clone before multiplyScalar so _bikeFwd isn't mutated for downstream use
        _bikeFwd.set(0, 0, 1).applyQuaternion(
            this.chassisBody.quaternion as unknown as THREE.Quaternion
        );
        _vel.set(this.chassisBody.velocity.x, 0, this.chassisBody.velocity.z);
        this.lateralSpeed = _vel.clone()
            .sub(_bikeFwd.clone().multiplyScalar(_vel.dot(_bikeFwd)))
            .length();

        // Faster steering response for bike
        this.currentSteeringValue += (steer - this.currentSteeringValue) * Math.min(1, 15 * dt);

        // Apply forces - rear wheel drive
        this.vehicle.applyEngineForce(force, 1); // Rear wheel only
        // Apply small Aerodynamic Downforce
        const downforce = spd * 25;
        this.chassisBody.applyForce(new CANNON.Vec3(0, -downforce, 0), new CANNON.Vec3(0, 0, 0));

        this.vehicle.setSteeringValue(this.currentSteeringValue, 0); // Front wheel only

        if (handbrake) {
            this.vehicle.setBrake(0, 0);
            this.vehicle.setBrake(BRAKE_FORCE * 6, 1);
        } else {
            for (let i = 0; i < 2; i++) this.vehicle.setBrake(brake, i);
        }

        // FIX: Fall-through safety — only teleport if truly underground
        if (this.chassisBody.position.y < -8) {
            this.resetPosition();
            return;
        }

        // ── Soft Y-floor ─────────────────────────────────────────────────────
        // Gently lifts the chassis when it sinks below suspension range,
        // restoring wheel-ground contact without the old teleport jitter.
        if (this.chassisBody.position.y < 0.4) {
            this.chassisBody.position.y += (0.5 - this.chassisBody.position.y) * 0.4;
            if (this.chassisBody.velocity.y < 0) this.chassisBody.velocity.y = 1.0;
        }

        // ── Stuck detection ──────────────────────────────────────────────────
        // Upward impulse after 1.5 s of throttle with no speed gain.
        if (this.isOccupied && throttle && spd < 4) {
            this.stuckTimer += dt;
            if (this.stuckTimer > 1.0) {
                this.chassisBody.applyImpulse(
                    new CANNON.Vec3(0, 1500, 0),
                    new CANNON.Vec3(0, 0, 0)
                );
                this.stuckTimer = 0;
            }
        } else {
            this.stuckTimer = 0;
        }

        // Wake up every frame while occupied — defeats world-level allowSleep
        if (this.isOccupied) this.chassisBody.wakeUp();
    }

    public resetPosition() {
        this.chassisBody.position.set(-5, 1.0, 5);
        this.chassisBody.velocity.set(0, 0, 0);
        this.chassisBody.angularVelocity.set(0, 0, 0);
        this.currentSteeringValue = 0;
    }

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
            // Auto-align camera behind bike
            _bikeFwd.set(0, 0, 1).applyQuaternion(
                this.chassisBody.quaternion as unknown as THREE.Quaternion
            );
            const targetYaw = Math.atan2(_bikeFwd.x, _bikeFwd.z) + Math.PI;
            let diff = targetYaw - this.camYaw;
            while (diff >  Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            this.camYaw += diff * Math.min(1, 4 * dt);
        }

        const dynDist = this.CAM_DIST + this.getSpeedKmh() * 0.04;

        _camTarget.set(
            this.chassisMesh.position.x,
            this.chassisMesh.position.y + 0.8,
            this.chassisMesh.position.z
        );

        _camPos.set(
            _camTarget.x + dynDist * Math.sin(this.camYaw) * Math.cos(this.camPitch),
            _camTarget.y + dynDist * Math.sin(this.camPitch),
            _camTarget.z + dynDist * Math.cos(this.camYaw) * Math.cos(this.camPitch)
        );

        // FIX: normalize lerp factor by frame time so camera speed is the same at any Hz
        const baseLerp = Math.min(0.22, 0.12 + this.getSpeedKmh() * 0.003);
        const lerpT    = 1 - Math.pow(1 - baseLerp, 60 * dt);
        this.camera.position.lerp(_camPos, lerpT);
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

    public boostSpeed() { this.speedBoostTimer = 5.0; }
}
