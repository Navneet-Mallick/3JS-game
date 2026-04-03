import * as CANNON from 'cannon-es';
import { GameScene } from './Scene';
import { Physics } from './Physics';
import { Player } from './Player';
import { Vehicle } from './Vehicle';
import { City } from './City';
import { Minimap } from './Minimap';
import { Input } from './Input';
import { TrafficCar } from './TrafficCar';
import { Sound } from './Sound';
import { MissionSystem } from './Mission';
import { ScoreSystem } from './Score';
import { GamepadInput } from './Gamepad';
import { TouchControls } from './TouchControls';

export class Core {
    private scene: GameScene;
    private physics: Physics;
    private player: Player;
    private vehicle: Vehicle;
    private city: City;
    private traffic: TrafficCar[] = [];
    private minimap: Minimap;
    private sound: Sound;
    private missions: MissionSystem;
    private score: ScoreSystem;

    private lastTime = 0;
    private playerInVehicle = false;
    private paused = false;

    private modeBadge   = document.getElementById('mode-badge');
    private lockPrompt  = document.getElementById('lock-prompt');
    private pauseScreen = document.getElementById('pause-screen');
    private speedoEl    = document.getElementById('speedometer');
    private speedVal    = document.getElementById('speed-value');
    private enterPrompt = document.getElementById('enter-prompt');

    constructor() {
        try {
            Input.init();
            GamepadInput.init();
            TouchControls.init();

            this.sound   = new Sound();
            this.scene   = new GameScene();
            this.physics = new Physics();

            this.city = new City(this.scene.getScene(), this.physics.getWorld(), this.physics.groundMaterial);

            this.player  = new Player(this.scene.getScene(), this.physics.getWorld(), this.scene.getCamera());
            this.vehicle = new Vehicle(
                this.scene.getScene(),
                this.physics.getWorld(),
                this.scene.getCamera(),
                new CANNON.Vec3(3, 1, 3),
                this.sound
            );

            const trafficSpawns: [number, number, number][] = [
                [ 30, 2,  0], [-30, 2,  0],
                [  0, 2, 30], [  0, 2, -30],
                [ 60, 2, 60], [-60, 2,  60],
                [ 60, 2,-60], [-60, 2, -60],
                [120, 2,  0], [  0, 2, 120],
            ];
            for (const [x, y, z] of trafficSpawns) {
                this.traffic.push(new TrafficCar(
                    this.scene.getScene(),
                    this.physics.getWorld(),
                    new CANNON.Vec3(x, y, z)
                ));
            }

            this.minimap  = new Minimap('minimap-canvas');
            this.missions = new MissionSystem(this.scene.getScene());
            this.score    = new ScoreSystem();

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
                    const hidden  = loading && loading.style.display === 'none';
                    if (hidden) {
                        if (this.pauseScreen) this.pauseScreen.classList.add('visible');
                        this.paused = true;
                    } else {
                        if (this.lockPrompt) this.lockPrompt.style.display = 'flex';
                    }
                }
            });

            // Mute toggle
            document.addEventListener('keydown', (e) => {
                if (e.key.toLowerCase() === 'm') this.sound.toggleMute();
            });

            this.init();
        } catch (err) {
            console.error('[Core constructor] failed:', err);
            const screen = document.getElementById('loading-screen');
            if (screen) screen.innerHTML = `<p style="color:red;font-family:monospace;padding:2rem">Startup Error: ${err}</p>`;
        }
    }

    private async init() {
        try {
            const bar    = document.getElementById('loader-bar');
            const screen = document.getElementById('loading-screen');

            for (let i = 0; i <= 100; i += 10) {
                if (bar) bar.style.width = `${i}%`;
                await new Promise(r => setTimeout(r, 30));
            }

            if (screen) {
                screen.style.opacity = '0';
                setTimeout(() => {
                    screen.style.display = 'none';
                    if (this.lockPrompt) this.lockPrompt.style.display = 'flex';
                }, 600);
            }

            this.sound.init();
            this.missions.start();

            requestAnimationFrame((t) => this.animate(t));
        } catch (err) {
            console.error('[Core.init] failed:', err);
            const screen = document.getElementById('loading-screen');
            if (screen) screen.innerHTML = `<p style="color:red;font-family:monospace;padding:2rem">Error: ${err}</p>`;
        }
    }

    private handleEnterExit() {
        const enterKey = Input.isKeyPressed('f') ||
            (GamepadInput.connected && GamepadInput.btnXPressed()) ||
            TouchControls.enterPressed;

        if (!enterKey) return;

        if (this.playerInVehicle) {
            this.playerInVehicle = false;
            this.vehicle.isOccupied = false;
            this.player.visible = true;
            const vp = this.vehicle.getPosition();
            this.player.setPosition(vp.x + 3, vp.y + 1, vp.z);
            if (this.modeBadge) this.modeBadge.textContent = 'On Foot';
            if (this.speedoEl)  this.speedoEl.classList.remove('active');
            this.sound.stopEngine();
        } else {
            const vp = this.vehicle.getPosition();
            const pp = this.player.getPosition();
            if (vp.distanceTo(pp) < 6) {
                this.playerInVehicle = true;
                this.vehicle.isOccupied = true;
                this.player.visible = false;
                if (this.modeBadge) this.modeBadge.textContent = 'Driving';
                if (this.speedoEl)  this.speedoEl.classList.add('active');
                this.sound.startEngine();
            }
        }
    }

    private handleInteractions() {
        const playerPos = this.playerInVehicle ? this.vehicle.getPosition() : this.player.getPosition();
        
        // Handle collectibles
        const collectibles = this.city.getCollectibles();
        collectibles.forEach((collectible, index) => {
            if (!collectible.userData || collectible.userData.collected) return;
            
            const distance = playerPos.distanceTo(collectible.position);
            if (distance < 3) {
                collectible.userData.collected = true;
                collectible.visible = false;
                this.score.add(100, 'COLLECTIBLE');
                this.sound.playPickup();
            }
            
            // Animate collectibles
            if (!collectible.userData.collected && collectible.userData.rotationSpeed) {
                collectible.rotation.y += collectible.userData.rotationSpeed;
                collectible.position.y = 1 + Math.sin(Date.now() * 0.002 + index) * 0.2;
            }
        });
        
        // Handle destructibles
        const destructibles = this.city.getDestructibles();
        destructibles.forEach((destructible) => {
            if (!destructible.mesh || !destructible.body) return;
            
            const distance = playerPos.distanceTo(destructible.mesh.position);
            const velocity = this.playerInVehicle ? 
                this.vehicle.getSpeedKmh() : 
                (this.player.body ? Math.sqrt(this.player.body.velocity.x ** 2 + this.player.body.velocity.z ** 2) * 10 : 0);
            
            if (distance < 4 && velocity > 20) {
                destructible.health -= velocity * 0.5;
                
                if (destructible.health <= 0) {
                    // Destroy the destructible
                    destructible.mesh.visible = false;
                    this.physics.getWorld().removeBody(destructible.body);
                    this.score.add(50, 'DESTRUCTION');
                    this.sound.playExplosion();
                } else {
                    // Damage effect
                    const material = destructible.mesh.material as THREE.MeshStandardMaterial;
                    if (material && material.color) {
                        material.color.setHex(0xff8888);
                        setTimeout(() => {
                            if (material.color) {
                                material.color.setHex(0xff4444);
                            }
                        }, 100);
                    }
                }
            }
        });
    }

    private animate(time: number) {
        requestAnimationFrame((t) => this.animate(t));

        if (this.paused) return;

        GamepadInput.poll();

        const dt = Math.min(0.05, (time - this.lastTime) / 1000);
        this.lastTime = time;

        this.handleEnterExit();
        this.physics.update(dt);
        this.player.update(dt);
        this.vehicle.update(dt);
        this.traffic.forEach(t => t.update(dt));
        
        // Handle interactions
        this.handleInteractions();

        // Score — drift + air time
        if (this.playerInVehicle) {
            this.score.updateDrift(this.vehicle.lateralSpeed, dt);
        } else {
            this.score.updateAir(false, dt);
        }
        this.score.updateMultiplier(dt);

        // Mission update
        const pos = this.playerInVehicle ? this.vehicle.getPosition() : this.player.getPosition();
        const reward = this.missions.update(dt, pos);
        if (reward > 0) this.score.add(reward, 'MISSION');

        // Speedometer + gear
        if (this.playerInVehicle && this.speedVal) {
            this.speedVal.textContent = String(this.vehicle.getSpeedKmh());
            const gearEl = document.getElementById('gear-value');
            if (gearEl) gearEl.textContent = `G${this.vehicle.getGear()}`;
        }

        // Near-vehicle prompt
        if (!this.playerInVehicle && this.enterPrompt) {
            const dist = this.vehicle.getPosition().distanceTo(this.player.getPosition());
            this.enterPrompt.style.display = dist < 6 ? 'flex' : 'none';
        }

        this.minimap.update(pos);
        this.scene.render();
        Input.clearPerFrameData();
        TouchControls.clearFrame();
    }
}
