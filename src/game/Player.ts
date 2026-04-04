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

        // GTA-style character materials
        const skin   = new THREE.MeshStandardMaterial({ color: 0xf4c2a1, roughness: 0.8 });
        const hair   = new THREE.MeshStandardMaterial({ color: 0x2c1810, roughness: 0.9 });
        const shirt  = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.7 });
        const jeans  = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
        const shoes  = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.6 });
        const leather = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.7 });

        // Head (larger, more visible)
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.4), skin);
        head.position.y = 1.8;
        head.castShadow = true;
        g.add(head);

        // Hair
        const hairMesh = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.15, 0.42), hair);
        hairMesh.position.y = 2.1;
        g.add(hairMesh);

        // Torso (larger, more prominent)
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.3), shirt);
        torso.position.y = 1.3;
        torso.castShadow = true;
        g.add(torso);

        // Arms (longer, more visible)
        this.leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), shirt);
        this.leftArm.position.set(-0.4, 1.4, 0);
        this.leftArm.castShadow = true;
        g.add(this.leftArm);

        this.rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), shirt);
        this.rightArm.position.set(0.4, 1.4, 0);
        this.rightArm.castShadow = true;
        g.add(this.rightArm);

        // Hands
        const leftHand = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), skin);
        leftHand.position.set(-0.4, 0.9, 0);
        g.add(leftHand);

        const rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), skin);
        rightHand.position.set(0.4, 0.9, 0);
        g.add(rightHand);

        // Legs (longer, more realistic)
        this.leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.22), jeans);
        this.leftLeg.position.set(-0.15, 0.4, 0);
        this.leftLeg.castShadow = true;
        g.add(this.leftLeg);

        this.rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.22), jeans);
        this.rightLeg.position.set(0.15, 0.4, 0);
        this.rightLeg.castShadow = true;
        g.add(this.rightLeg);

        // Shoes (larger, more visible)
        const leftShoe = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.15, 0.35), shoes);
        leftShoe.position.set(-0.15, 0.05, 0.05);
        g.add(leftShoe);

        const rightShoe = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.15, 0.35), shoes);
        rightShoe.position.set(0.15, 0.05, 0.05);
        g.add(rightShoe);

        // Add a distinctive jacket/vest
        const vest = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.6, 0.25), leather);
        vest.position.y = 1.4;
        vest.castShadow = true;
        g.add(vest);

        // Add some detail - belt
        const belt = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.05, 0.32), leather);
        belt.position.y = 0.9;
        g.add(belt);

        // Make character more visible with emissive elements
        const glowMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x00ff00, 
            emissive: 0x00ff00, 
            emissiveIntensity: 0.3 
        });
        
        // Add glowing armband for visibility
        const armband = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.2), glowMaterial);
        armband.position.set(0.4, 1.2, 0);
        g.add(armband);

        // Add a glowing outline around the character
        const outlineMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x00ff00, 
            transparent: true, 
            opacity: 0.3,
            side: THREE.BackSide
        });
        
        // Create outline meshes for main body parts
        const headOutline = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.52, 0.42), outlineMaterial);
        headOutline.position.copy(head.position);
        g.add(headOutline);

        const torsoOutline = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.82, 0.32), outlineMaterial);
        torsoOutline.position.copy(torso.position);
        g.add(torsoOutline);

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
