import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Player } from './Player';
import { Vehicle } from './Vehicle';
import { WantedLevel } from './WantedLevel';
import { Sound } from './Sound';
import { MusicSystem } from './MusicSystem';
import { WeaponSystem, WeaponType } from './WeaponSystem';

export class CheatSystem {
    private player: Player;
    private vehicle: Vehicle;
    private wantedLevel: WantedLevel;
    private sound: Sound;
    private scene: THREE.Scene;
    private world: CANNON.World;
    private musicSystem: MusicSystem;
    private weaponSystem: WeaponSystem;

    private cheatBuffer: string = '';
    private readonly CHEATS: { [key: string]: () => void } = {
        'BIGBANG': () => this.bigBangCheat(),
        'ASPIRINE': () => this.healthCheat(),
        'PRECIOUSPROTECTION': () => this.armorCheat(),
        'LEAVEMEALONE': () => this.clearWantedCheat(),
        'CANTSEEME': () => this.invisibilityCheat(),
        'YOUWONTTAKEMEALIVE': () => this.superJumpCheat(),
        'CHASESTAT': () => this.maxWantedCheat(),
        'WEAPONSFORALL': () => this.weaponsCheat(),
        'BOMBSAWAY': () => this.bombsCheat(),
        'GUNRUNNER': () => this.switchToPistol(),
        'SHOTGUNNER': () => this.switchToShotgun(),
        'RIFLEMAN': () => this.switchToRifle(),
        'MINIGUNNER': () => this.switchToMinigun(),
        'MUSICDEMON': () => this.playDemonsMusic(),
        'MUSICEAGLES': () => this.playEaglesMusic(),
        'MUSICKEEPERS': () => this.playKeepersMusic(),
    };

    constructor(
        player: Player,
        vehicle: Vehicle,
        wantedLevel: WantedLevel,
        sound: Sound,
        scene: THREE.Scene,
        world: CANNON.World,
        musicSystem: MusicSystem,
        weaponSystem: WeaponSystem
    ) {
        this.player = player;
        this.vehicle = vehicle;
        this.wantedLevel = wantedLevel;
        this.sound = sound;
        this.scene = scene;
        this.world = world;
        this.musicSystem = musicSystem;
        this.weaponSystem = weaponSystem;
    }

    public handleKeyPress(key: string) {
        this.cheatBuffer += key.toUpperCase();
        
        // Keep buffer size reasonable
        if (this.cheatBuffer.length > 20) {
            this.cheatBuffer = this.cheatBuffer.slice(-20);
        }

        // Check for cheats
        for (const [cheat, callback] of Object.entries(this.CHEATS)) {
            if (this.cheatBuffer.includes(cheat)) {
                callback();
                this.cheatBuffer = ''; // Clear buffer after successful cheat
                this.showCheatNotification(cheat);
                break;
            }
        }
    }

    private bigBangCheat() {
        const playerPos = this.player.getPosition();
        const explosionRadius = 50;
        const explosionForce = 200;

        // Create explosion effect
        this.createExplosion(playerPos, explosionRadius, explosionForce);

        // Damage all nearby vehicles
        const bodies = this.world.bodies;
        for (const body of bodies) {
            const bodyPos = body.position;
            const dist = Math.sqrt(
                (bodyPos.x - playerPos.x) ** 2 +
                (bodyPos.y - playerPos.y) ** 2 +
                (bodyPos.z - playerPos.z) ** 2
            );

            if (dist < explosionRadius) {
                const force = explosionForce * (1 - dist / explosionRadius);
                const dirX = bodyPos.x - playerPos.x;
                const dirY = bodyPos.y - playerPos.y;
                const dirZ = bodyPos.z - playerPos.z;
                const len = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ);
                
                body.applyImpulse(
                    new CANNON.Vec3(
                        (dirX / len) * force,
                        (dirY / len) * force * 0.5,
                        (dirZ / len) * force
                    ),
                    bodyPos
                );
            }
        }

        this.sound.playExplosion();
        this.wantedLevel.addWantedLevel(3);
    }

    private healthCheat() {
        (this.player as any).health = 100;
        this.sound.playPowerUp();
    }

    private armorCheat() {
        (this.player as any).armor = 100;
        this.sound.playPowerUp();
    }

    private clearWantedCheat() {
        this.wantedLevel.clearWantedLevel();
        this.sound.playCollect();
    }

    private invisibilityCheat() {
        (this.player as any).invisible = true;
        setTimeout(() => {
            (this.player as any).invisible = false;
        }, 30000); // 30 seconds
        this.sound.playPowerUp();
    }

    private superJumpCheat() {
        (this.player as any).jumpPower = 3.0; // Triple jump power
        setTimeout(() => {
            (this.player as any).jumpPower = 1.0;
        }, 30000); // 30 seconds
        this.sound.playPowerUp();
    }

    private maxWantedCheat() {
        this.wantedLevel.setLevel(5);
        this.sound.playExplosion();
    }

    private weaponsCheat() {
        const weapon = this.player.getWeapon();
        if (weapon) {
            (weapon as any).ammo = (weapon as any).maxAmmo;
        }
        this.sound.playReload();
    }

    private bombsCheat() {
        // Give player bombs
        (this.player as any).bombs = 10;
        this.sound.playPowerUp();
    }

    private createExplosion(center: THREE.Vector3, radius: number, force: number) {
        // Create visual explosion effect
        const explosionGeometry = new THREE.IcosahedronGeometry(radius * 0.5, 4);
        const explosionMaterial = new THREE.MeshBasicMaterial({
            color: 0xff6600,
            transparent: true,
            opacity: 0.8
        });
        const explosion = new THREE.Mesh(explosionGeometry, explosionMaterial);
        explosion.position.copy(center);
        this.scene.add(explosion);

        // Animate explosion
        let scale = 0.1;
        let opacity = 0.8;
        const animate = () => {
            scale += 0.15;
            opacity -= 0.08;
            
            explosion.scale.setScalar(scale);
            (explosion.material as THREE.MeshBasicMaterial).opacity = opacity;
            
            if (opacity > 0) {
                requestAnimationFrame(animate);
            } else {
                this.scene.remove(explosion);
            }
        };
        animate();
    }

    private showCheatNotification(cheatName: string) {
        const notification = document.getElementById('cheat-text');
        if (notification) {
            notification.textContent = `CHEAT ACTIVATED: ${cheatName}`;
            notification.style.opacity = '1';
            setTimeout(() => {
                notification.style.opacity = '0';
            }, 2000);
        }
    }

    private switchToPistol() {
        this.weaponSystem.switchWeapon(WeaponType.PISTOL);
        this.weaponSystem.fullAmmo();
        this.sound.playReload();
    }

    private switchToShotgun() {
        this.weaponSystem.switchWeapon(WeaponType.SHOTGUN);
        this.weaponSystem.fullAmmo();
        this.sound.playReload();
    }

    private switchToRifle() {
        this.weaponSystem.switchWeapon(WeaponType.RIFLE);
        this.weaponSystem.fullAmmo();
        this.sound.playReload();
    }

    private switchToMinigun() {
        this.weaponSystem.switchWeapon(WeaponType.MINIGUN);
        this.weaponSystem.fullAmmo();
        this.sound.playReload();
    }

    private playDemonsMusic() {
        this.musicSystem.playTrack('demons');
        this.sound.playCollect();
    }

    private playEaglesMusic() {
        this.musicSystem.playTrack('eagles');
        this.sound.playCollect();
    }

    private playKeepersMusic() {
        this.musicSystem.playTrack('keepers');
        this.sound.playCollect();
    }
}
