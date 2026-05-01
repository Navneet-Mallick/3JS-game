import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Player } from './Player';
import { Vehicle } from './Vehicle';
import { WantedLevel } from './WantedLevel';
import { Sound } from './Sound';
import { MusicSystem } from './MusicSystem';
import { WeaponSystem, WeaponType } from './WeaponSystem';

// ── 7 working cheats only ────────────────────────────────────────────────────
const CHEATS: Record<string, string> = {
    ASPIRINE:        'full health',
    LEAVEMEALONE:    'clear wanted level',
    WEAPONSFORALL:   'full ammo all weapons',
    BIGBANG:         'explosion',
    PANZER:          'super vehicle',
    YOUWONTTAKEMEALIVE: 'super jump',
    CHASESTAT:       'max wanted level',
};

export class CheatSystem {
    private player:       Player;
    private vehicle:      Vehicle;
    private wantedLevel:  WantedLevel;
    private sound:        Sound;
    private scene:        THREE.Scene;
    private world:        CANNON.World;
    private musicSystem:  MusicSystem;
    private weaponSystem: WeaponSystem;

    private buffer = '';

    constructor(
        player:       Player,
        vehicle:      Vehicle,
        wantedLevel:  WantedLevel,
        sound:        Sound,
        scene:        THREE.Scene,
        world:        CANNON.World,
        musicSystem:  MusicSystem,
        weaponSystem: WeaponSystem
    ) {
        this.player       = player;
        this.vehicle      = vehicle;
        this.wantedLevel  = wantedLevel;
        this.sound        = sound;
        this.scene        = scene;
        this.world        = world;
        this.musicSystem  = musicSystem;
        this.weaponSystem = weaponSystem;
    }

    public handleKeyPress(key: string) {
        this.buffer = (this.buffer + key.toUpperCase()).slice(-20);

        for (const [code, label] of Object.entries(CHEATS)) {
            if (this.buffer.endsWith(code)) {
                this.buffer = '';
                this.activate(code, label);
                return;
            }
        }
    }

    private activate(code: string, label: string) {
        switch (code) {
            case 'ASPIRINE':
                this.player.health = 100;
                this.player.armor  = 100;
                this.sound.playPowerUp();
                break;

            case 'LEAVEMEALONE':
                this.wantedLevel.clearWantedLevel();
                this.sound.playCollect();
                break;

            case 'WEAPONSFORALL':
                this.weaponSystem.switchWeapon(WeaponType.RIFLE);
                this.weaponSystem.fullAmmo();
                this.sound.playPowerUp();
                break;

            case 'BIGBANG': {
                const pos = this.player.getPosition();
                this.explode(pos, 50, 250);
                this.wantedLevel.setLevel(Math.min(5, this.wantedLevel.getLevel() + 3));
                break;
            }

            case 'PANZER':
                // Make the player vehicle temporarily indestructible & heavier
                this.vehicle.chassisBody.mass = 6000;
                this.vehicle.chassisBody.updateMassProperties();
                this.sound.playPowerUp();
                setTimeout(() => {
                    this.vehicle.chassisBody.mass = 1200;
                    this.vehicle.chassisBody.updateMassProperties();
                }, 30_000);
                break;

            case 'YOUWONTTAKEMEALIVE':
                (this.player as any).jumpForce = 20;
                this.sound.playPowerUp();
                setTimeout(() => { (this.player as any).jumpForce = 7; }, 20_000);
                break;

            case 'CHASESTAT':
                this.wantedLevel.setLevel(5);
                this.sound.playExplosion();
                break;
        }

        this.notify(label.toUpperCase());
    }

    private explode(center: THREE.Vector3, radius: number, force: number) {
        // Visual flash
        const geo  = new THREE.SphereGeometry(radius * 0.4, 8, 8);
        const mat  = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.85 });
        const ball = new THREE.Mesh(geo, mat);
        ball.position.copy(center);
        this.scene.add(ball);

        let opacity = 0.85;
        const fade = () => {
            opacity -= 0.07;
            mat.opacity = Math.max(0, opacity);
            ball.scale.addScalar(0.12);
            if (opacity > 0) requestAnimationFrame(fade);
            else             this.scene.remove(ball);
        };
        fade();

        // Physics impulses
        for (const body of this.world.bodies) {
            const dx = body.position.x - center.x;
            const dy = body.position.y - center.y;
            const dz = body.position.z - center.z;
            const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
            if (dist > radius || dist < 0.01) continue;
            const f = force * (1 - dist / radius);
            const inv = 1 / dist;
            body.applyImpulse(new CANNON.Vec3(dx*inv*f, dy*inv*f*0.6, dz*inv*f), body.position);
        }
        this.sound.playExplosion();
    }

    private notify(text: string) {
        const el = document.getElementById('cheat-text');
        if (!el) return;
        el.textContent  = `CHEAT: ${text}`;
        el.style.opacity = '1';
        setTimeout(() => { el.style.opacity = '0'; }, 2500);
    }
}
