import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Input } from './Input';
import { Weapon } from './Weapon';

// ── Pre-allocated reusables — zero per-frame heap allocations ────────────────
const _fwdVec    = new THREE.Vector3();
const _rightVec  = new THREE.Vector3();
const _dir       = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _camPos    = new THREE.Vector3();
const _lookDir   = new THREE.Vector3();
const _headPos   = new THREE.Vector3();
const _weaponPos = new THREE.Vector3();
const _weaponQ   = new THREE.Quaternion();
const _euler     = new THREE.Euler();

export class Player {
    private scene:  THREE.Scene;
    public  body:   CANNON.Body;
    private camera: THREE.PerspectiveCamera;

    public mesh:   THREE.Group;
    public visible = true;

    private moveSpeed   = 6;
    private sprintSpeed = 11;
    private jumpForce   = 7;
    private onGround    = false;
    private groundTimer = 0;

    private leftLeg!:  THREE.Mesh;
    private rightLeg!: THREE.Mesh;
    private leftArm!:  THREE.Mesh;
    private rightArm!: THREE.Mesh;
    private animTime   = 0;
    private bobTime    = 0;

    // Camera — GTA VC style
    private yaw   = 0;
    private pitch = 0.38;
    private readonly ORBIT_DIST = 8;
    private readonly MIN_PITCH  = 0.1;
    private readonly MAX_PITCH  = 0.7;
    private firstPerson = false;

    private weapon: Weapon;
    private playerInVehicle = false;

    constructor(
        scene:  THREE.Scene,
        world:  CANNON.World,
        camera: THREE.PerspectiveCamera,
        playerMaterial?: CANNON.Material
    ) {
        this.scene  = scene;
        this.camera = camera;

        this.mesh = this.buildModel();
        this.scene.add(this.mesh);

        this.body = new CANNON.Body({
            mass:           80,
            shape:          new CANNON.Sphere(0.5),
            position:       new CANNON.Vec3(0, 2, 0),
            fixedRotation:  true,
            linearDamping:  0.92,
            angularDamping: 1.0,
            material:       playerMaterial,
        });
        world.addBody(this.body);

        this.weapon = new Weapon(scene, world, camera);

        this.body.addEventListener('collide', () => {
            this.onGround    = true;
            this.groundTimer = 0.15;
        });

        this.camera.position.set(0, 5, this.ORBIT_DIST);
        this.camera.lookAt(0, 1, 0);
    }

    // ── Tommy Vercetti model ──────────────────────────────────────────────────
    private buildModel(): THREE.Group {
        const g = new THREE.Group();

        // Shared materials — created once, reused across meshes
        const skin  = new THREE.MeshLambertMaterial({ color: 0xc8845a });
        const hair  = new THREE.MeshLambertMaterial({ color: 0x0d0800 });
        const suit  = new THREE.MeshLambertMaterial({ color: 0xf0ede0 });
        const shirt = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const pants = new THREE.MeshLambertMaterial({ color: 0xe8e4d0 });
        const shoes = new THREE.MeshLambertMaterial({ color: 0x1a0f00 });
        const eyeM  = new THREE.MeshLambertMaterial({ color: 0x050505 });
        const belt  = new THREE.MeshLambertMaterial({ color: 0x111111 });

        const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x=0, y=0, z=0, shadow=false) => {
            const m = new THREE.Mesh(geo, mat);
            m.position.set(x, y, z);
            if (shadow) m.castShadow = true;
            g.add(m);
            return m;
        };

        // Head + hair
        add(new THREE.BoxGeometry(0.36, 0.40, 0.34), skin, 0, 1.76, 0, true);
        add(new THREE.BoxGeometry(0.36, 0.06, 0.30), hair, 0, 1.99, -0.02);
        add(new THREE.BoxGeometry(0.04, 0.28, 0.30), hair, -0.18, 1.88, -0.02);
        add(new THREE.BoxGeometry(0.04, 0.28, 0.30), hair,  0.18, 1.88, -0.02);
        add(new THREE.BoxGeometry(0.34, 0.30, 0.06), hair, 0, 1.88, -0.18);
        // Eyes
        add(new THREE.BoxGeometry(0.07, 0.05, 0.03), eyeM, -0.09, 1.76, 0.17);
        add(new THREE.BoxGeometry(0.07, 0.05, 0.03), eyeM,  0.09, 1.76, 0.17);
        // Collar + torso
        add(new THREE.BoxGeometry(0.44, 0.20, 0.26), shirt, 0, 1.50, 0);
        add(new THREE.BoxGeometry(0.58, 0.70, 0.28), suit,  0, 1.18, 0, true);
        add(new THREE.BoxGeometry(0.10, 0.28, 0.30), shirt, -0.10, 1.38, 0.01);
        add(new THREE.BoxGeometry(0.10, 0.28, 0.30), shirt,  0.10, 1.38, 0.01);
        // Arms
        this.leftArm  = add(new THREE.BoxGeometry(0.16, 0.60, 0.16), suit, -0.38, 1.24, 0, true);
        this.rightArm = add(new THREE.BoxGeometry(0.16, 0.60, 0.16), suit,  0.38, 1.24, 0, true);
        // Hands
        add(new THREE.BoxGeometry(0.13, 0.13, 0.13), skin, -0.38, 0.90, 0);
        add(new THREE.BoxGeometry(0.13, 0.13, 0.13), skin,  0.38, 0.90, 0);
        // Belt
        add(new THREE.BoxGeometry(0.58, 0.06, 0.29), belt, 0, 0.83, 0);
        // Legs
        this.leftLeg  = add(new THREE.BoxGeometry(0.20, 0.70, 0.20), pants, -0.14, 0.43, 0, true);
        this.rightLeg = add(new THREE.BoxGeometry(0.20, 0.70, 0.20), pants,  0.14, 0.43, 0, true);
        // Shoes
        add(new THREE.BoxGeometry(0.22, 0.09, 0.30), shoes, -0.14, 0.06, 0.04);
        add(new THREE.BoxGeometry(0.22, 0.09, 0.30), shoes,  0.14, 0.06, 0.04);

        return g;
    }

    // ── Update — zero allocations ─────────────────────────────────────────────
    public update(dt: number) {
        if (!this.visible) { this.mesh.visible = false; return; }
        this.mesh.visible = true;

        // Mouse look
        this.yaw   -= Input.movementX * 0.0025;
        this.pitch -= Input.movementY * 0.0025;
        this.pitch  = Math.max(this.MIN_PITCH, Math.min(this.MAX_PITCH, this.pitch));

        if (Input.isKeyPressed('v')) this.firstPerson = !this.firstPerson;

        // Input
        const ix = ((Input.isKeyDown('d') || Input.isKeyDown('arrowright')) ? 1 : 0)
                 - ((Input.isKeyDown('a') || Input.isKeyDown('arrowleft'))  ? 1 : 0);
        const iz = ((Input.isKeyDown('s') || Input.isKeyDown('arrowdown'))  ? 1 : 0)
                 - ((Input.isKeyDown('w') || Input.isKeyDown('arrowup'))    ? 1 : 0);
        const sprinting = Input.isKeyDown('shift');

        // Direction — reuse pre-allocated vectors
        _fwdVec.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
        _rightVec.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
        _dir.set(0, 0, 0)
            .addScaledVector(_fwdVec,   iz)
            .addScaledVector(_rightVec, ix);

        const moving = _dir.lengthSq() > 0;
        const speed  = sprinting ? this.sprintSpeed : this.moveSpeed;

        if (moving) {
            _dir.normalize();
            this.body.velocity.x = _dir.x * speed;
            this.body.velocity.z = _dir.z * speed;

            // Smooth rotation toward movement direction
            const targetY = Math.atan2(_dir.x, _dir.z);
            let diff = targetY - this.mesh.rotation.y;
            while (diff >  Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            this.mesh.rotation.y += diff * Math.min(1, 14 * dt);
        } else {
            this.body.velocity.x *= 0.7;
            this.body.velocity.z *= 0.7;
        }

        // Ground clamp
        if (this.body.position.y < 1.5) {
            this.body.position.y = 1.5;
            this.body.velocity.y = 0;
            this.onGround    = true;
            this.groundTimer = 0.1;
        }

        // Jump
        if (Input.isKeyDown(' ') && this.onGround) {
            this.body.velocity.y = this.jumpForce;
            this.onGround    = false;
            this.groundTimer = 0;
        }
        if (this.groundTimer > 0) {
            this.groundTimer -= dt;
            if (this.groundTimer <= 0) this.onGround = false;
        }

        // Sync mesh
        this.mesh.position.set(
            this.body.position.x,
            this.body.position.y - 1.0,
            this.body.position.z
        );

        // Weapon — reuse vectors
        _weaponPos.set(this.body.position.x, this.body.position.y + 0.3, this.body.position.z);
        _euler.set(this.pitch, this.yaw, 0);
        _weaponQ.setFromEuler(_euler);
        this.weapon.updatePosition(_weaponPos, _weaponQ);
        this.weapon.setVisible(!this.playerInVehicle);
        this.weapon.update(dt, _weaponPos, _weaponQ);

        // Walk animation
        if (moving) {
            this.animTime += dt * (sprinting ? 16 : 10);
            this.bobTime  += dt * (sprinting ? 16 : 10);
            const s = Math.sin(this.animTime) * 0.5;
            this.leftLeg.rotation.x  =  s;
            this.rightLeg.rotation.x = -s;
            this.leftArm.rotation.x  = -s * 0.5;
            this.rightArm.rotation.x =  s * 0.5;
        } else {
            this.animTime = 0; this.bobTime = 0;
            const t = Math.min(1, 10 * dt);
            this.leftLeg.rotation.x  = THREE.MathUtils.lerp(this.leftLeg.rotation.x,  0, t);
            this.rightLeg.rotation.x = THREE.MathUtils.lerp(this.rightLeg.rotation.x, 0, t);
            this.leftArm.rotation.x  = THREE.MathUtils.lerp(this.leftArm.rotation.x,  0, t);
            this.rightArm.rotation.x = THREE.MathUtils.lerp(this.rightArm.rotation.x, 0, t);
        }

        this.updateCamera(moving, sprinting);
    }

    // ── Camera — zero allocations ─────────────────────────────────────────────
    private updateCamera(moving: boolean, sprinting: boolean) {
        const bob = moving ? Math.sin(this.bobTime * 0.5) * (sprinting ? 0.04 : 0.02) : 0;

        if (this.firstPerson) {
            _headPos.set(
                this.mesh.position.x,
                this.mesh.position.y + 1.72,
                this.mesh.position.z
            );
            this.camera.position.copy(_headPos);
            _lookDir.set(
                Math.sin(this.yaw) * Math.cos(this.pitch),
                Math.sin(-this.pitch),
                Math.cos(this.yaw) * Math.cos(this.pitch)
            );
            _headPos.add(_lookDir);
            this.camera.lookAt(_headPos);
            this.mesh.visible = false;
            return;
        }

        this.mesh.visible = true;

        // Target = Tommy's chest
        _camTarget.set(
            this.mesh.position.x,
            this.mesh.position.y + 0.9 + bob,
            this.mesh.position.z
        );

        // Desired camera position
        const sinY = Math.sin(this.yaw);
        const cosY = Math.cos(this.yaw);
        const cosP = Math.cos(this.pitch);
        const sinP = Math.sin(this.pitch);
        _camPos.set(
            _camTarget.x + this.ORBIT_DIST * sinY * cosP,
            _camTarget.y + this.ORBIT_DIST * sinP,
            _camTarget.z + this.ORBIT_DIST * cosY * cosP
        );

        // Lerp — no new Vector3 allocation
        const lerpT = sprinting ? 0.18 : 0.12;
        this.camera.position.lerp(_camPos, lerpT);
        this.camera.lookAt(_camTarget);
    }

    // ── Public API ────────────────────────────────────────────────────────────
    public getPosition() { return this.mesh.position; }

    public setPosition(x: number, y: number, z: number) {
        this.body.position.set(x, y, z);
        this.body.velocity.set(0, 0, 0);
        this.mesh.position.set(x, y - 1.0, z);
    }

    public setInVehicle(v: boolean) {
        this.playerInVehicle = v;
        this.visible = !v;
    }

    public getWeapon(): Weapon { return this.weapon; }
}
