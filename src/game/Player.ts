import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Input } from './Input';

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

    constructor(scene: THREE.Scene, world: CANNON.World, camera: THREE.PerspectiveCamera) {
        this.scene  = scene;
        this.camera = camera;

        this.mesh = this.buildModel();
        this.scene.add(this.mesh);

        this.body = new CANNON.Body({
            mass: 80,
            shape: new CANNON.Sphere(0.4),
            position: new CANNON.Vec3(0, 3, 0),
            fixedRotation: true,
            linearDamping: 0.85,
            angularDamping: 1.0,
        });
        world.addBody(this.body);

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

        const skin   = new THREE.MeshStandardMaterial({ color: 0xffc8a0, roughness: 0.7 });
        const jacket = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5, metalness: 0.2 });
        const pants  = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.9 });
        const shoes  = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.2, metalness: 0.4 });
        const neon   = new THREE.MeshStandardMaterial({ color: 0x00f2ff, emissive: 0x00f2ff, emissiveIntensity: 4 });

        const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, 0.28), skin);
        head.position.y = 1.76; head.castShadow = true; g.add(head);

        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.54, 0.22), jacket);
        torso.position.y = 1.26; torso.castShadow = true; g.add(torso);

        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.44, 0.24), neon);
        stripe.position.y = 1.26; g.add(stripe);

        this.leftArm  = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.46, 0.13), jacket);
        this.leftArm.position.set(-0.3, 1.26, 0); this.leftArm.castShadow = true; g.add(this.leftArm);

        this.rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.46, 0.13), jacket);
        this.rightArm.position.set(0.3, 1.26, 0); this.rightArm.castShadow = true; g.add(this.rightArm);

        this.leftLeg  = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.54, 0.16), pants);
        this.leftLeg.position.set(-0.11, 0.73, 0); this.leftLeg.castShadow = true; g.add(this.leftLeg);

        this.rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.54, 0.16), pants);
        this.rightLeg.position.set(0.11, 0.73, 0); this.rightLeg.castShadow = true; g.add(this.rightLeg);

        const mkShoe = () => {
            const s = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.1, 0.22), shoes);
            s.position.set(0, -0.28, 0.04); return s;
        };
        this.leftLeg.add(mkShoe());
        this.rightLeg.add(mkShoe());

        return g;
    }

    public update(dt: number) {
        if (!this.visible) { this.mesh.visible = false; return; }
        this.mesh.visible = true;

        // Mouse look
        if (Input.isPointerLocked) {
            this.yaw   -= Input.movementX * 0.0022;
            this.pitch -= Input.movementY * 0.0022;
            this.pitch  = Math.max(this.MIN_PITCH, Math.min(this.MAX_PITCH, this.pitch));
        }

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
            this.body.velocity.x = dir.x * speed;
            this.body.velocity.z = dir.z * speed;

            const targetY = Math.atan2(dir.x, dir.z);
            let diff = targetY - this.mesh.rotation.y;
            while (diff >  Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            this.mesh.rotation.y += diff * Math.min(1, 18 * dt);
        }

        // Jump
        if (Input.isKeyDown(' ') && this.onGround) {
            this.body.velocity.y = this.jumpForce;
            this.onGround  = false;
            this.groundTimer = 0;
        }

        if (this.groundTimer > 0) { this.groundTimer -= dt; this.onGround = true; }
        else { this.onGround = false; }

        // Sync mesh
        this.mesh.position.set(
            this.body.position.x,
            this.body.position.y - 0.4,
            this.body.position.z
        );

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
}
