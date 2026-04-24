import * as CANNON from 'cannon-es';
import * as THREE  from 'three';
import { GameScene }     from './Scene';
import { Physics }       from './Physics';
import { Player }        from './Player';
import { Vehicle }       from './Vehicle';
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
    private paused          = false;

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
        
        for (let i = 0; i < this.pedestrians.length; i++) {
            const ped = this.pedestrians[i];
            if (ped.isDead || !ped.mesh.visible) continue;
            
            // Simple distance check first (optimization)
            const pedPos = ped.getPosition();
            const distSq = origin.distanceToSquared(pedPos);
            if (distSq > range * range) continue;
            
            // Check if ray hits pedestrian (simple sphere collision)
            const hitDist = raycaster.ray.distanceToPoint(pedPos);
            if (hitDist < 0.5) { // Hit radius
                const killed = ped.takeDamage(damage);
                hitSomething = true;
                hitPosition = pedPos.clone();
                
                // Blood effect
                this.createBloodEffect(pedPos);
                
                if (killed) {
                    // Add wanted level for killing civilian
                    this.wantedLevel.addWantedLevel(2);
                    this.sound.playExplosion();
                } else {
                    // Add wanted level for shooting
                    this.wantedLevel.addWantedLevel(1);
                }
                break; // Bullet stops at first hit
            }
        }
        
        // Check hits on police
        for (let i = 0; i < this.police.length; i++) {
            const cop = this.police[i];
            const copPos = cop.getPosition();
            const distSq = origin.distanceToSquared(copPos);
            if (distSq > range * range) continue;
            
            const hitDist = raycaster.ray.distanceToPoint(copPos);
            if (hitDist < 1.5) { // Larger hit radius for vehicles
                // Shooting at police = instant 3 stars
                this.wantedLevel.addWantedLevel(3);
                hitSomething = true;
                hitPosition = copPos.clone();
                this.createBloodEffect(copPos);
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
        const flash = new THREE.Mesh(
            new THREE.SphereGeometry(0.15, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.8 })
        );
        flash.position.copy(origin).add(direction.clone().multiplyScalar(0.5));
        this.scene.getScene().add(flash);
        
        // Remove after 50ms using requestAnimationFrame (more efficient)
        const startTime = performance.now();
        const checkRemove = () => {
            if (performance.now() - startTime > 50) {
                this.scene.getScene().remove(flash);
            } else {
                requestAnimationFrame(checkRemove);
            }
        };
        requestAnimationFrame(checkRemove);
    }
    
    private createBloodEffect(position: THREE.Vector3) {
        // Reduced to 3 particles for performance
        for (let i = 0; i < 3; i++) {
            const particle = new THREE.Mesh(
                new THREE.SphereGeometry(0.05, 4, 4),
                new THREE.MeshBasicMaterial({ color: 0xff0000 })
            );
            particle.position.copy(position);
            particle.position.y += Math.random() * 0.5;
            this.scene.getScene().add(particle);
            
            // Animate and remove
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                Math.random() * 2,
                (Math.random() - 0.5) * 2
            );
            
            let life = 0;
            const maxLife = 0.5;
            const startTime = performance.now();
            
            const animate = () => {
                const elapsed = (performance.now() - startTime) / 1000;
                if (elapsed > maxLife) {
                    this.scene.getScene().remove(particle);
                    return; // Stop loop
                }
                particle.position.add(velocity.clone().multiplyScalar(0.016));
                velocity.y -= 9.8 * 0.016; // Gravity
                requestAnimationFrame(animate);
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
    private handleEnterExit() {
        const pressed = Input.isKeyPressed('f') ||
            (GamepadInput.connected && GamepadInput.btnXPressed()) ||
            TouchControls.enterPressed;
        if (!pressed) return;

        if (this.playerInVehicle) {
            // ═══ EXIT VEHICLE ═══
            this.playerInVehicle = false;
            
            // Get vehicle position and spawn player beside it
            const vp = this.vehicle.getPosition();
            const vBody = this.vehicle.chassisBody;
            
            // Calculate safe exit position (to the right of vehicle)
            const exitOffset = new THREE.Vector3(3, 0, 0);
            exitOffset.applyQuaternion(vBody.quaternion as unknown as THREE.Quaternion);
            
            // Set player position FIRST
            this.player.setPosition(
                vp.x + exitOffset.x, 
                vp.y + 2, 
                vp.z + exitOffset.z
            );
            
            // Then update states
            this.player.setInVehicle(false);
            this.vehicle.isOccupied = false;
            this.vehicle.setVisible(true);

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
            const vp = this.vehicle.getPosition();
            _dp.set(pp.x - vp.x, pp.y - vp.y, pp.z - vp.z);

            if (_dp.lengthSq() < 25) {
                this.playerInVehicle = true;
                
                // Wake up vehicle physics
                this.vehicle.chassisBody.wakeUp();
                
                // Update states
                this.player.setInVehicle(true);
                this.vehicle.isOccupied = true;
                this.vehicle.setVisible(true);

                // UI updates
                if (this.modeBadge) {
                    this.modeBadge.textContent = 'IN VEHICLE';
                    this.modeBadge.style.color = '#ffff00';
                }
                TouchControls.showVehicleControls(true);
                this.sound.startEngine();
                if (this.speedoBox) this.speedoBox.classList.add('active');
            }
        }
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

        // Handle F key even when paused
        this.handleEnterExit();

        // Handle R key to reset stuck vehicle
        if (Input.isKeyPressed('r') && this.playerInVehicle) {
            this.vehicle.resetPosition();
            this.player.setPosition(5, 1, 0);
        }

        // Handle wanted level cheat (press G to gain wanted level)
        if (Input.isKeyPressed('g') && this.playerInVehicle) {
            this.wantedLevel.addWantedLevel(1);
        }

        // Handle clear wanted level (press C)
        if (Input.isKeyPressed('c')) {
            this.wantedLevel.clearWantedLevel();
        }

        // Handle bomb throwing (press B)
        if (Input.isKeyPressed('b') && !this.playerInVehicle) {
            const playerPos = this.player.getPosition();
            const bombPos = new THREE.Vector3(playerPos.x, playerPos.y + 1, playerPos.z);
            this.bombs.push(new Bomb(
                this.scene.getScene(),
                this.physics.getWorld(),
                bombPos
            ));
            this.sound.playExplosion();
        }

        if (this.paused) {
            Input.clearPerFrameData();
            return;
        }

        GamepadInput.poll();

        const dt  = Math.min(0.05, (time - this.lastTime) / 1000);
        const now = time;
        this.lastTime = time;

        this.physics.update(dt);

        // ── KEY FIX: player and vehicle are mutually exclusive ──
        if (!this.playerInVehicle) {
            this.player.update(dt);   // player controls camera on foot
        }
        this.vehicle.update(dt);      // vehicle controls camera when occupied

        // Reference position for LOD and UI
        const playerPos = this.playerInVehicle
            ? this.vehicle.getPosition()
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

        // Police update
        this.wantedLevel.update(dt);
        this.crimeSystem.update(dt);

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
        
        // Police chase logic - chase if wanted level > 0 (on foot OR in vehicle)
        const isWanted = this.wantedLevel.isWanted();
        for (let i = 0; i < this.police.length; i++) {
            const p = this.police[i];
            _dp.set(
                p.getPosition().x - playerPos.x,
                0,
                p.getPosition().z - playerPos.z
            );
            if (_dp.lengthSq() < 25600) { // 160² - larger range for police
                p.update(dt, playerPos, isWanted); // Chase if wanted, regardless of vehicle
            }
        }

        // Pedestrian LOD
        for (let i = 0; i < this.pedestrians.length; i++) {
            const p = this.pedestrians[i];
            _dp.set(
                p.getPosition().x - playerPos.x,
                0,
                p.getPosition().z - playerPos.z
            );
            const near = _dp.lengthSq() < 3600; // 60²
            p.mesh.visible = near;
            if (near) p.update(dt, playerPos);
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
            if (this.speedoEl) this.speedoEl.textContent = String(this.vehicle.getSpeedKmh());
            if (this.gearEl)   this.gearEl.textContent   = `G${this.vehicle.getGear()}`;
        }

        // Wanted level display
        if (this.wantedStars) {
            const level = this.wantedLevel.getLevel();
            this.wantedStars.textContent = level > 0 ? '★'.repeat(level) : '';
        }

        // Weapon display (only on foot)
        if (!this.playerInVehicle && this.weaponDisplay && this.ammoDisplay) {
            const weaponStats = this.weaponSystem.getWeaponStats();
            const ammo = this.weaponSystem.getAmmo();
            this.weaponDisplay.textContent = weaponStats.name.toUpperCase();
            if (ammo === -1) {
                this.ammoDisplay.textContent = '∞';
            } else {
                this.ammoDisplay.textContent = String(ammo);
            }
        }
        
        // Health and Armor display
        const healthBar = document.getElementById('health-bar');
        const armorBar = document.getElementById('armor-bar');
        if (healthBar) healthBar.style.width = `${this.player.health}%`;
        if (armorBar) armorBar.style.width = `${this.player.armor}%`;

        // Enter prompt
        if (this.enterPrompt) {
            if (!this.playerInVehicle) {
                const pp = this.player.getPosition();
                const vp = this.vehicle.getPosition();
                _dp.set(pp.x - vp.x, pp.y - vp.y, pp.z - vp.z);
                this.enterPrompt.style.display = _dp.lengthSq() < 36 ? 'flex' : 'none';
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