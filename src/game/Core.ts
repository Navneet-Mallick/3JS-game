import * as CANNON from 'cannon-es';
import * as THREE  from 'three';
import { GameScene }    from './Scene';
import { Physics }      from './Physics';
import { Player }       from './Player';
import { Vehicle }      from './Vehicle';
import { City }         from './City';
import { Minimap }      from './Minimap';
import { Input }        from './Input';
import { TrafficCar }   from './TrafficCar';
import { Sound }        from './Sound';
import { GamepadInput } from './Gamepad';
import { TouchControls } from './TouchControls';
import { Pedestrian }   from './Pedestrian';

// Pre-allocated distance vector
const _dp = new THREE.Vector3();

export class Core {
    private scene:       GameScene;
    private physics:     Physics;
    private player:      Player;
    private vehicle:     Vehicle;
    private city:        City;
    private traffic:     TrafficCar[]  = [];
    private pedestrians: Pedestrian[]  = [];
    private minimap:     Minimap;
    private sound:       Sound;

    private lastTime        = 0;
    private playerInVehicle = false;
    private paused          = false;

    // UI — cached once, never queried in the loop
    private modeBadge   = document.getElementById('mode-badge');
    private speedoEl    = document.getElementById('speedo-value');
    private gearEl      = document.getElementById('gear-value');
    private speedoBox   = document.getElementById('speedometer');
    private lockPrompt  = document.getElementById('lock-prompt');
    private pauseScreen = document.getElementById('pause-screen');
    private enterPrompt = document.getElementById('enter-prompt');

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

            // Traffic — 6 cars, spread out so they don't collide at spawn
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

            // Pedestrians — 6, no physics bodies
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

            // Wire cheat speed boost to vehicle
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

    // ── Enter / Exit ──────────────────────────────────────────────────────────
   private handleEnterExit() {
    const pressed = Input.isKeyPressed('f') ||
        (GamepadInput.connected && GamepadInput.btnXPressed()) ||
        TouchControls.enterPressed;
    if (!pressed) return;

    if (this.playerInVehicle) {
        // EXIT vehicle
        this.playerInVehicle = false;
        this.player.setInVehicle(false);
        this.vehicle.isOccupied = false;
        this.vehicle.setVisible(true);
        this.player.mesh.visible = true;

        const vp = this.vehicle.getPosition();
        this.player.setPosition(vp.x + 2.5, vp.y + 1, vp.z);

        if (this.modeBadge) {
            this.modeBadge.textContent = 'ON FOOT';
            this.modeBadge.style.color = '#00ff88';
        }

        this.sound.stopEngine();
        if (this.speedoBox) this.speedoBox.classList.remove('active');

    } else {
        // ENTER vehicle
        const pp = this.player.getPosition();
        const vp = this.vehicle.getPosition();
        _dp.set(pp.x - vp.x, pp.y - vp.y, pp.z - vp.z);

        if (_dp.lengthSq() < 25) {
            this.playerInVehicle = true;
            this.player.setInVehicle(true);
            this.vehicle.isOccupied = true;
            this.vehicle.setVisible(true);   // keep car visible
            this.player.mesh.visible = false; // hide player

            if (this.modeBadge) {
                this.modeBadge.textContent = 'IN VEHICLE';
                this.modeBadge.style.color = '#ffff00';
            }

            this.sound.startEngine();
            if (this.speedoBox) this.speedoBox.classList.add('active');
        }
    }
}
    // ── Pickups ───────────────────────────────────────────────────────────────
    private handlePickups(now: number) {
        const pos = this.playerInVehicle ? this.vehicle.getPosition() : this.player.getPosition();

        // Collectibles
        const cols = this.city.getCollectibles();
        for (let i = 0; i < cols.length; i++) {
            const c = cols[i];
            if (c.userData.collected) continue;
            _dp.set(pos.x - c.position.x, 0, pos.z - c.position.z);
            if (_dp.lengthSq() < 9) { // 3²
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
            if (_dp.lengthSq() < 6.25) { // 2.5²
                p.userData.collected = true;
                p.visible = false;
                this.sound.playPickup();
                if (this.playerInVehicle) this.vehicle.boostSpeed();
            } else {
                p.rotation.y += p.userData.rotationSpeed;
                p.position.y  = 1 + Math.sin(now * 0.003 + i) * 0.3;
            }
        }

        // Destructibles
        if (this.playerInVehicle) {
            const spd  = this.vehicle.getSpeedKmh();
            const dest = this.city.getDestructibles();
            for (let i = 0; i < dest.length; i++) {
                const d = dest[i];
                if (!d.mesh.visible) continue;
                _dp.set(pos.x - d.mesh.position.x, 0, pos.z - d.mesh.position.z);
                if (_dp.lengthSq() < 16 && spd > 20) { // 4²
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

    // ── Main loop — hot path, minimal overhead ────────────────────────────────
    private animate(time: number) {
        requestAnimationFrame((t) => this.animate(t));

        // F key works even when paused
        this.handleEnterExit();

        if (this.paused) {
            Input.clearPerFrameData();
            return;
        }

        GamepadInput.poll();

        const dt  = Math.min(0.05, (time - this.lastTime) / 1000);
        const now = time; // single timestamp for the whole frame
        this.lastTime = time;

        // Physics step
        this.physics.update(dt);

        // Player + vehicle
        this.player.update(dt);
        this.vehicle.update(dt);

        // Keep Tommy visibly seated in car while driving
        if (this.playerInVehicle) {
            this.player.seatInVehicle(
                this.vehicle.chassisMesh.position,
                this.vehicle.chassisMesh.quaternion
            );
        }

        // Reference position for LOD
        const playerPos = this.playerInVehicle
            ? this.vehicle.getPosition()
            : this.player.getPosition();

        // Traffic LOD — update only if within 130 units
        for (let i = 0; i < this.traffic.length; i++) {
            const t = this.traffic[i];
            _dp.set(
                t.getPosition().x - playerPos.x,
                0,
                t.getPosition().z - playerPos.z
            );
            if (_dp.lengthSq() < 16900) t.update(dt); // 130²
        }

        // Pedestrian LOD — update + show only within 60 units
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

        // Pickups
        this.handlePickups(now);

        // UI — only update what's needed
        if (this.playerInVehicle) {
            if (this.speedoEl) this.speedoEl.textContent = String(this.vehicle.getSpeedKmh());
            if (this.gearEl)   this.gearEl.textContent   = `G${this.vehicle.getGear()}`;
        }

        if (this.enterPrompt) {
            if (!this.playerInVehicle) {
                const pp = this.player.getPosition();
                const vp = this.vehicle.getPosition();
                _dp.set(pp.x - vp.x, pp.y - vp.y, pp.z - vp.z);
                this.enterPrompt.style.display = _dp.lengthSq() < 36 ? 'flex' : 'none'; // 6²
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
