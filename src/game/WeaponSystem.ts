import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Sound } from './Sound';

export const WeaponType = {
    FISTS: 'fists',
    PISTOL: 'pistol',
    SHOTGUN: 'shotgun',
    RIFLE: 'rifle',
    MINIGUN: 'minigun'
} as const;

export type WeaponType = typeof WeaponType[keyof typeof WeaponType];

export class WeaponSystem {
    private currentWeapon: WeaponType = WeaponType.FISTS;
    private weapons: Map<WeaponType, WeaponStats> = new Map();
    private ammo: Map<WeaponType, number> = new Map();
    private sound: Sound;

    constructor(sound: Sound) {
        this.sound = sound;
        this.initializeWeapons();
    }

    private initializeWeapons() {
        // Fists
        this.weapons.set(WeaponType.FISTS, {
            name: 'Fists',
            damage: 15,
            fireRate: 0.5,
            range: 2,
            ammo: -1, // Infinite
            bulletSpeed: 0
        });
        this.ammo.set(WeaponType.FISTS, -1);

        // Pistol
        this.weapons.set(WeaponType.PISTOL, {
            name: 'Pistol',
            damage: 35,
            fireRate: 0.15,
            range: 100,
            ammo: 30,
            bulletSpeed: 50
        });
        this.ammo.set(WeaponType.PISTOL, 30);

        // Shotgun
        this.weapons.set(WeaponType.SHOTGUN, {
            name: 'Shotgun',
            damage: 100,
            fireRate: 0.8,
            range: 30,
            ammo: 8,
            bulletSpeed: 40
        });
        this.ammo.set(WeaponType.SHOTGUN, 8);

        // Rifle
        this.weapons.set(WeaponType.RIFLE, {
            name: 'Rifle',
            damage: 50,
            fireRate: 0.2,
            range: 200,
            ammo: 30,
            bulletSpeed: 80
        });
        this.ammo.set(WeaponType.RIFLE, 30);

        // Minigun
        this.weapons.set(WeaponType.MINIGUN, {
            name: 'Minigun',
            damage: 20,
            fireRate: 0.05,
            range: 150,
            ammo: 200,
            bulletSpeed: 60
        });
        this.ammo.set(WeaponType.MINIGUN, 200);
    }

    public switchWeapon(weaponType: WeaponType) {
        if (this.weapons.has(weaponType)) {
            this.currentWeapon = weaponType;
            this.sound.playReload();
            return true;
        }
        return false;
    }

    public getCurrentWeapon(): WeaponType {
        return this.currentWeapon;
    }

    public getWeaponStats(): WeaponStats {
        return this.weapons.get(this.currentWeapon) || this.weapons.get(WeaponType.FISTS)!;
    }

    public getAmmo(): number {
        return this.ammo.get(this.currentWeapon) || 0;
    }

    public setAmmo(amount: number) {
        this.ammo.set(this.currentWeapon, amount);
    }

    public addAmmo(amount: number) {
        const current = this.ammo.get(this.currentWeapon) || 0;
        const stats = this.weapons.get(this.currentWeapon);
        if (stats && stats.ammo > 0) {
            const newAmount = Math.min(current + amount, stats.ammo * 3); // Max 3x ammo
            this.ammo.set(this.currentWeapon, newAmount);
        }
    }

    public fire(): boolean {
        const stats = this.getWeaponStats();
        const currentAmmo = this.getAmmo();

        // Check ammo
        if (stats.ammo > 0 && currentAmmo <= 0) {
            return false;
        }

        // Consume ammo
        if (stats.ammo > 0) {
            this.setAmmo(currentAmmo - 1);
        }

        // Play sound
        if (this.currentWeapon === WeaponType.SHOTGUN) {
            this.sound.playExplosion();
        } else if (this.currentWeapon === WeaponType.MINIGUN) {
            this.sound.playShoot();
        } else {
            this.sound.playShoot();
        }

        return true;
    }

    public getAllWeapons(): WeaponType[] {
        return Array.from(this.weapons.keys());
    }

    public getWeaponName(weaponType: WeaponType): string {
        return this.weapons.get(weaponType)?.name || 'Unknown';
    }

    public fullAmmo() {
        for (const [weaponType, stats] of this.weapons) {
            if (stats.ammo > 0) {
                this.ammo.set(weaponType, stats.ammo);
            }
        }
    }
}

export interface WeaponStats {
    name: string;
    damage: number;
    fireRate: number;
    range: number;
    ammo: number; // -1 for infinite
    bulletSpeed: number;
}
