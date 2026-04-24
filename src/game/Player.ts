import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Input } from './Input';

// Pre-allocated — zero per-frame heap allocations
const _fwdVec    = new THREE.Vector3();
const _rightVec  = new THREE.Vector3();
const _dir       = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _camPos    = new THREE.Vector3();
const _lookDir   = new THREE.Vector3();
const _headPos   = new THREE.Vector3();
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

    // Camera
    private yaw   = 0;
    private pitch = 0.38;
    private readonly ORBIT_DIST = 8;
    private readonly MIN_PITCH  = 0.1;
    private readonly MAX_PITCH  = 0.7;
    private firstPerson = false;

    private playerInVehicle = false;
    private cheatBuffer  = '';
    private cheatTimeout = 0;
    public  health      = 100;
    public  armor       = 0;
    public  wantedLevel = 0;

    // Callback wired by Core
    public onSpeedBoost: (() => void) | null = null;

    constructor(
        scene:  THREE.Scene,
        world:  CANNON.World,
        camera: THREE.PerspectiveCamera,
        playerMaterial?: CANNON.Material
    ) {
        this.scene  = scene;
        this.camera = camera;
        this.mesh   = this.buildModel();
        this.scene.add(this.mesh);

        this.body = new CANNON.Body({
            mass: 80, shape: new CANNON.Sphere(0.5),
            position: new CANNON.Vec3(0, 2, 0),
            fixedRotation: true, linearDamping: 0.92, angularDamping: 1.0,
            material: playerMaterial,
        });
        world.addBody(this.body);

        this.body.addEventListener('collide', () => { this.onGround = true; this.groundTimer = 0.15; });
        this.camera.position.set(0, 5, this.ORBIT_DIST);
        this.camera.lookAt(0, 1, 0);

        window.addEventListener('keydown', (e) => this.handleCheat(e.key));
    }

    // ── Tommy Vercetti model ──────────────────────────────────────────────────
    private buildModel(): THREE.Group {
        const g = new THREE.Group();

        const skin   = new THREE.MeshLambertMaterial({ color: 0xc8845a });
        const hair   = new THREE.MeshLambertMaterial({ color: 0x120a00 });
        const shirt  = new THREE.MeshLambertMaterial({ color: 0x2ab8b0 });
        const shirtD = new THREE.MeshLambertMaterial({ color: 0x1e8a84 });
        const pants  = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
        const shoes  = new THREE.MeshLambertMaterial({ color: 0x0a0a0a });
        const eyeM   = new THREE.MeshLambertMaterial({ color: 0x050505 });
        const browM  = new THREE.MeshLambertMaterial({ color: 0x1a0a00 });
        const pearl  = new THREE.MeshLambertMaterial({ color: 0xf0ece0 });

        const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x=0, y=0, z=0) => {
            const m = new THREE.Mesh(geo, mat);
            m.position.set(x, y, z);
            g.add(m);
            return m;
        };

        // HEAD
        add(new THREE.BoxGeometry(0.38, 0.42, 0.36), skin,  0, 1.76, 0);
        add(new THREE.BoxGeometry(0.34, 0.12, 0.34), skin,  0, 1.56, 0);
        add(new THREE.BoxGeometry(0.36, 0.10, 0.34), skin,  0, 1.94, 0);

        // HAIR
        add(new THREE.BoxGeometry(0.38, 0.05, 0.32), hair,  0,      2.00, -0.01);
        add(new THREE.BoxGeometry(0.36, 0.18, 0.06), hair,  0,      1.92, -0.17);
        add(new THREE.BoxGeometry(0.05, 0.30, 0.30), hair, -0.185,  1.88,  0);
        add(new THREE.BoxGeometry(0.05, 0.30, 0.30), hair,  0.185,  1.88,  0);
        add(new THREE.BoxGeometry(0.20, 0.04, 0.06), hair,  0,      1.98,  0.16);

        // FACE
        add(new THREE.BoxGeometry(0.14, 0.04, 0.05), browM, -0.10, 1.84, 0.18);
        add(new THREE.BoxGeometry(0.14, 0.04, 0.05), browM,  0.10, 1.84, 0.18);
        add(new THREE.BoxGeometry(0.08, 0.055, 0.04), eyeM, -0.10, 1.77, 0.18);
        add(new THREE.BoxGeometry(0.08, 0.055, 0.04), eyeM,  0.10, 1.77, 0.18);
        add(new THREE.BoxGeometry(0.06, 0.10, 0.06), skin,   0,    1.70, 0.18);
        add(new THREE.BoxGeometry(0.12, 0.025, 0.04), browM,  0,   1.62, 0.18);
        add(new THREE.BoxGeometry(0.04, 0.10, 0.08), skin,  -0.20, 1.74, 0);
        add(new THREE.BoxGeometry(0.04, 0.10, 0.08), skin,   0.20, 1.74, 0);

        // NECK
        add(new THREE.BoxGeometry(0.20, 0.18, 0.20), skin, 0, 1.48, 0);

        // PEARL NECKLACE
        for (let i = 0; i < 8; i++) {
            const a  = (i / 8) * Math.PI;
            const nx = Math.sin(a - Math.PI / 2) * 0.12;
            const nz = Math.cos(a - Math.PI / 2) * 0.10 + 0.05;
            add(new THREE.BoxGeometry(0.04, 0.04, 0.04), pearl, nx, 1.42, nz);
        }

        // TORSO — teal hawaiian shirt
        const torso = add(new THREE.BoxGeometry(0.60, 0.72, 0.30), shirt, 0, 1.16, 0);
        torso.castShadow = true;
        add(new THREE.BoxGeometry(0.06, 0.70, 0.30), shirtD, -0.30, 1.16, 0);
        add(new THREE.BoxGeometry(0.06, 0.70, 0.30), shirtD,  0.30, 1.16, 0);
        add(new THREE.BoxGeometry(0.16, 0.22, 0.32), skin,    0,    1.44, 0);
        add(new THREE.BoxGeometry(0.12, 0.20, 0.32), shirtD, -0.14, 1.44, 0);
        add(new THREE.BoxGeometry(0.12, 0.20, 0.32), shirtD,  0.14, 1.44, 0);
        add(new THREE.BoxGeometry(0.03, 0.50, 0.32), shirtD,  0,    1.10, 0);

        // ARMS — short sleeves
        this.leftArm  = add(new THREE.BoxGeometry(0.17, 0.30, 0.17), shirt, -0.40, 1.38, 0) as THREE.Mesh;
        this.rightArm = add(new THREE.BoxGeometry(0.17, 0.30, 0.17), shirt,  0.40, 1.38, 0) as THREE.Mesh;
        add(new THREE.BoxGeometry(0.15, 0.32, 0.15), skin, -0.40, 1.08, 0);
        add(new THREE.BoxGeometry(0.15, 0.32, 0.15), skin,  0.40, 1.08, 0);
        add(new THREE.BoxGeometry(0.14, 0.14, 0.14), skin, -0.40, 0.88, 0);
        add(new THREE.BoxGeometry(0.14, 0.14, 0.14), skin,  0.40, 0.88, 0);

        // BELT
        add(new THREE.BoxGeometry(0.60, 0.07, 0.31),
            new THREE.MeshLambertMaterial({ color: 0x111111 }), 0, 0.82, 0);
        add(new THREE.BoxGeometry(0.10, 0.07, 0.06),
            new THREE.MeshLambertMaterial({ color: 0x888844, emissive: new THREE.Color(0x444422) }), 0, 0.82, 0.16);

        // LEGS
        this.leftLeg  = add(new THREE.BoxGeometry(0.21, 0.72, 0.21), pants, -0.15, 0.42, 0) as THREE.Mesh;
        this.rightLeg = add(new THREE.BoxGeometry(0.21, 0.72, 0.21), pants,  0.15, 0.42, 0) as THREE.Mesh;

        // SHOES
        add(new THREE.BoxGeometry(0.22, 0.10, 0.32), shoes, -0.15, 0.05, 0.04);
        add(new THREE.BoxGeometry(0.22, 0.10, 0.32), shoes,  0.15, 0.05, 0.04);

        return g;
    }

    // ── Cheat codes ───────────────────────────────────────────────────────────
    private readonly CHEATS: Record<string, () => void> = {
        'ASPIRINE':           () => { this.health = 100;        this.showCheat('HEALTH RESTORED'); },
        'PRECIOUSPROTECTION': () => { this.armor  = 100;        this.showCheat('ARMOR ADDED'); },
        'BIGBANG':            () => { this.speedBoost();        this.showCheat('SPEED BOOST!'); },
        'LEAVEMEALONE':       () => { this.wantedLevel = 0;     this.showCheat('WANTED CLEARED'); },
        'CANTSEEME':          () => {
            this.moveSpeed = 14;
            setTimeout(() => this.moveSpeed = 6, 30000);
            this.showCheat('SUPER SPEED 30s');
        },
        'YOUWONTTAKEMEALIVE': () => {
            this.jumpForce = 18;
            setTimeout(() => this.jumpForce = 7, 20000);
            this.showCheat('SUPER JUMP 20s');
        },
    };

    private speedBoost() {
        if (this.onSpeedBoost) this.onSpeedBoost();
    }

    private handleCheat(key: string) {
        if (key.length !== 1) return;
        this.cheatBuffer += key.toUpperCase();
        if (this.cheatBuffer.length > 20) this.cheatBuffer = this.cheatBuffer.slice(-20);
        for (const code of Object.keys(this.CHEATS)) {
            if (this.cheatBuffer.endsWith(code)) {
                this.CHEATS[code]();
                this.cheatBuffer = '';
                return;
            }
        }
    }

    private showCheat(msg: string) {
        const el = document.getElementById('cheat-text');
        if (!el) return;
        el.textContent   = msg;
        el.style.opacity = '1';
        clearTimeout(this.cheatTimeout);
        this.cheatTimeout = window.setTimeout(() => { el.style.opacity = '0'; }, 3000);
    }

    // ── Update ────────────────────────────────────────────────────────────────
    public update(dt: number) {
        // ── KEY FIX: when in vehicle, do absolutely nothing ──
        if (this.playerInVehicle) return;

        if (!this.visible) { this.mesh.visible = false; return; }
        this.mesh.visible = true;

        // Mouse look
        this.yaw   -= Input.movementX * 0.0025;
        this.pitch -= Input.movementY * 0.0025;
        this.pitch  = Math.max(this.MIN_PITCH, Math.min(this.MAX_PITCH, this.pitch));

        if (Input.isKeyPressed('v')) this.firstPerson = !this.firstPerson;

        const ix = ((Input.isKeyDown('d') || Input.isKeyDown('arrowright')) ? 1 : 0)
                 - ((Input.isKeyDown('a') || Input.isKeyDown('arrowleft'))  ? 1 : 0);
        const iz = ((Input.isKeyDown('s') || Input.isKeyDown('arrowdown'))  ? 1 : 0)
                 - ((Input.isKeyDown('w') || Input.isKeyDown('arrowup'))    ? 1 : 0);
        const sprinting = Input.isKeyDown('shift');

        _fwdVec.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
        _rightVec.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
        _dir.set(0, 0, 0).addScaledVector(_fwdVec, iz).addScaledVector(_rightVec, ix);

        const moving = _dir.lengthSq() > 0;
        const speed  = sprinting ? this.sprintSpeed : this.moveSpeed;

        if (moving) {
            _dir.normalize();
            this.body.velocity.x = _dir.x * speed;
            this.body.velocity.z = _dir.z * speed;
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
            this.onGround = true;
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

        // Sync mesh to physics
        this.mesh.position.set(
            this.body.position.x,
            this.body.position.y - 1.0,
            this.body.position.z
        );

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
            this.animTime = 0;
            this.bobTime  = 0;
            const t = Math.min(1, 10 * dt);
            this.leftLeg.rotation.x  = THREE.MathUtils.lerp(this.leftLeg.rotation.x,  0, t);
            this.rightLeg.rotation.x = THREE.MathUtils.lerp(this.rightLeg.rotation.x, 0, t);
            this.leftArm.rotation.x  = THREE.MathUtils.lerp(this.leftArm.rotation.x,  0, t);
            this.rightArm.rotation.x = THREE.MathUtils.lerp(this.rightArm.rotation.x, 0, t);
        }

        this.updateCamera(moving, sprinting);
    }

    // ── Camera ────────────────────────────────────────────────────────────────
    private updateCamera(moving: boolean, sprinting: boolean) {
        const bob = moving
            ? Math.sin(this.bobTime * 0.5) * (sprinting ? 0.04 : 0.02)
            : 0;

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
        _camTarget.set(
            this.mesh.position.x,
            this.mesh.position.y + 0.9 + bob,
            this.mesh.position.z
        );
        _camPos.set(
            _camTarget.x + this.ORBIT_DIST * Math.sin(this.yaw) * Math.cos(this.pitch),
            _camTarget.y + this.ORBIT_DIST * Math.sin(this.pitch),
            _camTarget.z + this.ORBIT_DIST * Math.cos(this.yaw) * Math.cos(this.pitch)
        );
        this.camera.position.lerp(_camPos, sprinting ? 0.18 : 0.12);
        this.camera.lookAt(_camTarget);
    }

    // ── Public API ────────────────────────────────────────────────────────────
    public getPosition() { return this.mesh.position; }

    public setPosition(x: number, y: number, z: number) {
        this.body.position.set(x, y, z);
        this.body.velocity.set(0, 0, 0);
        this.mesh.position.set(x, y - 1.0, z);
    }

    // ── KEY FIX: properly hand off control to vehicle ────────────────────────
    public setInVehicle(inVehicle: boolean) {
        this.playerInVehicle = inVehicle;
        if (inVehicle) {
            this.mesh.visible = false;  // hide Tommy
        } else {
            this.mesh.visible = true;   // show Tommy
            this.visible      = true;
        }
    }

    public getYaw() { return this.yaw; }
}