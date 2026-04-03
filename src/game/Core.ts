import * as CANNON from 'cannon-es';
import { GameScene } from './Scene';
import { Physics } from './Physics';
import { Player } from './Player';
import { Vehicle } from './Vehicle';
import { City } from './City';
import { Minimap } from './Minimap';
import { Input } from './Input';
import { TrafficCar } from './TrafficCar';

export class Core {
    private scene: GameScene;
    private physics: Physics;
    private player: Player;
    private vehicle: Vehicle;
    private traffic: TrafficCar[] = [];
    private minimap: Minimap;
    private lastTime = 0;
    private playerInVehicle = false;
    private paused = false;

    // HUD
    private modeBadge   = document.getElementById('mode-badge');
    private lockPrompt  = document.getElementById('lock-prompt');
    private pauseScreen = document.getElementById('pause-screen');
    private speedoEl    = document.getElementById('speedometer');
    private speedVal    = document.getElementById('speed-value');
    private enterPrompt = document.getElementById('enter-prompt');

    constructor() {
        Input.init();

        this.scene   = new GameScene();
        this.physics = new Physics();

        new City(this.scene.getScene(), this.physics.getWorld());

        this.player  = new Player(this.scene.getScene(), this.physics.getWorld(), this.scene.getCamera());
        this.vehicle = new Vehicle(
            this.scene.getScene(),
            this.physics.getWorld(),
            this.scene.getCamera(),
            new CANNON.Vec3(8, 2, 8)
        );

        // Spawn parked / traffic cars
        const trafficSpawns: [number, number, number][] = [
            [ 30,  2,  0], [-30,  2,  0],
            [  0,  2, 30], [  0,  2, -30],
            [ 60,  2, 60], [-60,  2, 60],
            [ 60,  2,-60], [-60,  2,-60],
            [120,  2,  0], [  0,  2, 120],
        ];
        for (const [x, y, z] of trafficSpawns) {
            this.traffic.push(new TrafficCar(
                this.scene.getScene(),
                this.physics.getWorld(),
                new CANNON.Vec3(x, y, z)
            ));
        }

        this.minimap = new Minimap('minimap-canvas');

        // Pointer lock → show/hide prompts
        document.addEventListener('pointerlockchange', () => {
            const locked = !!document.pointerLockElement;
            if (locked) {
                if (this.lockPrompt)  this.lockPrompt.style.display  = 'none';
                if (this.pauseScreen) this.pauseScreen.classList.remove('visible');
                this.paused = false;
            } else {
                // Only show pause if game already started (loading screen gone)
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

        this.init();
    }

    private async init() {
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
                // Show click-to-play after loading
                if (this.lockPrompt) this.lockPrompt.style.display = 'flex';
            }, 600);
        }

        requestAnimationFrame((t) => this.animate(t));
    }

    private handleEnterExit() {
        if (!Input.isKeyPressed('f')) return;

        if (this.playerInVehicle) {
            this.playerInVehicle = false;
            this.vehicle.isOccupied = false;
            this.player.visible = true;
            const vp = this.vehicle.getPosition();
            this.player.setPosition(vp.x + 3, vp.y + 1, vp.z);
            if (this.modeBadge) this.modeBadge.textContent = 'On Foot';
            if (this.speedoEl)  this.speedoEl.classList.remove('active');
        } else {
            const vp = this.vehicle.getPosition();
            const pp = this.player.getPosition();
            if (vp.distanceTo(pp) < 6) {
                this.playerInVehicle = true;
                this.vehicle.isOccupied = true;
                this.player.visible = false;
                if (this.modeBadge) this.modeBadge.textContent = 'Driving';
                if (this.speedoEl)  this.speedoEl.classList.add('active');
            }
        }
    }

    private animate(time: number) {
        requestAnimationFrame((t) => this.animate(t));

        if (this.paused) return;

        const dt = Math.min(0.05, (time - this.lastTime) / 1000);
        this.lastTime = time;

        this.handleEnterExit();
        this.physics.update(dt);
        this.player.update(dt);
        this.vehicle.update(dt);
        this.traffic.forEach(t => t.update(dt));

        // Speedometer
        if (this.playerInVehicle && this.speedVal) {
            this.speedVal.textContent = String(this.vehicle.getSpeedKmh());
        }

        // Near-vehicle prompt
        if (!this.playerInVehicle && this.enterPrompt) {
            const dist = this.vehicle.getPosition().distanceTo(this.player.getPosition());
            this.enterPrompt.style.display = dist < 6 ? 'flex' : 'none';
        }

        const pos = this.playerInVehicle ? this.vehicle.getPosition() : this.player.getPosition();
        this.minimap.update(pos);

        this.scene.render();
        Input.clearPerFrameData();
    }
}
