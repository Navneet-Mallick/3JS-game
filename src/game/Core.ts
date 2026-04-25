import * as CANNON from 'cannon-es';
import * as THREE  from 'three';
import { GameScene }     from './Scene';
import { Physics }       from './Physics';
import { Player }        from './Player';
import { Vehicle }       from './Vehicle';
import { Bike }          from './Bike';
import { City }          from './City';
import { Minimap }       from './Minimap';
import { Input }         from './Input';
import { TrafficCar }    from './TrafficCar';
import { Police }        from './Police';
import { Sound }         from './Sound';
import { GamepadInput }  from './Gamepad';
import { TouchControls } from './TouchControls';
import { Pedestrian }    from './Pedestrian';
import { WantedLevel }   from './WantedLevel';
import { CrimeSystem }   from './CrimeSystem';
import { CheatSystem }   from './CheatSystem';
import { Bomb }          from './Bomb';
import { MusicSystem }   from './MusicSystem';
import { WeaponSystem }  from './WeaponSystem';

const _dp = new THREE.Vector3();

export class Core {
    private scene:       GameScene;
    private physics:     Physics;
    private player:      Player;
    private vehicle:     Vehicle;
    private bike:        Bike;
    private city:        City;
    private traffic:     TrafficCar[] = [];
    private police:      Police[] = [];
    private pedestrians: Pedestrian[] = [];
    private minimap:     Minimap;
    private sound:       Sound;
    private wantedLevel: WantedLevel;
    private crimeSystem: CrimeSystem;
    private cheatSystem: CheatSystem;
    private bombs: Bomb[] = [];
    private musicSystem: MusicSystem;
    private weaponSystem: WeaponSystem;
    
    // Reusable raycaster for bullets (performance optimization)
    private bulletRaycaster = new THREE.Raycaster();

    private lastTime        = 0;
    private playerInVehicle = false;
    private currentVehicle: 'car' | 'bike' | 'traffic' | null = null; // Track which vehicle
    private occupiedTrafficCar: TrafficCar | null = null;
    private paused          = false;
    private enterExitCooldown = 0; // FIX: debounce enter/exit so rapid F-presses can't corrupt state

    private modeBadge   = document.getElementById('mode-badge');
    private speedoEl    = document.getElementById('speedo-value');
    private gearEl      = document.getElementById('gear-value');
    private speedoBox   = document.getElementById('speedometer');
    private lockPrompt  = document.getElementById('lock-prompt');
    private pauseScreen = document.getElementById('pause-screen');
    private enterPrompt = document.getElementById('enter-prompt');
    private wantedStars = document.getElementById('wanted-stars');
    private weaponDisplay = document.getElementById('weapon-display');
    private ammoDisplay = document.getElementById('ammo-display');

    constructor() {
        try {
            Input.init();
            GamepadInput.init();
            TouchControls.init();

            this.sound   = new Sound();
            this.scene   = new GameScene();
            this.physics = new Physics();
            this.city    = new City(
                this.scene.getScene(),
                this.physics.getWorld(),
                this.physics.groundMaterial
            );

            this.player = new Player(
                this.scene.getScene(),
                this.physics.getWorld(),
                this.scene.getCamera(),
                this.physics.playerMaterial
            );

            this.vehicle = new Vehicle(
                this.scene.getScene(),
                this.physics.getWorld(),
                this.scene.getCamera(),
                new CANNON.Vec3(5, 0, 0),
                this.sound
            );

            this.bike = new Bike(
                this.scene.getScene(),
                this.physics.getWorld(),
                this.scene.getCamera(),
                new CANNON.Vec3(-5, 0, 5),
                this.sound
            );

            const trafficSpawns: [number, number, number][] = [
                [ 30, 0,  0], [-30, 0,  0],
                [  0, 0, 30], [  0, 0, -30],
                [ 55, 0, 55], [-55, 0,  55],
            ];
            for (const [x, y, z] of trafficSpawns) {
                this.traffic.push(new TrafficCar(
                    this.scene.getScene(),
                    this.physics.getWorld(),
                    new CANNON.Vec3(x, y, z)
                ));
            }

            // Spawn police cars
            const policeSpawns: [number, number, number][] = [
                [ 50, 0, -50], [-50, 0, -50],
                [ 50, 0,  50], [-50, 0,  50],
            ];
            for (const [x, y, z] of policeSpawns) {
                this.police.push(new Police(
                    this.scene.getScene(),
                    this.physics.getWorld(),
                    new CANNON.Vec3(x, y, z)
                ));
            }

            this.wantedLevel = new WantedLevel(this.scene.getScene());

            this.crimeSystem = new CrimeSystem(this.wantedLevel);

            this.musicSystem = new MusicSystem();
            this.weaponSystem = new WeaponSystem(this.sound);

            // Connect weapon system to player
            this.player.setWeaponSystem(this.weaponSystem);

            this.cheatSystem = new CheatSystem(
                this.player,
                this.vehicle,
                this.wantedLevel,
                this.sound,
                this.scene.getScene(),
                this.physics.getWorld(),
                this.musicSystem,
                this.weaponSystem
            );

            // Start with a random track
            const tracks = ['demons', 'eagles', 'keepers'];
            this.musicSystem.playTrack(tracks[Math.floor(Math.random() * tracks.length)]);

            const pedSpawns: [number, number, number][] = [
                [10, 0, 10], [-10, 0, 10], [10, 0, -10], [-10, 0, -10],
                [20, 0, 0],  [-20, 0, 0],
            ];
            for (const [x, y, z] of pedSpawns) {
                this.pedestrians.push(new Pedestrian(
                    this.scene.getScene(),
                    null,
                    new THREE.Vector3(x, y, z)
                ));
            }

            this.minimap = new Minimap('minimap-canvas');
            this.player.onSpeedBoost = () => this.vehicle.boostSpeed();
            
            // Connect weapon fire callback
            this.player.onWeaponFire = (origin, direction, damage, range) => {
                this.handleBulletFire(origin, direction, damage, range);
            };

            document.addEventListener('pointerlockchange', () => {
                const locked = !!document.pointerLockElement;
                if (locked) {
                    this.sound.ensureAudioContext();
                    this.sound.resume();
                    if (this.lockPrompt)  this.lockPrompt.style.display = 'none';
                    if (this.pauseScreen) this.pauseScreen.classList.remove('visible');
                    this.paused = false;
                } else {
                    const loading = document.getElementById('loading-screen');
                    if (loading && loading.style.display === 'none') {
                        if (this.pauseScreen) this.pauseScreen.classList.add('visible');
                        this.paused = true;
                    } else {
                        if (this.lockPrompt) this.lockPrompt.style.display = 'flex';
                    }
                }
            });

            document.addEventListener('keydown', (e) => {
                if (e.key.toLowerCase() === 'm') this.sound.toggleMute();
                
                // Weapon switching with number keys (1-5)
                if (!this.playerInVehicle) {
                    const weaponKeys: Record<string, any> = {
                        '1': 'fists',
                        '2': 'pistol',
                        '3': 'shotgun',
                        '4': 'rifle',
                        '5': 'minigun'
                    };
                    if (weaponKeys[e.key]) {
                        this.weaponSystem.switchWeapon(weaponKeys[e.key]);
                    }
                }
                
                // Pass all keys to cheat system
                this.cheatSystem.handleKeyPress(e.key);
            });

            this.init();
        } catch (err) {
            console.error('[Core] startup failed:', err);
            const s = document.getElementById('loading-screen');
            if (s) s.innerHTML = `<p style="color:red;padding:2rem">Error: ${err}</p>`;
        }
    }

    private async init() {
        const bar    = document.getElementById('loader-bar');
        const screen = document.getElementById('loading-screen');
        for (let i = 0; i <= 100; i += 10) {
            if (bar) bar.style.width = `${i}%`;
            await new Promise(r => setTimeout(r, 20));
        }
        if (screen) {
            screen.style.opacity = '0';
            setTimeout(() => {
                screen.style.display = 'none';
                if (this.lockPrompt) this.lockPrompt.style.display = 'flex';
            }, 400);
        }
        this.sound.init();
        requestAnimationFrame((t) => this.animate(t));
    }

    // ── Bullet Fire Handler ───────────────────────────────────────────────────
    private handleBulletFire(origin: THREE.Vector3, direction: THREE.Vector3, damage: number, range: number) {
        // Create raycaster for bullet
        const raycaster = new THREE.Raycaster(origin, direction, 0, range);
        
        // Muzzle flash effect
        this.createMuzzleFlash(origin, direction);
        
        // Check hits on pedestrians
        let hitSomething = false;
        let hitPosition: THREE.Vector3 | null = null;
        
        // Muzzle flash and tracer effects
        this.createMuzzleFlash(origin, direction);
        this.createTracer(origin, direction, range);
        
        for (let i = 0; i < this.pedestrians.length; i++) {
            const ped = this.pedestrians[i];
            if (ped.isDead || !ped.mesh.visible) continue;
            
            // Simple distance check first (optimization)
            const pedPos = ped.getPosition();
            const distSq = origin.distanceToSquared(pedPos);
            if (distSq > range * range) continue;
            
            // Check if ray hits pedestrian (simple sphere collision)
            const hitDist = raycaster.ray.distanceToPoint(pedPos);
            if (hitDist < 0.6) { // Slightly larger hit radius
                const killed = ped.takeDamage(damage);
                hitSomething = true;
                hitPosition = pedPos.clone().add(new THREE.Vector3(0, 1, 0)); // Hit center of body
                
                // Blood effect
                this.createBloodEffect(hitPosition);
                
                if (killed) {
                    this.wantedLevel.addWantedLevel(2);
                } else {
                    this.wantedLevel.addWantedLevel(1);
                }
                break;
            }
        }
        
        // Check hits on traffic and police
        const allVehicles = [...this.traffic, ...this.police];
        for (let i = 0; i < allVehicles.length; i++) {
            const v = allVehicles[i];
            if (v.isDead) continue;
            
            const vPos = v.getPosition();
            const distSq = origin.distanceToSquared(vPos);
            if (distSq > range * range) continue;
            
            const hitDist = raycaster.ray.distanceToPoint(vPos);
            if (hitDist < 1.8) { // Hit radius for vehicles
                v.takeDamage(damage);
                hitSomething = true;
                hitPosition = vPos.clone().add(new THREE.Vector3(0, 0.5, 0));
                
                if (v instanceof Police) {
                    this.wantedLevel.addWantedLevel(3);
                }
                break;
            }
        }
        
        // Show hit marker if we hit something
        if (hitSomething && hitPosition) {
            this.showHitMarker();
        }
    }
    
    // ── Visual Effects ────────────────────────────────────────────────────────
    private createMuzzleFlash(origin: THREE.Vector3, direction: THREE.Vector3) {
        const flashGeo = new THREE.SphereGeometry(0.2, 8, 8);
        const flashMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        const flash = new THREE.Mesh(flashGeo, flashMat);
        
        flash.position.copy(origin).add(direction.clone().multiplyScalar(0.5));
        this.scene.getScene().add(flash);
        
        let life = 1.0;
        const animate = () => {
            life -= 0.2;
            flash.scale.setScalar(life * 2);
            if (life > 0) requestAnimationFrame(animate);
            else this.scene.getScene().remove(flash);
        };
        animate();
    }

    private createTracer(origin: THREE.Vector3, direction: THREE.Vector3, range: number) {
        const tracerGeo = new THREE.BoxGeometry(0.04, 0.04, 2);
        const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 });
        const tracer = new THREE.Mesh(tracerGeo, tracerMat);
        
        tracer.position.copy(origin).add(direction.clone().multiplyScalar(4));
        tracer.lookAt(origin.clone().add(direction.clone().multiplyScalar(10)));
        this.scene.getScene().add(tracer);
        
        let life = 1.0;
        const speed = 2.5;
        const animate = () => {
            life -= 0.04;
            tracer.position.add(direction.clone().multiplyScalar(speed));
            tracer.scale.z = life * 3;
            if (life > 0) requestAnimationFrame(animate);
            else this.scene.getScene().remove(tracer);
        };
        animate();
    }

    private createBloodEffect(position: THREE.Vector3) {
        // High-quality multi-particle blood
        for (let i = 0; i < 6; i++) {
            const p = new THREE.Mesh(
                new THREE.BoxGeometry(0.1, 0.1, 0.1),
                new THREE.MeshBasicMaterial({ color: 0xaa0000 })
            );
            p.position.copy(position);
            this.scene.getScene().add(p);

            const vel = new THREE.Vector3(
                (Math.random() - 0.5) * 3,
                Math.random() * 4,
                (Math.random() - 0.5) * 3
            );

            let life = 1.0;
            const animate = () => {
                life -= 0.03;
                vel.y -= 0.15; // gravity
                p.position.add(vel.clone().multiplyScalar(0.016));
                p.scale.setScalar(life);
                if (life > 0) requestAnimationFrame(animate);
                else this.scene.getScene().remove(p);
            };
            animate();
        }
    }

    private showHitMarker() {
        const marker = document.getElementById('hit-marker');
        if (!marker) return;
        marker.style.opacity = '1';
        setTimeout(() => {
            marker.style.opacity = '0';
        }, 100);
    }

    // ── Enter / Exit vehicle ──────────────────────────────────────────────────
    // FIX: renamed to accept dt so the cooldown can be decremented in the game loop
    private handleEnterExit(dt: number = 0) {
        // Debounce: ignore rapid presses within 0.3 seconds
        if (this.enterExitCooldown > 0) return;

        const pressed = Input.isKeyPressed('f') ||
            (GamepadInput.connected && GamepadInput.btnXPressed()) ||
            TouchControls.enterPressed;
        if (!pressed) return;

        // Arm cooldown immediately
        this.enterExitCooldown = 0.30;

        if (this.playerInVehicle) {
            // ═══ EXIT VEHICLE ═══
            this.playerInVehicle = false;
            
            const currentVehicle = this.currentVehicle === 'bike' ? this.bike : (this.currentVehicle === 'traffic' ? this.occupiedTrafficCar! : this.vehicle);
            const vBody = currentVehicle.chassisBody;
            
            // FIX: use physics body position (accurate) not mesh position (may lag one frame)
            const exitX = vBody.position.x;
            const exitY = vBody.position.y; // accurate world Y regardless of slope
            const exitZ = vBody.position.z;

            // Calculate safe exit position offset in world space
            const exitOffset = new THREE.Vector3(3, 0, 0);
            exitOffset.applyQuaternion(vBody.quaternion as unknown as THREE.Quaternion);
            
            // Set player position: same horizontal offset, 1.5 units above body center
            this.player.setPosition(
                exitX + exitOffset.x,
                exitY + 1.5,
                exitZ + exitOffset.z
            );
            
            // Update states
            this.player.setInVehicle(false);
            if (this.currentVehicle === 'traffic') {
                this.occupiedTrafficCar!.isOccupied = false;
                this.occupiedTrafficCar = null;
            } else {
                currentVehicle.isOccupied = false;
            }
            currentVehicle.setVisible(true);
            this.currentVehicle = null;

            // UI updates
            if (this.modeBadge) {
                this.modeBadge.textContent = 'ON FOOT';
                this.modeBadge.style.color = '#00ff88';
            }
            TouchControls.showVehicleControls(false);
            this.sound.stopEngine();
            if (this.speedoBox) this.speedoBox.classList.remove('active');

        } else {
            // ═══ ENTER VEHICLE ═══
            const pp = this.player.getPosition();
            
            // Check car first (within 5 units = sq 25)
            const vp = this.vehicle.getPosition();
            _dp.set(pp.x - vp.x, pp.y - vp.y, pp.z - vp.z);

            if (_dp.lengthSq() < 25) {
                this.enterVehicle('car');
                return;
            }
            
            // Check bike (within 5 units)
            const bp = this.bike.getPosition();
            _dp.set(pp.x - bp.x, pp.y - bp.y, pp.z - bp.z);

            if (_dp.lengthSq() < 25) {
                this.enterVehicle('bike');
                return;
            }

            // Check all traffic cars
            for (const t of this.traffic) {
                const tp = t.getPosition();
                _dp.set(pp.x - tp.x, pp.y - tp.y, pp.z - tp.z);
                if (_dp.lengthSq() < 25) {
                    this.occupiedTrafficCar = t;
                    this.enterVehicle('traffic');
                    return;
                }
            }

            // Check all police cars
            for (const p of this.police) {
                const pp2 = p.getPosition();
                _dp.set(pp.x - pp2.x, pp.y - pp2.y, pp.z - pp2.z);
                if (_dp.lengthSq() < 25) {
                    this.occupiedTrafficCar = p;
                    this.enterVehicle('traffic');
                    return;
                }
            }
        }
    }
    
    private enterVehicle(type: 'car' | 'bike' | 'traffic') {
        this.playerInVehicle = true;
        this.currentVehicle = type;
        
        const vehicle = type === 'bike' ? this.bike : (type === 'traffic' ? this.occupiedTrafficCar! : this.vehicle);
        
        // Wake up vehicle physics
        vehicle.chassisBody.wakeUp();
        
        // FIX: seed the vehicle camera from the player's current yaw/pitch
        if (type === 'traffic') {
            this.occupiedTrafficCar!.initCamera(this.scene.getCamera(), this.player.getYaw() + Math.PI, 0.28);
        } else {
            (vehicle as any).initCamera(this.player.getYaw() + Math.PI, 0.28);
        }
        
        // Update states
        this.player.setInVehicle(true);
        if (type === 'traffic') {
            this.occupiedTrafficCar!.isOccupied = true;
        } else {
            (vehicle as any).isOccupied = true;
        }
        vehicle.setVisible(true);

        // UI updates
        if (this.modeBadge) {
            this.modeBadge.textContent = type === 'bike' ? 'ON BIKE' : 'IN VEHICLE';
            this.modeBadge.style.color = '#ffff00';
        }
        TouchControls.showVehicleControls(true);
        this.sound.startEngine();
        if (this.speedoBox) this.speedoBox.classList.add('active');
    }
    // ── Pickups & destructibles ───────────────────────────────────────────────
    private handlePickups(now: number) {
        const pos = this.playerInVehicle
            ? this.vehicle.getPosition()
            : this.player.getPosition();

        // Collectibles
        const cols = this.city.getCollectibles();
        for (let i = 0; i < cols.length; i++) {
            const c = cols[i];
            if (c.userData.collected) continue;
            _dp.set(pos.x - c.position.x, 0, pos.z - c.position.z);
            if (_dp.lengthSq() < 9) {
                c.userData.collected = true;
                c.visible = false;
                this.sound.playPickup();
            } else {
                c.rotation.y += c.userData.rotationSpeed;
                c.position.y  = 1 + Math.sin(now * 0.002 + i) * 0.2;
            }
        }

        // Power-ups
        const pups = this.city.getPowerUps();
        for (let i = 0; i < pups.length; i++) {
            const p = pups[i];
            if (p.userData.collected) continue;
            _dp.set(pos.x - p.position.x, 0, pos.z - p.position.z);
            if (_dp.lengthSq() < 6.25) {
                p.userData.collected = true;
                p.visible = false;
                this.sound.playPickup();
                if (this.playerInVehicle) this.vehicle.boostSpeed();
            } else {
                p.rotation.y += p.userData.rotationSpeed;
                p.position.y  = 1 + Math.sin(now * 0.003 + i) * 0.3;
            }
        }

        // Destructibles — only when driving fast
        if (this.playerInVehicle) {
            const spd  = this.vehicle.getSpeedKmh();
            const dest = this.city.getDestructibles();
            for (let i = 0; i < dest.length; i++) {
                const d = dest[i];
                if (!d.mesh.visible) continue;
                _dp.set(pos.x - d.mesh.position.x, 0, pos.z - d.mesh.position.z);
                if (_dp.lengthSq() < 16 && spd > 20) {
                    d.health -= spd * 0.5;
                    if (d.health <= 0) {
                        d.mesh.visible = false;
                        this.physics.getWorld().removeBody(d.body);
                        this.sound.playExplosion();
                    }
                }
            }
        }
    }

    // ── Main loop ─────────────────────────────────────────────────────────────
    private animate(time: number) {
        requestAnimationFrame((t) => this.animate(t));

        // Check for player death
        if (this.player.health <= 0) {
            const screen = document.getElementById('wasted-screen');
            if (screen) screen.classList.add('visible');
            return;
        }

        // FIX: compute dt at the very top so every code path below can use it safely
        const dt  = Math.min(0.05, (time - this.lastTime) / 1000);
        const now = time;
        this.lastTime = time;

        // Tick the enter/exit cooldown (needs dt, must be before handleEnterExit)
        if (this.enterExitCooldown > 0) this.enterExitCooldown -= dt;

        // FIX: enter/exit only fires when NOT paused, and is debounced by the cooldown
        if (!this.paused) {
            this.handleEnterExit(dt);
        }

        // Handle R key to reset stuck vehicle — FIX: branch on currentVehicle
        if (Input.isKeyPressed('r') && this.playerInVehicle) {
            if (this.currentVehicle === 'bike') {
                this.bike.resetPosition();
            } else {
                this.vehicle.resetPosition();
            }
            // Move player alongside the reset vehicle
            const rv = this.currentVehicle === 'bike' ? this.bike : (this.currentVehicle === 'traffic' ? this.occupiedTrafficCar! : this.vehicle);
            this.player.setPosition(rv.getPosition().x + 3, rv.getPosition().y + 2, rv.getPosition().z);
        }

        // Debounced wanted level decay (handled in WantedLevel.ts)
        this.wantedLevel.update(dt);

        // Handle bomb throwing (press B)
        if (Input.isKeyPressed('b') && !this.playerInVehicle) {
            const playerPos = this.player.getPosition();
            const bombPos = new THREE.Vector3(playerPos.x, playerPos.y + 1, playerPos.z);
            const bomb = new Bomb(
                this.scene.getScene(),
                this.physics.getWorld(),
                bombPos,
                this.sound
            );
            
            // Apply damage logic when bomb explodes
            bomb.onExplode = (pos) => {
                // Damage pedestrians
                this.pedestrians.forEach(p => {
                    const dist = p.getPosition().distanceTo(pos);
                    if (dist < 15) p.takeDamage(100);
                });
                
                // Damage vehicles
                [...this.traffic, ...this.police].forEach(v => {
                    const dist = v.getPosition().distanceTo(pos);
                    if (dist < 18) v.takeDamage(100);
                });
                
                // Damage main vehicles
                const v = this.vehicle as any;
                if (v.takeDamage && this.vehicle.getPosition().distanceTo(pos) < 18) v.takeDamage(100);
                const b = this.bike as any;
                if (b.takeDamage && this.bike.getPosition().distanceTo(pos) < 10) b.takeDamage(100);
                
                // Damage player if too close
                const playerDist = this.player.getPosition().distanceTo(pos);
                if (playerDist < 12) {
                    this.player.health -= (12 - playerDist) * 8;
                }
            };
            
            this.bombs.push(bomb);
        }

        if (this.paused) {
            Input.clearPerFrameData();
            return;
        }

        GamepadInput.poll();

        this.physics.update(dt);

        // ── KEY FIX: player and vehicle are mutually exclusive ──
        if (!this.playerInVehicle) {
            this.player.update(dt);   // player controls camera on foot
        }
        
        // Update both vehicles
        this.vehicle.update(dt);
        this.bike.update(dt);

        // ── World boundary clamp ─────────────────────────────────────────────
        // Safety net: if anything escapes the city bounds (±230 units) send it
        // back to spawn. This catches edge cases where the broadphase fix above
        // isn't enough (e.g. very high speed launches over the city edge).
        const WORLD_LIMIT = 230;
        if (this.playerInVehicle) {
            const cv = this.currentVehicle === 'bike' ? this.bike : (this.currentVehicle === 'traffic' ? this.occupiedTrafficCar! : this.vehicle);
            const cp = cv.chassisBody.position;
            if (Math.abs(cp.x) > WORLD_LIMIT || Math.abs(cp.z) > WORLD_LIMIT) {
                cv.resetPosition();
                this.player.setPosition(5, 2, 3);
            }
        } else {
            const pp = this.player.body.position;
            if (Math.abs(pp.x) > WORLD_LIMIT || Math.abs(pp.z) > WORLD_LIMIT) {
                this.player.setPosition(0, 2, 0);
            }
        }

        // Reference position for LOD and UI
        const playerPos = this.playerInVehicle
            ? (this.currentVehicle === 'bike' ? this.bike.getPosition() : this.vehicle.getPosition())
            : this.player.getPosition();

        // Traffic LOD
        for (let i = 0; i < this.traffic.length; i++) {
            const t = this.traffic[i];
            _dp.set(
                t.getPosition().x - playerPos.x,
                0,
                t.getPosition().z - playerPos.z
            );
            if (_dp.lengthSq() < 16900) t.update(dt); // 130²
        }

        // Pedestrian LOD
        for (let i = 0; i < this.pedestrians.length; i++) {
            const p = this.pedestrians[i];
            _dp.set(
                p.getPosition().x - playerPos.x,
                0,
                p.getPosition().z - playerPos.z
            );
            if (_dp.lengthSq() < 10000) p.update(dt, playerPos); // 100²
        }

        // Police update and active spawning
        this.wantedLevel.update(dt);
        this.crimeSystem.update(dt);
        
        const isWanted = this.wantedLevel.isWanted();
        for (let i = 0; i < this.police.length; i++) {
            const p = this.police[i];
            const pPos = p.getPosition();
            const dSq = pPos.distanceToSquared(playerPos);
            
            // If wanted and police is too far away (> 200m), respawn it near the player
            if (isWanted && dSq > 40000) { // 200²
                const angle = Math.random() * Math.PI * 2;
                const dist = 60 + Math.random() * 40;
                const rx = playerPos.x + Math.sin(angle) * dist;
                const rz = playerPos.z + Math.cos(angle) * dist;
                p.chassisBody.position.set(rx, 5, rz);
                p.chassisBody.velocity.set(0, 0, 0);
                p.stopChase();
            }
            
            if (dSq < 32400) { // 180²
                p.update(dt, playerPos, isWanted);
            }
        }

        // Check for crimes
        if (this.playerInVehicle) {
            const speed = this.vehicle.getSpeedKmh();
            const lateralSpeed = this.vehicle.lateralSpeed;

            // Speeding
            this.crimeSystem.checkSpeeding(speed);

            // Reckless driving
            this.crimeSystem.recklessDriving(lateralSpeed);

            // Check collisions with pedestrians
            for (let i = 0; i < this.pedestrians.length; i++) {
                const p = this.pedestrians[i];
                if (p.isDead) continue;
                const pPos = p.getPosition();
                _dp.set(playerPos.x - pPos.x, 0, playerPos.z - pPos.z);
                if (_dp.lengthSq() < 4) { // 2 unit radius
                    this.crimeSystem.hitPedestrianWithVehicle(p, speed);
                }
            }
        }
        
        // Remove police update from here as it's merged above

        // Pedestrian update (with cleanup of dead ones)
        for (let i = this.pedestrians.length - 1; i >= 0; i--) {
            const p = this.pedestrians[i];
            
            // If dead and player is far away, remove from scene
            if (p.isDead) {
                const distSq = p.getPosition().distanceToSquared(playerPos);
                if (distSq > 2500) { // 50m
                    this.scene.getScene().remove(p.mesh);
                    this.pedestrians.splice(i, 1);
                    continue;
                }
            }

            _dp.set(
                p.getPosition().x - playerPos.x,
                0,
                p.getPosition().z - playerPos.z
            );
            const near = _dp.lengthSq() < 10000; // 100²
            p.mesh.visible = near;
            if (near) p.update(dt, playerPos);
        }
        
        // Spawn new pedestrians if count is low
        if (this.pedestrians.length < 12 && Math.random() < 0.01) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 50 + Math.random() * 30;
            this.pedestrians.push(new Pedestrian(
                this.scene.getScene(),
                null,
                new THREE.Vector3(playerPos.x + Math.sin(angle) * dist, 0, playerPos.z + Math.cos(angle) * dist)
            ));
        }

        // Update bombs
        for (let i = this.bombs.length - 1; i >= 0; i--) {
            if (this.bombs[i].update(dt, this.scene.getScene(), this.physics.getWorld())) {
                this.bombs.splice(i, 1);
            }
        }

        this.handlePickups(now);

        // Speedometer
        if (this.playerInVehicle) {
            const currentVehicle = this.currentVehicle === 'bike' ? this.bike : (this.currentVehicle === 'traffic' ? this.occupiedTrafficCar! : this.vehicle);
            if (this.speedoEl) this.speedoEl.textContent = String(currentVehicle.getSpeedKmh());
            if (this.gearEl) {
                // Bike and traffic cars don't have complex gear UI here yet
                this.gearEl.textContent = (this.currentVehicle === 'bike' || this.currentVehicle === 'traffic') ? '' : `G${this.vehicle.getGear()}`;
            }
        }

        // Wanted level display
        if (this.wantedStars) {
            const level = this.wantedLevel.getLevel();
            this.wantedStars.textContent = level > 0 ? '★'.repeat(level) : '';
        }

        // Weapon display — show on foot, hide in vehicle
        const weaponInfoPanel = document.getElementById('weapon-info');
        if (this.playerInVehicle) {
            if (weaponInfoPanel) weaponInfoPanel.style.display = 'none';
        } else {
            if (weaponInfoPanel) weaponInfoPanel.style.display = 'block';
            if (this.weaponDisplay && this.ammoDisplay) {
                const weaponStats = this.weaponSystem.getWeaponStats();
                const ammo = this.weaponSystem.getAmmo();
                this.weaponDisplay.textContent = weaponStats.name.toUpperCase();
                this.ammoDisplay.textContent = ammo === -1 ? '\u221e' : String(ammo);
            }
        }
        
        // Health and Armor display
        const healthBar = document.getElementById('health-bar');
        const armorBar = document.getElementById('armor-bar');
        if (healthBar) healthBar.style.width = `${this.player.health}%`;
        if (armorBar) armorBar.style.width = `${this.player.armor}%`;

        // FIX: unified proximity threshold — 5 units (sq 25) matches the enter check in handleEnterExit()
        if (this.enterPrompt) {
            if (!this.playerInVehicle) {
                const pp = this.player.getPosition();
                const vp = this.vehicle.getPosition();
                _dp.set(pp.x - vp.x, pp.y - vp.y, pp.z - vp.z);
                const nearCar  = _dp.lengthSq() < 25;

                const bp = this.bike.getPosition();
                _dp.set(pp.x - bp.x, pp.y - bp.y, pp.z - bp.z);
                const nearBike = _dp.lengthSq() < 25;

                let nearTraffic = false;
                for (const t of this.traffic) {
                    const tp = t.getPosition();
                    _dp.set(pp.x - tp.x, pp.y - tp.y, pp.z - tp.z);
                    if (_dp.lengthSq() < 25) { nearTraffic = true; break; }
                }
                
                if (!nearTraffic) {
                    for (const p of this.police) {
                        const pp2 = p.getPosition();
                        _dp.set(pp.x - pp2.x, pp.y - pp2.y, pp.z - pp2.z);
                        if (_dp.lengthSq() < 25) { nearTraffic = true; break; }
                    }
                }

                this.enterPrompt.style.display = (nearCar || nearBike || nearTraffic) ? 'flex' : 'none';
            } else {
                this.enterPrompt.style.display = 'none';
            }
        }

        this.minimap.update(playerPos);
        this.scene.render();
        Input.clearPerFrameData();
        TouchControls.clearFrame();
    }
}