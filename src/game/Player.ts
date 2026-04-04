import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Input } from './Input';
import { Weapon } from './Weapon';

export class Player {
    private scene:  THREE.Scene;
    public  body:   CANNON.Body;
    private camera: THREE.PerspectiveCamera;

    public mesh:    THREE.Group;
    public visible  = true;

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

    // Camera orbit — GTA VC style: high angle, see Tommy clearly
    private yaw   = 0;
    private pitch = 0.38;                // ~22° above horizon — you see Tommy's full body
    private readonly ORBIT_DIST = 8;
    private readonly MIN_PITCH  = 0.1;   // never go below horizon
    private readonly MAX_PITCH  = 0.7;   // max top-down
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
            linearDamping:  0.9,
            angularDamping: 1.0,
            material:       playerMaterial,
        });
        world.addBody(this.body);

        this.weapon = new Weapon(scene, world, camera);

        this.body.addEventListener('collide', () => {
            this.onGround    = true;
            this.groundTimer = 0.15;
        });

        // Start camera behind Tommy
        this.camera.position.set(0, 5, this.ORBIT_DIST);
        this.camera.lookAt(0, 1, 0);
    }

    // ── Tommy Vercetti model ──────────────────────────────────────────────────
    private buildModel(): THREE.Group {
        const g = new THREE.Group();

        const skin   = new THREE.MeshLambertMaterial({ color: 0xc8845a });
        const hair   = new THREE.MeshLambertMaterial({ color: 0x0d0800 });
        const suit   = new THREE.MeshLambertMaterial({ color: 0xf0ede0 }); // cream-white jacket
        const shirt  = new THREE.MeshLambertMaterial({ color: 0x111111 }); // black shirt
        const pants  = new THREE.MeshLambertMaterial({ color: 0xe8e4d0 }); // white trousers
        const shoes  = new THREE.MeshLambertMaterial({ color: 0x1a0f00 });
        const eyeM   = new THREE.MeshLambertMaterial({ color: 0x050505 });

        // Head
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.40, 0.34), skin);
        head.position.y = 1.76; head.castShadow = true; g.add(head);

        // Hair — slicked back
        const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.06, 0.30), hair);
        hairTop.position.set(0, 1.99, -0.02); g.add(hairTop);
        const hairL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.28, 0.30), hair);
        hairL.position.set(-0.18, 1.88, -0.02); g.add(hairL);
        const hairR = hairL.clone(); hairR.position.set(0.18, 1.88, -0.02); g.add(hairR);
        const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.30, 0.06), hair);
        hairBack.position.set(0, 1.88, -0.18); g.add(hairBack);

        // Eyes
        const lEye = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.03), eyeM);
        lEye.position.set(-0.09, 1.76, 0.17); g.add(lEye);
        const rEye = lEye.clone(); rEye.position.set(0.09, 1.76, 0.17); g.add(rEye);

        // Black shirt collar
        const collar = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.20, 0.26), shirt);
        collar.position.set(0, 1.50, 0); g.add(collar);

        // Suit jacket
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.70, 0.28), suit);
        torso.position.y = 1.18; torso.castShadow = true; g.add(torso);

        // Lapels
        const lapelL = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.28, 0.30), shirt);
        lapelL.position.set(-0.10, 1.38, 0.01); g.add(lapelL);
        const lapelR = lapelL.clone(); lapelR.position.set(0.10, 1.38, 0.01); g.add(lapelR);

        // Arms
        this.leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.60, 0.16), suit);
        this.leftArm.position.set(-0.38, 1.24, 0); this.leftArm.castShadow = true; g.add(this.leftArm);
        this.rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.60, 0.16), suit);
        this.rightArm.position.set(0.38, 1.24, 0); this.rightArm.castShadow = true; g.add(this.rightArm);

        // Hands
        const lHand = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.13), skin);
        lHand.position.set(-0.38, 0.90, 0); g.add(lHand);
        const rHand = lHand.clone(); rHand.position.set(0.38, 0.90, 0); g.add(rHand);

        // Belt
        const belt = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.06, 0.29),
            new THREE.MeshLambertMaterial({ color: 0x111111 }));
        belt.position.y = 0.83; g.add(belt);

        // Legs
        this.leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.70, 0.20), pants);
        this.leftLeg.position.set(-0.14, 0.43, 0); this.leftLeg.castShadow = true; g.add(this.leftLeg);
        this.rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.70, 0.20), pants);
        this.rightLeg.position.set(0.14, 0.43, 0); this.rightLeg.castShadow = true; g.add(this.rightLeg);

        // Shoes
        const lShoe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.09, 0.30), shoes);
        lShoe.position.set(-0.14, 0.06, 0.04); g.add(lShoe);
        const rShoe = lShoe.clone(); rShoe.position.set(0.14, 0.06, 0.04); g.add(rShoe);

        return g;
    }

    // ── Update ────────────────────────────────────────────────────────────────
    public update(dt: number) {
        if (!this.visible) { this.mesh.visible = false; return; }
        this.mesh.visible = true;

        // Mouse look — works with OR without pointer lock
        this.yaw   -= Input.movementX * 0.0025;
        this.pitch -= Input.movementY * 0.0025;
        this.pitch  = Math.max(this.MIN_PITCH, Math.min(this.MAX_PITCH, this.pitch));

        if (Input.isKeyPressed('v')) this.firstPerson = !this.firstPerson;

        // Movement — WASD + arrow keys
        const goRight = (Input.isKeyDown('d') || Input.isKeyDown('arrowright')) ? 1 : 0;
        const goLeft  = (Input.isKeyDown('a') || Input.isKeyDown('arrowleft'))  ? 1 : 0;
        const goBack  = (Input.isKeyDown('s') || Input.isKeyDown('arrowdown'))  ? 1 : 0;
        const goFwd   = (Input.isKeyDown('w') || Input.isKeyDown('arrowup'))    ? 1 : 0;
        const ix = goRight - goLeft;
        const iz = goBack  - goFwd;
        const sprinting = Input.isKeyDown('shift');

        // Direction relative to camera yaw
        const fwdVec   = new THREE.Vector3( Math.sin(this.yaw), 0,  Math.cos(this.yaw));
        const rightVec = new THREE.Vector3( Math.cos(this.yaw), 0, -Math.sin(this.yaw));
        const dir = new THREE.Vector3()
            .addScaledVector(fwdVec,   iz)
            .addScaledVector(rightVec, ix);
        const moving = dir.lengthSq() > 0;
        const speed  = sprinting ? this.sprintSpeed : this.moveSpeed;

        if (moving) {
            dir.normalize();
            this.body.velocity.x = dir.x * speed;
            this.body.velocity.z = dir.z * speed;

            // Rotate Tommy to face movement direction
            const targetY = Math.atan2(dir.x, dir.z);
            let diff = targetY - this.mesh.rotation.y;
            while (diff >  Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            this.mesh.rotation.y += diff * Math.min(1, 14 * dt);
        } else {
            this.body.velocity.x *= 0.7;
            this.body.velocity.z *= 0.7;
        }

        // Ground clamp — keep player on surface
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

        // Sync mesh to physics (offset so feet sit on ground)
        this.mesh.position.set(
            this.body.position.x,
            this.body.position.y - 1.0,
            this.body.position.z
        );

        // Weapon
        const camOrigin = new THREE.Vector3(
            this.body.position.x,
            this.body.position.y + 0.3,
            this.body.position.z
        );
        const camQuat = new THREE.Quaternion()
            .setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0));
        this.weapon.updatePosition(camOrigin, camQuat);
        this.weapon.setVisible(!this.playerInVehicle);
        this.weapon.update(dt, camOrigin, camQuat);

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

    // ── Camera — GTA VC style ─────────────────────────────────────────────────
    private updateCamera(moving: boolean, sprinting: boolean) {
        const bob = moving ? Math.sin(this.bobTime * 0.5) * (sprinting ? 0.04 : 0.02) : 0;

        if (this.firstPerson) {
            const headPos = new THREE.Vector3(
                this.mesh.position.x,
                this.mesh.position.y + 1.72,
                this.mesh.position.z
            );
            this.camera.position.copy(headPos);
            this.camera.lookAt(headPos.clone().add(new THREE.Vector3(
                Math.sin(this.yaw) * Math.cos(this.pitch),
                Math.sin(-this.pitch),
                Math.cos(this.yaw) * Math.cos(this.pitch)
            )));
            this.mesh.visible = false;
            return;
        }

        this.mesh.visible = true;

        // Look at Tommy's chest — so you see his full body
        const target = new THREE.Vector3(
            this.mesh.position.x,
            this.mesh.position.y + 0.9 + bob,
            this.mesh.position.z
        );

        // Camera position: orbit behind + above
        const cx = target.x + this.ORBIT_DIST * Math.sin(this.yaw)   * Math.cos(this.pitch);
        const cy = target.y + this.ORBIT_DIST * Math.sin(this.pitch);
        const cz = target.z + this.ORBIT_DIST * Math.cos(this.yaw)   * Math.cos(this.pitch);

        const lerpT = sprinting ? 0.18 : 0.12;
        this.camera.position.lerp(new THREE.Vector3(cx, cy, cz), lerpT);
        this.camera.lookAt(target);
    }

    // ── Public API ────────────────────────────────────────────────────────────
    public getPosition() { return this.mesh.position; }

    public setPosition(x: number, y: number, z: number) {
        this.body.position.set(x, y, z);
        this.body.velocity.set(0, 0, 0);
        this.mesh.position.set(x, y - 1.0, z);
    }

    public setInVehicle(inVehicle: boolean) {
        this.playerInVehicle = inVehicle;
        this.visible = !inVehicle;
    }

    public getHealth()  { return 100; }
    public getArmor()   { return 0; }
    public getWeapon(): Weapon { return this.weapon; }
}
