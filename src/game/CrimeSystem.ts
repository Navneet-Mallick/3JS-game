import * as THREE from 'three';
import { WantedLevel } from './WantedLevel';
import { Pedestrian } from './Pedestrian';
import { TrafficCar } from './TrafficCar';

export class CrimeSystem {
    private wantedLevel: WantedLevel;
    private lastCrimeTime = 0;
    private readonly CRIME_COOLDOWN = 0.5; // seconds between crimes

    constructor(wantedLevel: WantedLevel) {
        this.wantedLevel = wantedLevel;
    }

    public update(dt: number) {
        this.lastCrimeTime += dt;
    }

    /**
     * Beat a pedestrian with fists or weapon
     */
    public beatPedestrian(pedestrian: Pedestrian, weaponDamage: number = 10): boolean {
        if (this.lastCrimeTime < this.CRIME_COOLDOWN) return false;

        const pedPos = pedestrian.getPosition();
        if (!pedPos) return false;

        // Mark pedestrian as hit
        (pedestrian as any).health = ((pedestrian as any).health || 100) - weaponDamage;
        
        // If pedestrian dies, increase wanted level more
        if ((pedestrian as any).health <= 0) {
            this.wantedLevel.addWantedLevel(2); // Murder = 2 stars
            (pedestrian as any).isDead = true;
            pedestrian.mesh.visible = false;
        } else {
            this.wantedLevel.addWantedLevel(1); // Assault = 1 star
        }

        this.lastCrimeTime = 0;
        return true;
    }

    /**
     * Hit a pedestrian with a vehicle
     */
    public hitPedestrianWithVehicle(pedestrian: Pedestrian, vehicleSpeed: number): boolean {
        if (this.lastCrimeTime < this.CRIME_COOLDOWN * 0.5) return false;

        const pedPos = pedestrian.getPosition();
        if (!pedPos) return false;

        // Damage based on vehicle speed
        const damage = Math.min(100, vehicleSpeed * 2);
        (pedestrian as any).health = ((pedestrian as any).health || 100) - damage;

        if ((pedestrian as any).health <= 0) {
            this.wantedLevel.addWantedLevel(3); // Hit and run = 3 stars
            (pedestrian as any).isDead = true;
            pedestrian.mesh.visible = false;
        } else {
            this.wantedLevel.addWantedLevel(1); // Hit pedestrian = 1 star
        }

        this.lastCrimeTime = 0;
        return true;
    }

    /**
     * Destroy property/destructibles
     */
    public destroyProperty(damage: number): boolean {
        if (this.lastCrimeTime < this.CRIME_COOLDOWN) return false;

        // Vandalism/destruction increases wanted level
        const wantedIncrease = Math.min(2, Math.floor(damage / 50));
        if (wantedIncrease > 0) {
            this.wantedLevel.addWantedLevel(wantedIncrease);
            this.lastCrimeTime = 0;
            return true;
        }
        return false;
    }

    /**
     * Crash into traffic car
     */
    public crashIntoTraffic(trafficCar: TrafficCar, impactForce: number): boolean {
        if (this.lastCrimeTime < this.CRIME_COOLDOWN) return false;

        // Reckless driving increases wanted level
        const wantedIncrease = Math.min(2, Math.floor(impactForce / 100));
        if (wantedIncrease > 0) {
            this.wantedLevel.addWantedLevel(wantedIncrease);
            this.lastCrimeTime = 0;
            return true;
        }
        return false;
    }

    /**
     * Speeding violation
     */
    public checkSpeeding(speed: number): boolean {
        if (this.lastCrimeTime < 2.0) return false; // Check every 2 seconds

        const SPEED_LIMIT = 30; // km/h
        if (speed > SPEED_LIMIT) {
            const excessSpeed = speed - SPEED_LIMIT;
            if (excessSpeed > 20) {
                this.wantedLevel.addWantedLevel(1); // Excessive speeding
                this.lastCrimeTime = 0;
                return true;
            }
        }
        return false;
    }

    /**
     * Reckless driving - swerving, drifting
     */
    public recklessDriving(lateralSpeed: number): boolean {
        if (this.lastCrimeTime < 1.5) return false;

        if (lateralSpeed > 15) {
            this.wantedLevel.addWantedLevel(1); // Reckless driving
            this.lastCrimeTime = 0;
            return true;
        }
        return false;
    }

    /**
     * Get crime description for UI
     */
    public getLastCrimeDescription(): string {
        const level = this.wantedLevel.getLevel();
        if (level === 0) return 'CLEAN';
        if (level === 1) return 'WANTED: Assault/Speeding';
        if (level === 2) return 'WANTED: Assault/Reckless Driving';
        if (level === 3) return 'WANTED: Hit & Run';
        if (level === 4) return 'WANTED: Multiple Crimes';
        return 'WANTED: DANGEROUS';
    }
}
