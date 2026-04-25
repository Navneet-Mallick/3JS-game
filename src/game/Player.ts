import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Input } from './Input';
import { WeaponSystem } from './WeaponSystem';
import { TouchControls } from './TouchControls';
import { AssetManager } from './AssetManager';

// Pre-allocated — zero per-frame heap allocations
const _fwdVec    = new THREE.Vector3();
const _rightVec  = new THREE.Vector3();
const _dir       = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _camPos    = new THREE.Vector3();
const _lookDir   = new THREE.Vector3();
const _headPos   = new THREE.Vector3();
const _euler     = new THREE.Euler();
const _dtVec     = new THREE.Vector3();

export type CharacterType = 'TOMMY' | 'CJ' | 'CLAUDE';
export const CharacterType = {
    TOMMY: 'TOMMY' as CharacterType,
    CJ: 'CJ' as CharacterType,
    CLAUDE: 'CLAUDE' as CharacterType
};

export class Player {
    private scene:  THREE.Scene;
    public  body:   CANNON.Body;
    private camera: THREE.PerspectiveCamera;

    public mesh:   THREE.Group;
    public visible = true;
    public gunMesh: THREE.Group | null = null;
    
    public health: number = 100;
    public armor:  number = 0;
    public bombs:  number = 0;
    public jumpForce = 7;

    private moveSpeed   = 6;
    private sprintSpeed = 11;
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
    private characterType: CharacterType = CharacterType.TOMMY;
    private characterMeshes: Map<string, THREE.Mesh> = new Map();

    private playerInVehicle = false;
    private cheatBuffer  = '';
    private cheatTimeout = 0;


    // Weapon system
    private weaponSystem: WeaponSystem | null = null;
    private lastFireTime = 0;
    
    // Bullet system callback - wired by Core
    public onWeaponFire: ((origin: THREE.Vector3, direction: THREE.Vector3, damage: number, range: number) => void) | null = null;

    // Callback wired by Core
    public onSpeedBoost: (() => void) | null = null;

    private assetManager?: AssetManager;

    constructor(
        scene:  THREE.Scene,
        world:  CANNON.World,
        camera: THREE.PerspectiveCamera,
        playerMaterial?: CANNON.Material,
        assetManager?: AssetManager
    ) {
        this.assetManager = assetManager;
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

        // Build gun visual
        this.gunMesh = this.buildGunModel();
        this.scene.add(this.gunMesh);

        window.addEventListener('keydown', (e) => this.handleCheat(e.key));
    }

    // ── Tommy Vercetti model ──────────────────────────────────────────────────
    // ── Build Character Model ────────────────────────────────────────────────
    private buildModel(): THREE.Group {
        if (this.assetManager) {
            const gltfModel = this.assetManager.getModel('player');
            if (gltfModel) return gltfModel;
        }

        const g = new THREE.Group();
        this.characterMeshes.clear();

        // Character profiles
        const profiles = {
            [CharacterType.TOMMY]: {
                skin: 0xc8845a, shirt: 0x2ab8b0, pants: 0x2a2a2a, shoes: 0x0a0a0a, hair: 0x120a00, tank: false
            },
            [CharacterType.CJ]: {
                skin: 0x5d3a2a, shirt: 0xffffff, pants: 0x2b3d5c, shoes: 0x111111, hair: 0x000000, tank: true
            },
            [CharacterType.CLAUDE]: {
                skin: 0xf4c2a1, shirt: 0x1a1a1a, pants: 0x1a1a1a, shoes: 0x222222, hair: 0x2a1a0a, tank: false
            }
        };

        const p = profiles[this.characterType];
        const skinMat  = new THREE.MeshLambertMaterial({ color: p.skin });
        const hairMat  = new THREE.MeshLambertMaterial({ color: p.hair });
        const shirtMat = new THREE.MeshLambertMaterial({ color: p.shirt });
        const pantsMat = new THREE.MeshLambertMaterial({ color: p.pants });
        const shoesMat = new THREE.MeshLambertMaterial({ color: p.shoes });
        
        const add = (name: string, geo: THREE.BufferGeometry, mat: THREE.Material, x=0, y=0, z=0) => {
            const m = new THREE.Mesh(geo, mat);
            m.position.set(x, y, z);
            g.add(m);
            this.characterMeshes.set(name, m);
            return m;
        };

        // HEAD
        add('head', new THREE.BoxGeometry(0.38, 0.42, 0.36), skinMat, 0, 1.76, 0);
        add('hair', new THREE.BoxGeometry(0.38, 0.05, 0.32), hairMat, 0, 2.00, -0.01);
        add('neck', new THREE.BoxGeometry(0.20, 0.18, 0.20), skinMat, 0, 1.48, 0);

        // TORSO
        add('torso', new THREE.BoxGeometry(0.60, 0.72, 0.30), shirtMat, 0, 1.16, 0);
        
        // ARMS
        const armMat = p.tank ? skinMat : shirtMat;
        this.leftArm = add('leftArmUpper', new THREE.BoxGeometry(0.17, 0.30, 0.17), armMat, -0.40, 1.38, 0) as THREE.Mesh;
        this.rightArm = add('rightArmUpper', new THREE.BoxGeometry(0.17, 0.30, 0.17), armMat, 0.40, 1.38, 0) as THREE.Mesh;
        add('leftArmLower', new THREE.BoxGeometry(0.15, 0.32, 0.15), skinMat, -0.40, 1.08, 0);
        add('rightArmLower', new THREE.BoxGeometry(0.15, 0.32, 0.15), skinMat, 0.40, 1.08, 0);

        // LEGS
        this.leftLeg = add('leftLeg', new THREE.BoxGeometry(0.21, 0.72, 0.21), pantsMat, -0.15, 0.42, 0) as THREE.Mesh;
        this.rightLeg = add('rightLeg', new THREE.BoxGeometry(0.21, 0.72, 0.21), pantsMat, 0.15, 0.42, 0) as THREE.Mesh;

        // SHOES
        add('leftShoe', new THREE.BoxGeometry(0.22, 0.10, 0.32), shoesMat, -0.15, 0.05, 0.04);
        add('rightShoe', new THREE.BoxGeometry(0.22, 0.10, 0.32), shoesMat, 0.15, 0.05, 0.04);

        return g;
    }
    
    // ── Build Gun Model ───────────────────────────────────────────────────────
    private buildGunModel(): THREE.Group {
        const g = new THREE.Group();
        
        const gunMetal = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
        const gunBarrel = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
        const gunGrip = new THREE.MeshLambertMaterial({ color: 0x3a2a1a });
        
        // Barrel
        const barrel = new THREE.Mesh(
            new THREE.BoxGeometry(0.03, 0.03, 0.15),
            gunBarrel
        );
        barrel.position.set(0, 0, 0.075);
        g.add(barrel);
        
        // Body
        const body = new THREE.Mesh(
            new THREE.BoxGeometry(0.04, 0.06, 0.08),
            gunMetal
        );
        body.position.set(0, -0.01, -0.02);
        g.add(body);
        
        // Grip
        const grip = new THREE.Mesh(
            new THREE.BoxGeometry(0.03, 0.08, 0.04),
            gunGrip
        );
        grip.position.set(0, -0.05, -0.04);
        g.add(grip);
        
        // Trigger guard
        const trigger = new THREE.Mesh(
            new THREE.BoxGeometry(0.02, 0.03, 0.02),
            gunMetal
        );
        trigger.position.set(0, -0.02, -0.02);
        g.add(trigger);
        
        return g;
    }
    
    // ── Show/Hide Gun ─────────────────────────────────────────────────────────
    private updateGunVisual() {
        if (!this.weaponSystem) return;
        
        const currentWeapon = this.weaponSystem.getCurrentWeapon();
        const shouldShowGun = currentWeapon !== 'fists';
        
        if (shouldShowGun && !this.gunMesh) {
            // Create gun
            this.gunMesh = this.buildGunModel();
            this.mesh.add(this.gunMesh);
        }
        
        if (this.gunMesh) {
            this.gunMesh.visible = shouldShowGun;
            
            if (shouldShowGun) {
                // Position gun in right hand
                this.gunMesh.position.set(0.40, 0.85, 0.15);
                this.gunMesh.rotation.set(0, Math.PI / 2, 0);
            }
        }
    }

    // ── Cheat codes ───────────────────────────────────────────────────────────
    private readonly CHEATS: Record<string, () => void> = {
        'ASPIRINE':           () => { this.health = 100;        this.showCheat('HEALTH RESTORED'); },
        'PRECIOUSPROTECTION': () => { this.armor  = 100;        this.showCheat('ARMOR ADDED'); },
        'BIGBANG':            () => { this.speedBoost();        this.showCheat('SPEED BOOST!'); },
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
        'CJ': () => this.switchCharacter(CharacterType.CJ),
        'TOMMY': () => this.switchCharacter(CharacterType.TOMMY),
        'CLAUDE': () => this.switchCharacter(CharacterType.CLAUDE),
    };

    private speedBoost() {
        if (this.onSpeedBoost) this.onSpeedBoost();
    }

    public switchCharacter(type: CharacterType) {
        this.characterType = type;
        this.scene.remove(this.mesh);
        this.mesh = this.buildModel();
        this.scene.add(this.mesh);
        this.updateGunVisual(); // Re-attach gun to new mesh
        this.showCheat(`CHARACTER: ${type}`);
    }

    private handleCheat(key: string) {
        if (key.length !== 1) return;
        
        // Character toggle shortcut
        if (key.toLowerCase() === 'c') {
            const types = [CharacterType.TOMMY, CharacterType.CJ, CharacterType.CLAUDE];
            const nextIdx = (types.indexOf(this.characterType) + 1) % types.length;
            this.switchCharacter(types[nextIdx]);
            return;
        }

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
        
        // Touch look
        if (TouchControls.active) {
            this.yaw   -= TouchControls.lookX * 0.015;
            this.pitch -= TouchControls.lookY * 0.015;
        }
        
        this.pitch  = Math.max(this.MIN_PITCH, Math.min(this.MAX_PITCH, this.pitch));

        if (Input.isKeyPressed('v')) this.firstPerson = !this.firstPerson;

        // Update gun visual
        this.updateGunVisual();

        // ── Weapon firing (Left Mouse Button, E key, or Touch) ──
        const wantsToFire = Input.isKeyDown('e') || Input.isMouseDown() || TouchControls.firePressed;
        if (this.weaponSystem && wantsToFire) {
            const now = performance.now() / 1000;
            const stats = this.weaponSystem.getWeaponStats();
            if (now - this.lastFireTime >= stats.fireRate) {
                if (this.weaponSystem.fire()) {
                    this.lastFireTime = now;
                    
                    // Gun recoil animation (optimized)
                    if (this.gunMesh) {
                        const originalZ = this.gunMesh.position.z;
                        this.gunMesh.position.z -= 0.05; // Recoil back
                        // Use requestAnimationFrame instead of setTimeout
                        const startTime = performance.now();
                        const resetRecoil = () => {
                            if (performance.now() - startTime > 50) {
                                if (this.gunMesh) this.gunMesh.position.z = originalZ;
                            } else {
                                requestAnimationFrame(resetRecoil);
                            }
                        };
                        requestAnimationFrame(resetRecoil);
                    }
                    
                    // Fire bullet raycast
                    if (this.onWeaponFire && stats.range > 0) {
                        // Calculate bullet origin (from player head/gun position)
                        const origin = new THREE.Vector3(
                            this.mesh.position.x,
                            this.mesh.position.y + 1.6, // Head height
                            this.mesh.position.z
                        );
                        
                        // Calculate bullet direction (where player is looking)
                        const direction = new THREE.Vector3(
                            Math.sin(this.yaw) * Math.cos(this.pitch),
                            -Math.sin(this.pitch),
                            Math.cos(this.yaw) * Math.cos(this.pitch)
                        ).normalize();
                        
                        // Fire the bullet
                        this.onWeaponFire(origin, direction, stats.damage, stats.range);
                    }
                }
            }
        }

        // Movement input - keyboard or touch
        let ix = ((Input.isKeyDown('d') || Input.isKeyDown('arrowright')) ? 1 : 0)
               - ((Input.isKeyDown('a') || Input.isKeyDown('arrowleft'))  ? 1 : 0);
        let iz = ((Input.isKeyDown('s') || Input.isKeyDown('arrowdown'))  ? 1 : 0)
               - ((Input.isKeyDown('w') || Input.isKeyDown('arrowup'))    ? 1 : 0);
        
        // Touch joystick input
        if (TouchControls.active && (Math.abs(TouchControls.moveX) > 0.1 || Math.abs(TouchControls.moveY) > 0.1)) {
            ix = TouchControls.moveX;
            iz = TouchControls.moveY;
        }
        
        const sprinting = Input.isKeyDown('shift') || TouchControls.sprintPressed;

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
        const wantsToJump = Input.isKeyDown(' ') || TouchControls.jumpPressed;
        if (wantsToJump && this.onGround) {
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
        
        // Update gun position and visibility
        if (this.gunMesh && this.weaponSystem) {
            const currentWeapon = this.weaponSystem.getCurrentWeapon();
            const hasGun = currentWeapon !== 'fists';
            this.gunMesh.visible = hasGun && !this.firstPerson;
            
            if (hasGun) {
                // Position gun in right hand
                const gunOffset = new THREE.Vector3(0.3, 1.3, 0.3);
                gunOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.mesh.rotation.y);
                this.gunMesh.position.copy(this.mesh.position).add(gunOffset);
                this.gunMesh.rotation.y = this.mesh.rotation.y;
            }
        }

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

        this.updateCamera(moving, sprinting, dt);
    }

    // ── Camera ────────────────────────────────────────────────────────────────
    private updateCamera(moving: boolean, sprinting: boolean, dt: number) {
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
        // FIX: normalize lerp factor by frame time so camera speed is the same at any Hz
        const baseLerp = sprinting ? 0.22 : 0.15;
        const lerpT    = 1 - Math.pow(1 - baseLerp, 60 * dt);
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

    // ── KEY FIX: properly hand off control to vehicle ────────────────────────
    public setInVehicle(inVehicle: boolean) {
        this.playerInVehicle = inVehicle;
        if (inVehicle) {
            this.mesh.visible = false;  // hide Tommy
            if (this.gunMesh) this.gunMesh.visible = false; // hide gun
            // Stop all player movement when entering vehicle
            this.body.velocity.set(0, 0, 0);
            this.body.angularVelocity.set(0, 0, 0);
        } else {
            this.mesh.visible = true;   // show Tommy
            this.visible      = true;
            // Reset player velocity when exiting vehicle
            this.body.velocity.set(0, 0, 0);
            this.body.angularVelocity.set(0, 0, 0);
            this.onGround = false;
            this.groundTimer = 0;
        }
    }

    public getYaw() { return this.yaw; }

    // ── Weapon system integration ─────────────────────────────────────────────
    public setWeaponSystem(weaponSystem: WeaponSystem) {
        this.weaponSystem = weaponSystem;
    }

    public getWeaponSystem(): WeaponSystem | null {
        return this.weaponSystem;
    }
}