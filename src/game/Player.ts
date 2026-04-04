import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Input } from './Input';
import { Weapon } from './Weapon';

export class Player {
    private scene: THREE.Scene;
    public body: CANNON.Body;
    private camera: THREE.PerspectiveCamera;

    public mesh: THREE.Group;
    public visible = true;

    private moveSpeed   = 7;
    private sprintSpeed = 13;
    private jumpForce   = 8;
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
    private pitch = 0.25;
    private readonly ORBIT_DIST = 9;
    private readonly MIN_PITCH  = -0.15;
    private readonly MAX_PITCH  = 0.55;
    private firstPerson = false;
    private weapon: Weapon;
    private health = 100;
    private armor = 0;
    private playerInVehicle = false;

    constructor(scene: THREE.Scene, world: CANNON.World, camera: THREE.PerspectiveCamera, playerMaterial?: CANNON.Material) {
        this.scene  = scene;
        this.camera = camera;

        this.mesh = this.buildModel();
        this.scene.add(this.mesh);

        this.body = new CANNON.Body({
            mass: 80,
            shape: new CANNON.Sphere(0.5),
            position: new CANNON.Vec3(0, 3, 0),
            fixedRotation: true,
            linearDamping: 0.85,
            angularDamping: 1.0,
            material: playerMaterial || undefined
        });
        world.addBody(this.body);

        this.weapon = new Weapon(scene, world, camera);

        this.body.addEventListener('collide', () => {
            this.onGround  = true;
            this.groundTimer = 0.12;
        });

        this.camera.position.set(0, 5, this.ORBIT_DIST);
        this.camera.lookAt(0, 1.5, 0);
    }

    // ── Tommy Vercetti: white suit, black shirt, slicked dark hair ──
    private buildModel(): THREE.Group {
        const g = new THREE.Group();

        const skin    = new THREE.MeshLambertMaterial({ color: 0xc8845a });
        const hair    = new THREE.MeshLambertMaterial({ color: 0x0d0800 });
        const suit    = new THREE.MeshLambertMaterial({ color: 0xf0ede0 }); // cream-white suit jacket
        const shirt   = new THREE.MeshLambertMaterial({ color: 0x111111 }); // black shirt underneath
        const pants   = new THREE.MeshLambertMaterial({ color: 0xe8e4d0 }); // white trousers
        const shoes   = new THREE.MeshLambertMaterial({ color: 0x1a0f00 }); // dark brown shoes
        const sole    = new THREE.MeshLambertMaterial({ color: 0x080808 });
        const eyeMat  = new THREE.MeshLambertMaterial({ color: 0x0a0a0a });

        // ── HEAD ──
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.40, 0.34), skin);
        head.position.y = 1.76;
        head.castShadow = true;
        g.add(head);

        // Slicked-back dark hair — flat top + swept back
        const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.06, 0.30), hair);
        hairTop.position.set(0, 1.99, -0.02);
        g.add(hairTop);
        const hairSide1 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.28, 0.30), hair);
        hairSide1.position.set(-0.18, 1.88, -0.02);
        g.add(hairSide1);
        const hairSide2 = hairSide1.clone();
        hairSide2.position.set(0.18, 1.88, -0.02);
        g.add(hairSide2);
        const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.30, 0.06), hair);
        hairBack.position.set(0, 1.88, -0.18);
        g.add(hairBack);

        // Brow
        const brow = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 0.05), hair);
        brow.position.set(0, 1.82, 0.17);
        g.add(brow);

        // Eyes
        const lEye = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.03), eyeMat);
        lEye.position.set(-0.09, 1.76, 0.17);
        g.add(lEye);
        const rEye = lEye.clone();
        rEye.position.set(0.09, 1.76, 0.17);
        g.add(rEye);

        // ── TORSO — black shirt visible at collar ──
        const innerShirt = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.20, 0.26), shirt);
        innerShirt.position.set(0, 1.50, 0);
        g.add(innerShirt);

        // Suit jacket body
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.70, 0.28), suit);
        torso.position.y = 1.18;
        torso.castShadow = true;
        g.add(torso);

        // Jacket lapels (dark V-shape)
        const lapelL = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.28, 0.30), shirt);
        lapelL.position.set(-0.10, 1.38, 0.01);
        g.add(lapelL);
        const lapelR = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.28, 0.30), shirt);
        lapelR.position.set(0.10, 1.38, 0.01);
        g.add(lapelR);

        // ── ARMS — suit sleeves ──
        this.leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.60, 0.16), suit);
        this.leftArm.position.set(-0.38, 1.24, 0);
        this.leftArm.castShadow = true;
        g.add(this.leftArm);

        this.rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.60, 0.16), suit);
        this.rightArm.position.set(0.38, 1.24, 0);
        this.rightArm.castShadow = true;
        g.add(this.rightArm);

        // Hands (skin)
        const lHand = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.13), skin);
        lHand.position.set(-0.38, 0.90, 0);
        g.add(lHand);
        const rHand = lHand.clone();
        rHand.position.set(0.38, 0.90, 0);
        g.add(rHand);

        // ── BELT ──
        const beltMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const belt = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.06, 0.29), beltMat);
        belt.position.y = 0.83;
        g.add(belt);

        // ── LEGS — white trousers ──
        this.leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.70, 0.20), pants);
        this.leftLeg.position.set(-0.14, 0.43, 0);
        this.leftLeg.castShadow = true;
        g.add(this.leftLeg);

        this.rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.70, 0.20), pants);
        this.rightLeg.position.set(0.14, 0.43, 0);
        this.rightLeg.castShadow = true;
        g.add(this.rightLeg);

        // ── SHOES ──
        const lShoe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.09, 0.30), shoes);
        lShoe.position.set(-0.14, 0.06, 0.04);
        g.add(lShoe);
        const lSole = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.31), sole);
        lSole.position.set(-0.14, 0.01, 0.04);
        g.add(lSole);
        const rShoe = lShoe.clone();
        rShoe.position.set(0.14, 0.06, 0.04);
        g.add(rShoe);
        const rSole = lSole.clone();
        rSole.position.set(0.14, 0.01, 0.04);
        g.add(rSole);

        return g;
    }

    public update(dt: number) {
        if (!this.visible) { this.mesh.visible = false; return; }
        this.mesh.visible = true;

        // Mouse look
        this.yaw   -= Input.movementX * 0.0022;
        this.pitch -= Input.movementY * 0.0022;
        this.pitch  = Math.max(this.MIN_PITCH, Math.min(this.MAX_PITCH, this.pitch));

        if (Input.isKeyPressed('v')) this.firstPerson = !this.firstPerson;

        // WASD + Arrow keys both work
        const right  = (Input.isKeyDown('d') || Input.isKeyDown('arrowright')) ? 1 : 0;
        const left   = (Input.isKeyDown('a') || Input.isKeyDown('arrowleft'))  ? 1 : 0;
        const back   = (Input.isKeyDown('s') || Input.isKeyDown('arrowdown'))  ? 1 : 0;
        const fwd    = (Input.isKeyDown('w') || Input.isKeyDown('arrowup'))    ? 1 : 0;
        const ix = right - left;
        const iz = back  - fwd;
        const sprinting = Input.isKeyDown('shift');

        const fwdVec   = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
        const rightVec = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
        const dir = new THREE.Vector3().addScaledVector(fwdVec, iz).addScaledVector(rightVec, ix);
        const moving = dir.lengthSq() > 0;
        const speed  = sprinting ? this.sprintSpeed : this.moveSpeed;

        if (moving) {
            dir.normalize();
            this.body.velocity.x = dir.x * speed;
            this.body.velocity.z = dir.z * speed;
            if (this.body.velocity.y < -10) this.body.velocity.y = -10;

            // Smooth character rotation toward movement direction
            const targetY = Math.atan2(dir.x, dir.z);
            let diff = targetY - this.mesh.rotation.y;
            while (diff >  Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            this.mesh.rotation.y += diff * Math.min(1, 16 * dt);
        } else {
            this.body.velocity.x *= 0.75;
            this.body.velocity.z *= 0.75;
        }

        // Ground clamp
        if (this.body.position.y < 1.5) {
            this.body.position.y = 1.5;
            this.body.velocity.y = 0;
            this.onGround = true;
            this.groundTimer = 0.1;
        }

        // Jump — space or arrow up when standing still
        const jumpKey = Input.isKeyDown(' ');
        if (jumpKey && this.onGround) {
            this.body.velocity.y = this.jumpForce;
            this.onGround  = false;
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

        // Weapon
        const camOrigin = new THREE.Vector3(this.body.position.x, this.body.position.y + 0.4, this.body.position.z);
        const camQuat   = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0));
        this.weapon.updatePosition(camOrigin, camQuat);
        this.weapon.setVisible(!this.playerInVehicle);
        this.weapon.update(dt, camOrigin, camQuat);

        // Walk animation
        if (moving) {
            this.animTime += dt * (sprinting ? 18 : 11);
            this.bobTime  += dt * (sprinting ? 18 : 11);
            const s = Math.sin(this.animTime) * 0.55;
            this.leftLeg.rotation.x  =  s;
            this.rightLeg.rotation.x = -s;
            this.leftArm.rotation.x  = -s * 0.6;
            this.rightArm.rotation.x =  s * 0.6;
        } else {
            this.animTime = 0;
            this.bobTime  = 0;
            const t = Math.min(1, 10 * dt);
            this.leftLeg.rotation.x  = THREE.MathUtils.lerp(this.leftLeg.rotation.x,  0, t);
            this.rightLeg.rotation.x = THREE.MathUtils.lerp(this.rightLeg.rotation.x, 0, t);
            this.leftArm.rotation.x  = THREE.MathUtils.lerp(this.leftArm.rotation.x,  0, t);
            this.rightArm.rotation.x = THREE.MathUtils.lerp(this.rightArm.rotation.x, 0, t);
        }

        this.updateCamera(moving, sprinting, dt);
    }

    private updateCamera(moving: boolean, sprinting: boolean, _dt: number) {
        const bob = moving ? Math.sin(this.bobTime * 0.5) * (sprinting ? 0.05 : 0.025) : 0;

        if (this.firstPerson) {
            const headPos = new THREE.Vector3(
                this.mesh.position.x,
                this.mesh.position.y + 1.72,
                this.mesh.position.z
            );
            this.camera.position.copy(headPos);
            const lookDir = new THREE.Vector3(
                Math.sin(this.yaw) * Math.cos(this.pitch),
                Math.sin(-this.pitch),
                Math.cos(this.yaw) * Math.cos(this.pitch)
            );
            this.camera.lookAt(headPos.clone().add(lookDir));
            this.mesh.visible = false;
            return;
        }

        this.mesh.visible = true;

        // GTA-style: camera orbits behind and slightly above the character
        const target = new THREE.Vector3(
            this.mesh.position.x,
            this.mesh.position.y + 1.0 + bob,
            this.mesh.position.z
        );

        const cx = target.x + this.ORBIT_DIST * Math.sin(this.yaw) * Math.cos(this.pitch);
        const cy = target.y + this.ORBIT_DIST * Math.sin(this.pitch);
        const cz = target.z + this.ORBIT_DIST * Math.cos(this.yaw) * Math.cos(this.pitch);

        // Smooth camera follow — faster when sprinting
        const lerpT = sprinting ? 0.20 : 0.14;
        this.camera.position.lerp(new THREE.Vector3(cx, cy, cz), lerpT);
        this.camera.lookAt(target);
    }

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

    public getHealth(): number { return this.health; }
    public getArmor(): number  { return this.armor; }

    public takeDamage(damage: number) {
        if (this.armor > 0) {
            const armorDamage = Math.min(damage, this.armor);
            this.armor  -= armorDamage;
            damage      -= armorDamage;
        }
        this.health -= damage;
    }

    public getWeapon(): Weapon { return this.weapon; }
}
