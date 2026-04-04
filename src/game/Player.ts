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
    private sprintSpeed = 14;
    private jumpForce   = 9;
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
    private pitch = 0.22;
    private readonly ORBIT_DIST = 8;
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
            shape: new CANNON.Sphere(0.5), // Larger collision radius
            position: new CANNON.Vec3(0, 3, 0), // Start higher for visibility
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

        // Init camera position
        const py = 3 + 1.4 + this.ORBIT_DIST * Math.sin(this.pitch);
        const pz = this.ORBIT_DIST * Math.cos(this.pitch);
        this.camera.position.set(0, py, pz);
        this.camera.lookAt(0, 3 + 1.4, 0);
    }

   private buildModel(): THREE.Group {
    const g = new THREE.Group();

    // Materials
    const skin     = new THREE.MeshStandardMaterial({ color: 0xd4956a, roughness: 0.8 });
    const hair     = new THREE.MeshStandardMaterial({ color: 0x1a0a00, roughness: 0.9 });
    const shirt    = new THREE.MeshStandardMaterial({ color: 0xcc2200, roughness: 0.7 }); // Red hawaiian
    const stripes  = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }); // White stripes
    const pants    = new THREE.MeshStandardMaterial({ color: 0xf5f0e0, roughness: 0.8 }); // White pants
    const shoes    = new THREE.MeshStandardMaterial({ color: 0x3d1c00, roughness: 0.7 }); // Brown shoes
    const sole     = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });

    // ── HEAD ──
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.42, 0.36), skin);
    head.position.y = 1.78;
    head.castShadow = true;
    g.add(head);

    // Hair (slicked back)
    const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 0.34), hair);
    hairTop.position.set(0, 2.02, -0.01);
    g.add(hairTop);

    const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.08), hair);
    hairBack.position.set(0, 1.9, -0.19);
    g.add(hairBack);

    // Face details - brow ridge
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.05, 0.06), hair);
    brow.position.set(0, 1.84, 0.17);
    g.add(brow);

    // Eyes
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const leftEye = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.04), eyeMat);
    leftEye.position.set(-0.1, 1.78, 0.18);
    g.add(leftEye);

    const rightEye = leftEye.clone();
    rightEye.position.set(0.1, 1.78, 0.18);
    g.add(rightEye);

    // ── TORSO ── (hawaiian shirt)
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.72, 0.28), shirt);
    torso.position.y = 1.22;
    torso.castShadow = true;
    g.add(torso);

    // Hawaiian shirt white stripes
    for (let i = 0; i < 3; i++) {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.68, 0.30), stripes);
        stripe.position.set(-0.18 + i * 0.18, 1.22, 0);
        g.add(stripe);
    }

    // Collar
    const collar = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.30), stripes);
    collar.position.set(0, 1.55, 0);
    g.add(collar);

    // ── ARMS ──
    this.leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.16), shirt);
    this.leftArm.position.set(-0.38, 1.28, 0);
    this.leftArm.castShadow = true;
    g.add(this.leftArm);

    this.rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.16), shirt);
    this.rightArm.position.set(0.38, 1.28, 0);
    this.rightArm.castShadow = true;
    g.add(this.rightArm);

    // Hands
    const leftHand = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.14, 0.13), skin);
    leftHand.position.set(-0.38, 0.92, 0);
    g.add(leftHand);

    const rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.14, 0.13), skin);
    rightHand.position.set(0.38, 0.92, 0);
    g.add(rightHand);

    // ── BELT ──
    const beltMat = new THREE.MeshStandardMaterial({ color: 0x1a0a00, roughness: 0.6, metalness: 0.3 });
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.60, 0.07, 0.30), beltMat);
    belt.position.y = 0.85;
    g.add(belt);

    // Belt buckle
    const buckleMat = new THREE.MeshStandardMaterial({ color: 0xccaa00, metalness: 0.9, roughness: 0.1 });
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.06), buckleMat);
    buckle.position.set(0, 0.85, 0.15);
    g.add(buckle);

    // ── LEGS (white pants) ──
    this.leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.72, 0.20), pants);
    this.leftLeg.position.set(-0.14, 0.44, 0);
    this.leftLeg.castShadow = true;
    g.add(this.leftLeg);

    this.rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.72, 0.20), pants);
    this.rightLeg.position.set(0.14, 0.44, 0);
    this.rightLeg.castShadow = true;
    g.add(this.rightLeg);

    // ── SHOES ──
    const leftShoe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.32), shoes);
    leftShoe.position.set(-0.14, 0.06, 0.05);
    g.add(leftShoe);

    const leftSole = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.04, 0.33), sole);
    leftSole.position.set(-0.14, 0.01, 0.05);
    g.add(leftSole);

    const rightShoe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.32), shoes);
    rightShoe.position.set(0.14, 0.06, 0.05);
    g.add(rightShoe);

    const rightSole = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.04, 0.33), sole);
    rightSole.position.set(0.14, 0.01, 0.05);
    g.add(rightSole);

    return g;
}
    public update(dt: number) {
        if (!this.visible) { this.mesh.visible = false; return; }
        this.mesh.visible = true;

        // Mouse look
       // Mouse look works with OR without pointer lock
this.yaw -= Input.movementX * 0.0022;
this.pitch -= Input.movementY * 0.0022;
this.pitch = Math.max(this.MIN_PITCH, Math.min(this.MAX_PITCH, this.pitch));
        // Toggle first-person with V
        if (Input.isKeyPressed('v')) this.firstPerson = !this.firstPerson;

        const ix = (Input.isKeyDown('d') ? 1 : 0) - (Input.isKeyDown('a') ? 1 : 0);
        const iz = (Input.isKeyDown('s') ? 1 : 0) - (Input.isKeyDown('w') ? 1 : 0);
        const sprinting = Input.isKeyDown('shift');

        const fwd   = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
        const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
        const dir   = new THREE.Vector3().addScaledVector(fwd, iz).addScaledVector(right, ix);
        const moving = dir.lengthSq() > 0;
        const speed  = sprinting ? this.sprintSpeed : this.moveSpeed;

        if (moving) {
            dir.normalize();
            // Apply velocity directly with less damping for better movement
            this.body.velocity.x = dir.x * speed;
            this.body.velocity.z = dir.z * speed;
            
            // Keep player from falling too fast
            if (this.body.velocity.y < -10) {
                this.body.velocity.y = -10;
            }

            const targetY = Math.atan2(dir.x, dir.z);
            let diff = targetY - this.mesh.rotation.y;
            while (diff >  Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            this.mesh.rotation.y += diff * Math.min(1, 18 * dt);
        } else {
            // Stop horizontal movement when not moving
            this.body.velocity.x *= 0.8;
            this.body.velocity.z *= 0.8;
        }

        // Simple ground detection - if player is too low, push them up
        if (this.body.position.y < 1.5) {
            this.body.position.y = 1.5;
            this.body.velocity.y = 0;
            this.onGround = true;
            this.groundTimer = 0.1;
        }

        // Jump
        if (Input.isKeyDown(' ') && this.onGround) {
            this.body.velocity.y = this.jumpForce;
            this.onGround  = false;
            this.groundTimer = 0;
        }

        if (this.groundTimer > 0) { 
            this.groundTimer -= dt; 
            if (this.groundTimer <= 0) {
                this.onGround = false;
            }
        }

        // Sync mesh with physics body
        this.mesh.position.set(
            this.body.position.x,
            this.body.position.y - 0.5, // Adjust for larger collision sphere
            this.body.position.z
        );
        
        // Make character always face camera direction when moving
        if (moving) {
            this.mesh.rotation.y = this.yaw;
        }

        // Update weapon
        const cameraPos = new THREE.Vector3(
            this.body.position.x,
            this.body.position.y + 1.4,
            this.body.position.z
        );
        const cameraQuat = new THREE.Quaternion();
        cameraQuat.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0));
        
        this.weapon.updatePosition(cameraPos, cameraQuat);
        this.weapon.setVisible(!this.playerInVehicle);
        
        const weaponFired = this.weapon.update(dt, cameraPos, cameraQuat);
        if (weaponFired) {
            // Add crime for shooting
            // This will be handled by the Core class
        }

        // Walk animation + camera bob
        if (moving) {
            this.animTime += dt * (sprinting ? 18 : 11);
            this.bobTime  += dt * (sprinting ? 18 : 11);
            const s = Math.sin(this.animTime) * 0.6;
            this.leftLeg.rotation.x  =  s;
            this.rightLeg.rotation.x = -s;
            this.leftArm.rotation.x  = -s * 0.7;
            this.rightArm.rotation.x =  s * 0.7;
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
        const bob = moving ? Math.sin(this.bobTime * 0.5) * (sprinting ? 0.06 : 0.03) : 0;

        const headPos = new THREE.Vector3(
            this.mesh.position.x,
            this.mesh.position.y + 1.72,
            this.mesh.position.z
        );

        if (this.firstPerson) {
            // First-person: camera sits at head, looks where mouse points
            this.camera.position.copy(headPos);
            const lookDir = new THREE.Vector3(
                Math.sin(this.yaw) * Math.cos(this.pitch),
                Math.sin(-this.pitch),
                Math.cos(this.yaw) * Math.cos(this.pitch)
            );
            this.camera.lookAt(headPos.clone().add(lookDir));
            // Hide mesh in first person
            this.mesh.visible = false;
            return;
        }

        this.mesh.visible = true;
        const target = new THREE.Vector3(
            this.mesh.position.x,
            this.mesh.position.y + 1.4 + bob,
            this.mesh.position.z
        );

        const cx = target.x + this.ORBIT_DIST * Math.sin(this.yaw) * Math.cos(this.pitch);
        const cy = target.y + this.ORBIT_DIST * Math.sin(this.pitch);
        const cz = target.z + this.ORBIT_DIST * Math.cos(this.yaw) * Math.cos(this.pitch);

        const lerpSpeed = sprinting ? 0.18 : 0.14;
        this.camera.position.lerp(new THREE.Vector3(cx, cy, cz), lerpSpeed);
        this.camera.lookAt(target);
    }

    public getPosition() { return this.mesh.position; }

    public setPosition(x: number, y: number, z: number) {
        this.body.position.set(x, y, z);
        this.body.velocity.set(0, 0, 0);
        this.mesh.position.set(x, y - 0.4, z);
    }

    public setInVehicle(inVehicle: boolean) {
        this.playerInVehicle = inVehicle;
        this.visible = !inVehicle;
    }

    public getHealth(): number { return this.health; }
    public getArmor(): number { return this.armor; }
    public takeDamage(damage: number) {
        if (this.armor > 0) {
            const armorDamage = Math.min(damage, this.armor);
            this.armor -= armorDamage;
            damage -= armorDamage;
        }
        this.health -= damage;
    }

    public getWeapon(): Weapon { return this.weapon; }
}
