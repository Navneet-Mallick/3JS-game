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

    // ── Enter / Exit vehicle ──────────────────────────────────────────────────
    private handleEnterExit() {
        const pressed = Input.isKeyPressed('f') ||
            (GamepadInput.connected && GamepadInput.btnXPressed()) ||
            TouchControls.enterPressed;
        if (!pressed) return;

        if (this.playerInVehicle) {
            // EXIT
            this.playerInVehicle = false;
            
            // Spawn Tommy beside the car BEFORE setting vehicle state
            const vp = this.vehicle.getPosition();
            this.player.setPosition(vp.x + 2.5, vp.y + 1.5, vp.z);
            
            // Now update states
            this.player.setInVehicle(false);   // shows Tommy, restores camera, resets velocity
            this.vehicle.isOccupied = false;
            this.vehicle.setVisible(true);

            if (this.modeBadge) {
                this.modeBadge.textContent = 'ON FOOT';
                this.modeBadge.style.color = '#00ff88';
            }
            this.sound.stopEngine();
            if (this.speedoBox) this.speedoBox.classList.remove('active');

        } else {
            // ENTER — only if close enough
            const pp = this.player.getPosition();
            const vp = this.vehicle.getPosition();
            _dp.set(pp.x - vp.x, pp.y - vp.y, pp.z - vp.z);

            if (_dp.lengthSq() < 25) {
                this.playerInVehicle = true;
                this.player.setInVehicle(true);    // hides Tommy, stops player camera, resets velocity
                this.vehicle.isOccupied = true;    // vehicle now controls camera
                this.vehicle.setVisible(true);

                if (this.modeBadge) {
                    this.modeBadge.textContent = 'IN VEHICLE';
                    this.modeBadge.style.color = '#ffff00';
                }
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
        for (let i = 0; i < this.police.length; i++) {
            const p = this.police[i];
            _dp.set(
                p.getPosition().x - playerPos.x,
                0,
                p.getPosition().z - playerPos.z
            );
            if (_dp.lengthSq() < 25600) { // 160² - larger range for police
                p.update(dt, playerPos, this.playerInVehicle && this.wantedLevel.isWanted());
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