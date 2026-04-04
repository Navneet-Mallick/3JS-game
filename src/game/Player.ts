import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Input } from './Input';
import { Weapon } from './Weapon';

// Pre-allocated — zero per-frame heap allocations
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

    // Camera
    private yaw   = 0;
    private pitch = 0.38;
    private readonly ORBIT_DIST = 8;
    private readonly MIN_PITCH  = 0.1;
    private readonly MAX_PITCH  = 0.7;
    private firstPerson = false;

    private weapon: Weapon;
    private playerInVehicle = false;

    // Cheat system
    private cheatBuffer = '';
    private cheatTimeout = 0;
    public  health  = 100;
    public  armor   = 0;
    public  wantedLevel = 0;

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

        this.weapon = new Weapon(scene, world, camera);
        this.body.addEventListener('collide', () => { this.onGround = true; this.groundTimer = 0.15; });
        this.camera.position.set(0, 5, this.ORBIT_DIST);
        this.camera.lookAt(0, 1, 0);

        // Cheat key listener
        window.addEventListener('keydown', (e) => this.handleCheat(e.key));
    }

    // ── Tommy Vercetti — teal hawaiian shirt, dark slicked hair, pearl necklace ──
    private buildModel(): THREE.Group {
        const g = new THREE.Group();

        const skin    = new THREE.MeshLambertMaterial({ color: 0xc8845a });  // tan skin
        const hair    = new THREE.MeshLambertMaterial({ color: 0x120a00 });  // very dark brown
        const shirt   = new THREE.MeshLambertMaterial({ color: 0x2ab8b0 });  // teal/cyan hawaiian
        const shirtD  = new THREE.MeshLambertMaterial({ color: 0x1e8a84 });  // darker teal for depth
        const pants   = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });  // dark trousers
        const shoes   = new THREE.MeshLambertMaterial({ color: 0x0a0a0a });  // black shoes
        const eyeM    = new THREE.MeshLambertMaterial({ color: 0x050505 });
        const browM   = new THREE.MeshLambertMaterial({ color: 0x1a0a00 });
        const pearl   = new THREE.MeshLambertMaterial({ color: 0xf0ece0 });  // pearl necklace

        const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x=0, y=0, z=0) => {
            const m = new THREE.Mesh(geo, mat);
            m.position.set(x, y, z);
            g.add(m);
            return m;
        };

        // ── HEAD ──
        // Main head — slightly wider jaw
        add(new THREE.BoxGeometry(0.38, 0.42, 0.36), skin, 0, 1.76, 0);
        // Jaw/chin — slightly wider at bottom
        add(new THREE.BoxGeometry(0.34, 0.12, 0.34), skin, 0, 1.56, 0);
        // Forehead slightly narrower
        add(new THREE.BoxGeometry(0.36, 0.10, 0.34), skin, 0, 1.94, 0);

        // ── HAIR — slicked back, dark, flat top ──
        add(new THREE.BoxGeometry(0.38, 0.05, 0.32), hair, 0, 2.00, -0.01);   // top flat
        add(new THREE.BoxGeometry(0.36, 0.18, 0.06), hair, 0, 1.92, -0.17);   // back sweep
        add(new THREE.BoxGeometry(0.05, 0.30, 0.30), hair, -0.185, 1.88, 0);  // left side
        add(new THREE.BoxGeometry(0.05, 0.30, 0.30), hair,  0.185, 1.88, 0);  // right side
        // Widow's peak / front hairline
        add(new THREE.BoxGeometry(0.20, 0.04, 0.06), hair, 0, 1.98, 0.16);

        // ── FACE DETAILS ──
        // Brow ridge — strong brows like Tommy
        add(new THREE.BoxGeometry(0.14, 0.04, 0.05), browM, -0.10, 1.84, 0.18);
        add(new THREE.BoxGeometry(0.14, 0.04, 0.05), browM,  0.10, 1.84, 0.18);
        // Eyes
        add(new THREE.BoxGeometry(0.08, 0.055, 0.04), eyeM, -0.10, 1.77, 0.18);
        add(new THREE.BoxGeometry(0.08, 0.055, 0.04), eyeM,  0.10, 1.77, 0.18);
        // Nose bridge
        add(new THREE.BoxGeometry(0.06, 0.10, 0.06), skin, 0, 1.70, 0.18);
        // Mouth line
        add(new THREE.BoxGeometry(0.12, 0.025, 0.04), browM, 0, 1.62, 0.18);
        // Ears
        add(new THREE.BoxGeometry(0.04, 0.10, 0.08), skin, -0.20, 1.74, 0);
        add(new THREE.BoxGeometry(0.04, 0.10, 0.08), skin,  0.20, 1.74, 0);

        // ── NECK ──
        add(new THREE.BoxGeometry(0.20, 0.18, 0.20), skin, 0, 1.48, 0);

        // ── PEARL NECKLACE ──
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI; // front half arc
            const nx = Math.sin(a - Math.PI/2) * 0.12;
            const ny = 1.42;
            const nz = Math.cos(a - Math.PI/2) * 0.10 + 0.05;
            add(new THREE.BoxGeometry(0.04, 0.04, 0.04), pearl, nx, ny, nz);
        }

        // ── TORSO — open collar teal hawaiian shirt ──
        // Main shirt body
        const torso = add(new THREE.BoxGeometry(0.60, 0.72, 0.30), shirt, 0, 1.16, 0);
        torso.castShadow = true;
        // Shirt sides slightly darker for depth
        add(new THREE.BoxGeometry(0.06, 0.70, 0.30), shirtD, -0.30, 1.16, 0);
        add(new THREE.BoxGeometry(0.06, 0.70, 0.30), shirtD,  0.30, 1.16, 0);
        // Open collar V — skin showing
        add(new THREE.BoxGeometry(0.16, 0.22, 0.32), skin, 0, 1.44, 0);
        // Collar flaps
        add(new THREE.BoxGeometry(0.12, 0.20, 0.32), shirtD, -0.14, 1.44, 0);
        add(new THREE.BoxGeometry(0.12, 0.20, 0.32), shirtD,  0.14, 1.44, 0);
        // Shirt button line
        add(new THREE.BoxGeometry(0.03, 0.50, 0.32), shirtD, 0, 1.10, 0);

        // ── ARMS — short sleeves (hawaiian shirt) ──
        this.leftArm  = add(new THREE.BoxGeometry(0.17, 0.30, 0.17), shirt, -0.40, 1.38, 0) as THREE.Mesh;
        this.rightArm = add(new THREE.BoxGeometry(0.17, 0.30, 0.17), shirt,  0.40, 1.38, 0) as THREE.Mesh;
        // Forearms — bare skin
        add(new THREE.BoxGeometry(0.15, 0.32, 0.15), skin, -0.40, 1.08, 0);
        add(new THREE.BoxGeometry(0.15, 0.32, 0.15), skin,  0.40, 1.08, 0);
        // Hands
        add(new THREE.BoxGeometry(0.14, 0.14, 0.14), skin, -0.40, 0.88, 0);
        add(new THREE.BoxGeometry(0.14, 0.14, 0.14), skin,  0.40, 0.88, 0);

        // ── BELT ──
        add(new THREE.BoxGeometry(0.60, 0.07, 0.31), new THREE.MeshLambertMaterial({ color: 0x111111 }), 0, 0.82, 0);
        add(new THREE.BoxGeometry(0.10, 0.07, 0.06), new THREE.MeshLambertMaterial({ color: 0x888844, emissive: new THREE.Color(0x444422) }), 0, 0.82, 0.16);

        // ── LEGS — dark trousers ──
        this.leftLeg  = add(new THREE.BoxGeometry(0.21, 0.72, 0.21), pants, -0.15, 0.42, 0) as THREE.Mesh;
        this.rightLeg = add(new THREE.BoxGeometry(0.21, 0.72, 0.21), pants,  0.15, 0.42, 0) as THREE.Mesh;

        // ── SHOES ──
        add(new THREE.BoxGeometry(0.22, 0.10, 0.32), shoes, -0.15, 0.05, 0.04);
        add(new THREE.BoxGeometry(0.22, 0.10, 0.32), shoes,  0.15, 0.05, 0.04);

        return g;
    }

    // ── GTA Vice City cheats ──────────────────────────────────────────────────
    private readonly CHEATS: Record<string, () => void> = {
        'ASPIRINE':    () => { this.health = 100; this.showCheat('HEALTH RESTORED'); },
        'PRECIOUSPROTECTION': () => { this.armor = 100; this.showCheat('ARMOR ADDED'); },
        'BIGBANG':     () => { this.speedBoost(); this.showCheat('SPEED BOOST!'); },
        'LEAVEMEALONE': () => { this.wantedLevel = 0; this.showCheat('WANTED LEVEL CLEARED'); },
        'CANTSEEME':   () => { this.moveSpeed = 14; setTimeout(() => this.moveSpeed = 6, 30000); this.showCheat('SUPER SPEED 30s'); },
        'CHASESTAT':   () => { this.wantedLevel = 5; this.showCheat('WANTED LEVEL MAX'); },
        'YOUWONTTAKEMEALIVE': () => { this.jumpForce = 18; setTimeout(() => this.jumpForce = 7, 20000); this.showCheat('SUPER JUMP 20s'); },
    };

    private speedBoostCb: (() => void) | null = null;
    public  onSpeedBoost: (() => void) | null = null;

    private speedBoost() {
        if (this.onSpeedBoost) this.onSpeedBoost();
    }

    private handleCheat(key: string) {
        // Only letters
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
        el.textContent = msg;
        el.style.opacity = '1';
        clearTimeout(this.cheatTimeout);
        this.cheatTimeout = window.setTimeout(() => { el.style.opacity = '0'; }, 3000);
    }

    // ── Update ────────────────────────────────────────────────────────────────
    public update(dt: number) {
        // When in vehicle — keep mesh visible, position inside car
        if (this.playerInVehicle) {
            this.mesh.visible = true;
            return; // position is set by Core when entering vehicle
        }

        if (!this.visible) { this.mesh.visible = false; return; }
        this.mesh.visible = true;

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

        if (this.body.position.y < 1.5) {
            this.body.position.y = 1.5;
            this.body.velocity.y = 0;
            this.onGround = true; this.groundTimer = 0.1;
        }

        if (Input.isKeyDown(' ') && this.onGround) {
            this.body.velocity.y = this.jumpForce;
            this.onGround = false; this.groundTimer = 0;
        }
        if (this.groundTimer > 0) { this.groundTimer -= dt; if (this.groundTimer <= 0) this.onGround = false; }

        this.mesh.position.set(this.body.position.x, this.body.position.y - 1.0, this.body.position.z);

        _weaponPos.set(this.body.position.x, this.body.position.y + 0.3, this.body.position.z);
        _euler.set(this.pitch, this.yaw, 0);
        _weaponQ.setFromEuler(_euler);
        this.weapon.updatePosition(_weaponPos, _weaponQ);
        this.weapon.setVisible(true);
        this.weapon.update(dt, _weaponPos, _weaponQ);

        if (moving) {
            this.animTime += dt * (sprinting ? 16 : 10);
            this.bobTime  += dt * (sprinting ? 16 : 10);
            const s = Math.sin(this.animTime) * 0.5;
            this.leftLeg.rotation.x  =  s; this.rightLeg.rotation.x = -s;
            this.leftArm.rotation.x  = -s * 0.5; this.rightArm.rotation.x = s * 0.5;
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

    // ── Camera ────────────────────────────────────────────────────────────────
    private updateCamera(moving: boolean, sprinting: boolean) {
        const bob = moving ? Math.sin(this.bobTime * 0.5) * (sprinting ? 0.04 : 0.02) : 0;

        if (this.firstPerson) {
            _headPos.set(this.mesh.position.x, this.mesh.position.y + 1.72, this.mesh.position.z);
            this.camera.position.copy(_headPos);
            _lookDir.set(Math.sin(this.yaw)*Math.cos(this.pitch), Math.sin(-this.pitch), Math.cos(this.yaw)*Math.cos(this.pitch));
            _headPos.add(_lookDir);
            this.camera.lookAt(_headPos);
            this.mesh.visible = false;
            return;
        }

        this.mesh.visible = true;
        _camTarget.set(this.mesh.position.x, this.mesh.position.y + 0.9 + bob, this.mesh.position.z);
        const sinY = Math.sin(this.yaw), cosY = Math.cos(this.yaw);
        const cosP = Math.cos(this.pitch), sinP = Math.sin(this.pitch);
        _camPos.set(
            _camTarget.x + this.ORBIT_DIST * sinY * cosP,
            _camTarget.y + this.ORBIT_DIST * sinP,
            _camTarget.z + this.ORBIT_DIST * cosY * cosP
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

    // Place Tommy visibly in the driver seat
    public setInVehicle(inVehicle: boolean) {
        this.playerInVehicle = inVehicle;
        this.weapon.setVisible(false);
        if (!inVehicle) {
            this.visible = true;
            this.weapon.setVisible(true);
        }
    }

    // Called every frame by Core when in vehicle to keep Tommy seated
    public seatInVehicle(carPos: THREE.Vector3, carQuat: THREE.Quaternion) {
        // Sit Tommy in driver seat — offset left and up from car centre
        const offset = new THREE.Vector3(-0.45, 0.55, 0.3);
        offset.applyQuaternion(carQuat);
        this.mesh.position.set(carPos.x + offset.x, carPos.y + offset.y, carPos.z + offset.z);
        // Face same direction as car
        this.mesh.quaternion.copy(carQuat);
        this.mesh.visible = true;
    }

    public getYaw() { return this.yaw; }
    public getWeapon(): Weapon { return this.weapon; }
}
