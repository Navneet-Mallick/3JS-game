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
            fireRate: 0.25,
            range: 100,
            ammo: 60,
            magazineSize: 12,
            reloadTime: 1.5,
            bulletSpeed: 50
        });
        this.ammo.set(WeaponType.PISTOL, 12);

        // Shotgun
        this.weapons.set(WeaponType.SHOTGUN, {
            name: 'Shotgun',
            damage: 100,
            fireRate: 0.8,
            range: 30,
            ammo: 24,
            magazineSize: 8,
            reloadTime: 2.5,
            bulletSpeed: 40
        });
        this.ammo.set(WeaponType.SHOTGUN, 8);

        // Rifle
        this.weapons.set(WeaponType.RIFLE, {
            name: 'Rifle',
            damage: 50,
            fireRate: 0.1,
            range: 200,
            ammo: 90,
            magazineSize: 30,
            reloadTime: 2.0,
            bulletSpeed: 80
        });
        this.ammo.set(WeaponType.RIFLE, 30);
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
            const newAmount = Math.min(current + amount, stats.ammo * 3);
            this.ammo.set(this.currentWeapon, newAmount);
        }
    }

    private isReloading = false;

    public fire(): boolean {
        if (this.isReloading) return false;
        
        const stats = this.getWeaponStats();
        const currentAmmo = this.getAmmo();

        if (stats.ammo > 0 && currentAmmo <= 0) {
            this.reload();
            return false;
        }

        if (stats.ammo > 0) this.setAmmo(currentAmmo - 1);

        this.sound.playShoot();
        return true;
    }

    public async reload() {
        if (this.isReloading) return;
        const stats = this.getWeaponStats();
        if (stats.ammo === -1) return; // No reload for fists

        this.isReloading = true;
        this.sound.playReload();
        
        await new Promise(r => setTimeout(r, stats.reloadTime * 1000));
        
        this.setAmmo(stats.magazineSize);
        this.isReloading = false;
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
                this.ammo.set(weaponType, stats.magazineSize);
            }
        }
    }
}

export interface WeaponStats {
    name: string;
    damage: number;
    fireRate: number;
    range: number;
    ammo: number;
    magazineSize: number;
    reloadTime: number;
    bulletSpeed: number;
}
