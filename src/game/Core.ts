import * as CANNON from 'cannon-es';
import * as THREE from 'three';
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
import { Pedestrian } from './Pedestrian';
import { Police } from './Police';
import { WantedLevel } from './WantedLevel';
import { VehicleFactory, VehicleType } from './VehicleFactory';
import type { IVehicle } from './VehicleFactory';
import { Motorcycle } from './Motorcycle';
import { BuildingInterior } from './BuildingInterior';
import { MoneySystem } from './MoneySystem';
import { EnhancedPoliceAI } from './EnhancedPoliceAI';
import { SaveSystem } from './SaveSystem';

export class Core {
    private scene: GameScene;
    private physics: Physics;
    private player: Player;
    private vehicle: Vehicle;
    private city: City;
    private traffic: TrafficCar[] = [];
    private pedestrians: Pedestrian[] = [];
    private police: Police[] = [];
    private motorcycles: IVehicle[] = [];
    private wantedLevel: WantedLevel;
    private buildingInteriors: BuildingInterior[] = [];
    private moneySystem: MoneySystem;
    private enhancedPoliceAI: EnhancedPoliceAI[] = [];
    private saveSystem: SaveSystem;
    private isPlayerInInterior = false;
    private currentInterior: BuildingInterior | null = null;
    private minimap: Minimap;
    private sound: Sound;
    private missions: MissionSystem;
    private score: ScoreSystem;

    private lastTime = 0;
    private playerInVehicle = false;
    private paused = false;

    private modeBadge   = document.getElementById('mode-badge');
    private gearEl      = document.getElementById('gear-value');
    private speedoEl    = document.getElementById('speedo-value');
    private ammoEl      = document.getElementById('ammo-display');
    private moneyEl     = document.getElementById('money-display');
    private lockPrompt  = document.getElementById('pointer-lock-prompt');
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

            this.city = new City(this.scene.getScene(), this.physics.getWorld(), this.physics.groundMaterial);

            this.player  = new Player(this.scene.getScene(), this.physics.getWorld(), this.scene.getCamera(), this.physics.playerMaterial);
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
            
            // Initialize GTA-style systems
            this.wantedLevel = new WantedLevel(this.scene.getScene());
            this.moneySystem = new MoneySystem();
            this.saveSystem = new SaveSystem();
            this.spawnPedestrians();
            this.spawnPolice();
            this.spawnMotorcycles();
            this.spawnBuildingInteriors();
            this.initializeEnhancedPoliceAI();

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

    private spawnPedestrians() {
        const pedestrianPositions: [number, number, number][] = [
            [10, 1, 10], [-10, 1, 10], [10, 1, -10], [-10, 1, -10],
            [20, 1, 0], [-20, 1, 0], [0, 1, 20], [0, 1, -20],
            [15, 1, 15], [-15, 1, 15], [15, 1, -15], [-15, 1, -15]
        ];

        pedestrianPositions.forEach(([x, y, z]) => {
            this.pedestrians.push(new Pedestrian(
                this.scene.getScene(),
                this.physics.getWorld(),
                new THREE.Vector3(x, y, z)
            ));
        });
    }

    private spawnPolice() {
        const policePositions: [number, number, number][] = [
            [30, 1, 30], [-30, 1, 30], [30, 1, -30], [-30, 1, -30]
        ];

        policePositions.forEach(([x, y, z]) => {
            this.police.push(new Police(
                this.scene.getScene(),
                this.physics.getWorld(),
                this.scene.getCamera(),
                new CANNON.Vec3(x, y, z),
                this.sound
            ));
        });
    }

    private spawnMotorcycles() {
        const motorcyclePositions: [number, number, number][] = [
            [15, 1, 15], [-15, 1, 15], [15, 1, -15], [-15, 1, -15],
            [25, 1, 0], [-25, 1, 0], [0, 1, 25], [0, 1, -25]
        ];

        motorcyclePositions.forEach(([x, y, z]) => {
            const motorcycle = VehicleFactory.createVehicle(
                VehicleType.MOTORCYCLE,
                this.scene.getScene(),
                this.physics.getWorld(),
                this.scene.getCamera(),
                new CANNON.Vec3(x, y, z),
                this.sound
            );
            this.motorcycles.push(motorcycle);
        });
    }

    private spawnBuildingInteriors() {
        const buildingPositions: [number, number, number, string][] = [
            [20, 1, 20, 'apartment'],
            [-20, 1, 20, 'shop'],
            [20, 1, -20, 'garage'],
            [-20, 1, -20, 'office'],
            [40, 1, 0, 'apartment'],
            [-40, 1, 0, 'shop'],
            [0, 1, 40, 'garage'],
            [0, 1, -40, 'office']
        ];

        buildingPositions.forEach(([x, y, z, type]) => {
            const building = new BuildingInterior(
                this.scene.getScene(),
                this.physics.getWorld(),
                new THREE.Vector3(x, y, z),
                type as 'apartment' | 'shop' | 'garage' | 'office'
            );
            this.buildingInteriors.push(building);
        });
    }

    private initializeEnhancedPoliceAI() {
        // Upgrade existing police to enhanced AI
        this.police.forEach((police, index) => {
            const enhancedAI = new EnhancedPoliceAI(
                police.vehicle,
                this.wantedLevel.getCurrentLevel()
            );
            this.enhancedPoliceAI.push(enhancedAI);
        });
    }

    private handleShortcuts() {
        // Quick save (F5)
        if (Input.isKeyPressed('F5')) {
            this.saveSystem.quickSave();
            console.log('Quick saved!');
        }
        
        // Quick load (F9)
        if (Input.isKeyPressed('F9')) {
            this.saveSystem.quickLoad();
            console.log('Quick loaded!');
        }
    }

    private handleEnterExit() {
        const enterKey = Input.isKeyPressed('f') ||
            (GamepadInput.connected && GamepadInput.btnXPressed()) ||
            TouchControls.enterPressed;

        if (!enterKey) return;

        if (this.playerInVehicle) {
            this.player.setInVehicle(false);
            this.playerInVehicle = false;
            this.vehicle.isOccupied = false;
            this.vehicle.chassisMesh.visible = true;
            this.scene.getCamera().parent = this.scene.getScene();
            this.modeBadge!.textContent = 'ON FOOT';
            this.modeBadge!.style.color = '#00ff00';
        } else {
            const distance = this.player.getPosition().distanceTo(this.vehicle.getPosition());
            if (distance < 4) {
                this.playerInVehicle = true;
                this.player.setInVehicle(true);
                this.vehicle.isOccupied = true;
                this.vehicle.chassisMesh.visible = false;
                this.modeBadge!.textContent = 'IN VEHICLE';
                this.modeBadge!.style.color = '#ffff00';
            }
        }
        if (this.speedoEl) {
            this.speedoEl.classList.add('active');
            this.sound.startEngine();
        }
    }

    private handleInteractions() {
        const playerPos = this.playerInVehicle ? this.vehicle.getPosition() : this.player.getPosition();
        
        // Check for weapon firing
        if (!this.playerInVehicle) {
            const weapon = this.player.getWeapon();
            const ammo = weapon.getAmmo();
            const maxAmmo = weapon.getMaxAmmo();
            
            // Update ammo display
            if (this.ammoEl) {
                this.ammoEl.textContent = `${ammo}/${maxAmmo}`;
                this.ammoEl.style.color = ammo === 0 ? '#ff0000' : '#ffffff';
            }
            
            // Add crime for shooting
            if (Input.isKeyPressed(' ') && ammo > 0 && !weapon.isReloadingStatus()) {
                this.wantedLevel.addCrime('violent');
            }
        }
        
        // Handle collectibles
        const collectibles = this.city.getCollectibles();
        collectibles.forEach((collectible, index) => {
            if (!collectible.userData || collectible.userData.collected) return;
            
            const distance = playerPos.distanceTo(collectible.position);
            if (distance < 3) {
                collectible.userData.collected = true;
                collectible.visible = false;
                this.score.add(100, 'COLLECTIBLE');
                this.moneySystem.addReward('collectible');
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
                
                // Add crime for property destruction
                this.wantedLevel.addCrime('property');
                
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
        
        // Handle power-ups
        const powerUps = this.city.getPowerUps();
        powerUps.forEach((powerUp, index) => {
            if (!powerUp.userData || powerUp.userData.collected) return;
            
            const distance = playerPos.distanceTo(powerUp.position);
            if (distance < 2.5) {
                powerUp.userData.collected = true;
                powerUp.visible = false;
                
                // Apply power-up effect
                if (powerUp.userData.powerType === 'speed') {
                    this.score.add(200, 'POWERUP');
                    this.moneySystem.addReward('powerup');
                    this.sound.playPickup();
                    
                    // Boost vehicle speed if in vehicle
                    if (this.playerInVehicle) {
                        // Temporary speed boost - could be enhanced further
                        this.vehicle.boostSpeed();
                    }
                }
            }
            
            // Animate power-ups
            if (!powerUp.userData.collected && powerUp.userData.rotationSpeed) {
                powerUp.rotation.y += powerUp.userData.rotationSpeed;
                powerUp.rotation.x += powerUp.userData.rotationSpeed * 0.5;
                powerUp.position.y = 1 + Math.sin(Date.now() * 0.003 + index) * 0.3;
            }
        });
    }

     private animate(time: number) {
    requestAnimationFrame((t) => this.animate(t));

    if (this.paused) return;

    try {
        GamepadInput.poll();

        const dt = Math.min(0.05, (time - this.lastTime) / 1000);
        this.lastTime = time;

        this.handleEnterExit();
        this.handleShortcuts();
        this.physics.update(dt);
        this.player.update(dt);
        this.vehicle.update(dt);
        this.traffic.forEach(t => t.update(dt));
        
        const playerPos = this.playerInVehicle ? this.vehicle.getPosition() : this.player.getPosition();
        this.pedestrians.forEach(p => p.update(dt, playerPos));
        this.police.forEach(p => p.update(dt, playerPos, this.playerInVehicle, this.wantedLevel.getCurrentLevel()));
        this.motorcycles.forEach(m => m.update(dt));
        this.enhancedPoliceAI.forEach((ai, index) => {
            if (this.police[index]) {
                const playerVelocity = new THREE.Vector3(
                    this.player.body.velocity.x,
                    this.player.body.velocity.y,
                    this.player.body.velocity.z
                );
                ai.update(dt, playerPos, playerVelocity, this.wantedLevel.getCurrentLevel(), this.enhancedPoliceAI);
            }
        });
        this.wantedLevel.update(dt);
        
        this.saveSystem.updatePlayTime(dt);
        this.saveSystem.updateHighestWantedLevel(this.wantedLevel.getCurrentLevel());
        
        this.handleInteractions();

        if (this.playerInVehicle) {
            this.score.updateDrift(this.vehicle.lateralSpeed, dt);
            const distance = this.vehicle.getSpeedKmh() * dt / 3.6;
            this.saveSystem.addDistanceTraveled(distance);
        } else {
            this.score.updateAir(false, dt);
            const distance = Math.sqrt(
                this.player.body.velocity.x ** 2 + 
                this.player.body.velocity.z ** 2
            ) * dt;
            this.saveSystem.addDistanceTraveled(distance);
        }
        this.score.updateMultiplier(dt);

        if (this.moneyEl) {
            const moneyValue = document.getElementById('money-value');
            if (moneyValue) {
                moneyValue.textContent = `$${this.moneySystem.getCurrentMoney().toLocaleString()}`;
            }
        }

        const pos = this.playerInVehicle ? this.vehicle.getPosition() : this.player.getPosition();
        const reward = this.missions.update(dt, pos);
        if (reward > 0) this.score.add(reward, 'MISSION');

        if (this.playerInVehicle && this.speedoEl) {
            this.speedoEl.textContent = String(this.vehicle.getSpeedKmh());
            const gearEl = document.getElementById('gear-value');
            if (gearEl) gearEl.textContent = `G${this.vehicle.getGear()}`;
        }

        if (!this.playerInVehicle && this.enterPrompt) {
            const dist = this.vehicle.getPosition().distanceTo(this.player.getPosition());
            this.enterPrompt.style.display = dist < 6 ? 'flex' : 'none';
        }

        this.minimap.update(pos);
        this.scene.render();
        Input.clearPerFrameData();
        TouchControls.clearFrame();

    } catch(err) {
        console.error('GAME LOOP CRASH:', err); // ← will show exact crash location
    }
}
}