import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { GameScene }   from './Scene';
import { Physics }     from './Physics';
import { Player }      from './Player';
import { Vehicle }     from './Vehicle';
import { City }        from './City';
import { Minimap }     from './Minimap';
import { Input }       from './Input';
import { TrafficCar }  from './TrafficCar';
import { Sound }       from './Sound';
import { GamepadInput } from './Gamepad';
import { TouchControls } from './TouchControls';
import { Pedestrian }  from './Pedestrian';

export class Core {
    private scene:      GameScene;
    private physics:    Physics;
    private player:     Player;
    private vehicle:    Vehicle;
    private city:       City;
    private traffic:    TrafficCar[]  = [];
    private pedestrians: Pedestrian[] = [];
    private minimap:    Minimap;
    private sound:      Sound;

    private lastTime        = 0;
    private playerInVehicle = false;
    private paused          = false;

    // UI refs
    private modeBadge   = document.getElementById('mode-badge');
    private speedoEl    = document.getElementById('speedo-value');
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
            this.city    = new City(this.scene.getScene(), this.physics.getWorld(), this.physics.groundMaterial);

            this.player  = new Player(
                this.scene.getScene(),
                this.physics.getWorld(),
                this.scene.getCamera(),
                this.physics.playerMaterial
            );

            // Spawn player's driveable car nearby
            this.vehicle = new Vehicle(
                this.scene.getScene(),
                this.physics.getWorld(),
                this.scene.getCamera(),
                new CANNON.Vec3(5, 0, 0),
                this.sound
            );

            // A handful of traffic cars — enough to feel alive
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

            // A few pedestrians for atmosphere
            const pedSpawns: [number, number, number][] = [
                [10, 1, 10], [-10, 1, 10], [10, 1, -10], [-10, 1, -10],
                [20, 1, 0],  [-20, 1, 0],
            ];
            for (const [x, y, z] of pedSpawns) {
                this.pedestrians.push(new Pedestrian(
                    this.scene.getScene(),
                    this.physics.getWorld(),
                    new THREE.Vector3(x, y, z)
                ));
            }

            this.minimap = new Minimap('minimap-canvas');

            // Pointer lock → pause/resume
            document.addEventListener('pointerlockchange', () => {
                const locked = !!document.pointerLockElement;
                if (locked) {
                    this.sound.ensureAudioContext();
                    this.sound.resume();
                    if (this.lockPrompt)  this.lockPrompt.style.display  = 'none';
                    if (this.pauseScreen) this.pauseScreen.classList.remove('visible');
                    this.paused = false;
                } else {
                    const loading = document.getElementById('loading-screen');
                    const hidden  = loading && loading.style.display === 'none';
                    if (hidden) {
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
            await new Promise(r => setTimeout(r, 25));
        }
        if (screen) {
            screen.style.opacity = '0';
            setTimeout(() => {
                screen.style.display = 'none';
                if (this.lockPrompt) this.lockPrompt.style.display = 'flex';
            }, 500);
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
            // Exit
            this.playerInVehicle = false;
            this.player.setInVehicle(false);
            this.vehicle.isOccupied = false;
            this.vehicle.setVisible(true);
            const vp = this.vehicle.getPosition();
            this.player.setPosition(vp.x + 2.5, vp.y + 1, vp.z);
            if (this.modeBadge) { this.modeBadge.textContent = 'ON FOOT'; this.modeBadge.style.color = '#00ff88'; }
            this.sound.stopEngine();
        } else {
            const dist = this.player.getPosition().distanceTo(this.vehicle.getPosition());
            if (dist < 5) {
                // Enter
                this.playerInVehicle = true;
                this.player.setInVehicle(true);
                this.vehicle.isOccupied = true;
                this.vehicle.setVisible(false);
                if (this.modeBadge) { this.modeBadge.textContent = 'IN VEHICLE'; this.modeBadge.style.color = '#ffff00'; }
                this.sound.startEngine();
            }
        }
    }

    // ── Collectibles / power-ups ──────────────────────────────────────────────
    private handlePickups() {
        const pos = this.playerInVehicle ? this.vehicle.getPosition() : this.player.getPosition();

        this.city.getCollectibles().forEach((c, i) => {
            if (c.userData.collected) return;
            if (pos.distanceTo(c.position) < 3) {
                c.userData.collected = true;
                c.visible = false;
                this.sound.playPickup();
            }
            if (!c.userData.collected) {
                c.rotation.y += c.userData.rotationSpeed;
                c.position.y  = 1 + Math.sin(Date.now() * 0.002 + i) * 0.2;
            }
        });

        this.city.getPowerUps().forEach((p, i) => {
            if (p.userData.collected) return;
            if (pos.distanceTo(p.position) < 2.5) {
                p.userData.collected = true;
                p.visible = false;
                this.sound.playPickup();
                if (this.playerInVehicle) this.vehicle.boostSpeed();
            }
            if (!p.userData.collected) {
                p.rotation.y += p.userData.rotationSpeed;
                p.position.y  = 1 + Math.sin(Date.now() * 0.003 + i) * 0.3;
            }
        });

        this.city.getDestructibles().forEach((d) => {
            if (!d.mesh.visible) return;
            const spd = this.playerInVehicle ? this.vehicle.getSpeedKmh() : 0;
            if (pos.distanceTo(d.mesh.position) < 4 && spd > 20) {
                d.health -= spd * 0.5;
                if (d.health <= 0) {
                    d.mesh.visible = false;
                    this.physics.getWorld().removeBody(d.body);
                    this.sound.playExplosion();
                }
            }
        });
    }

    // ── Main loop ─────────────────────────────────────────────────────────────
    private animate(time: number) {
        requestAnimationFrame((t) => this.animate(t));

        // F key works even when paused
        this.handleEnterExit();

        if (this.paused) {
            Input.clearPerFrameData();
            return;
        }

        try {
            GamepadInput.poll();

            const dt = Math.min(0.05, (time - this.lastTime) / 1000);
            this.lastTime = time;

            // Physics
            this.physics.update(dt);

            // Player + vehicle
            this.player.update(dt);
            this.vehicle.update(dt);

            const playerPos = this.playerInVehicle
                ? this.vehicle.getPosition()
                : this.player.getPosition();

            // Traffic — LOD: skip update if far away
            this.traffic.forEach(t => {
                if (t.getPosition().distanceTo(playerPos) < 130) t.update(dt);
            });

            // Pedestrians — LOD: hide + skip if far
            this.pedestrians.forEach(p => {
                const near = p.getPosition().distanceTo(playerPos) < 60;
                p.mesh.visible = near;
                if (near) p.update(dt, playerPos);
            });

            // Pickups
            this.handlePickups();

            // Speedo
            if (this.playerInVehicle && this.speedoEl) {
                this.speedoEl.textContent = String(this.vehicle.getSpeedKmh());
                const gearEl = document.getElementById('gear-value');
                if (gearEl) gearEl.textContent = `G${this.vehicle.getGear()}`;
            }

            // Enter prompt
            if (this.enterPrompt) {
                if (!this.playerInVehicle) {
                    const d = this.vehicle.getPosition().distanceTo(this.player.getPosition());
                    this.enterPrompt.style.display = d < 6 ? 'flex' : 'none';
                } else {
                    this.enterPrompt.style.display = 'none';
                }
            }

            this.minimap.update(playerPos);
            this.scene.render();
            Input.clearPerFrameData();
            TouchControls.clearFrame();

        } catch (err) {
            console.error('[Core] loop error:', err);
        }
    }
}
