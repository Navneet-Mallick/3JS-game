import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Police } from './Police';
import { events, GameEvents } from './Events';

export enum PoliceStrategy {
    CHASE,
    FLANK,
    BLOCK,
    IDLE
}

/**
 * PoliceSystem — Coordinates multiple police units.
 * Prevents all police from just following the player in a straight line.
 */
export class PoliceSystem {
    private units: Police[] = [];
    private playerPos: THREE.Vector3 = new THREE.Vector3();
    private playerVel: THREE.Vector3 = new THREE.Vector3();

    public update(dt: number, playerPos: THREE.Vector3, playerVel: THREE.Vector3, isWanted: boolean) {
        this.playerPos.copy(playerPos);
        this.playerVel.copy(playerVel);

        if (!isWanted) {
            this.units.forEach(u => u.stopChase());
            return;
        }

        // Assign strategies to units
        this.units.forEach((unit, index) => {
            if (unit.isDead || unit.isOccupied) return;

            let strategy = PoliceStrategy.CHASE;
            
            // Every 3rd unit tries to flank
            if (index % 3 === 1) strategy = PoliceStrategy.FLANK;
            // Every 3rd unit tries to get ahead (block)
            if (index % 3 === 2) strategy = PoliceStrategy.BLOCK;

            this.applyStrategy(unit, strategy);
            unit.update(dt, this.getTargetForStrategy(unit, strategy), true);
        });
    }

    private applyStrategy(unit: Police, strategy: PoliceStrategy) {
        // We can add specific logic here if needed
    }

    private getTargetForStrategy(unit: Police, strategy: PoliceStrategy): THREE.Vector3 {
        const target = this.playerPos.clone();

        switch (strategy) {
            case PoliceStrategy.FLANK:
                // Aim for a spot to the side of the player
                const side = new THREE.Vector3(10, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI);
                target.add(side);
                break;
            case PoliceStrategy.BLOCK:
                // Aim ahead of the player based on their velocity
                target.add(this.playerVel.clone().multiplyScalar(2));
                break;
        }

        return target;
    }

    public registerUnit(unit: Police) {
        this.units.push(unit);
    }

    public unregisterUnit(unit: Police) {
        this.units = this.units.filter(u => u !== unit);
    }
}
