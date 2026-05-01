import { events, GameEvents } from './Events';
import { BaseVehicle } from './BaseVehicle';
import { Pedestrian } from './Pedestrian';

/**
 * CombatSystem — The central authority for damage and hit reactions.
 */
export class CombatSystem {
    public static handleHit(target: any, damage: number, attackerPos: THREE.Vector3) {
        if (target instanceof Pedestrian) {
            const killed = target.takeDamage(damage);
            if (killed) {
                events.emit(GameEvents.CRIME_COMMITTED, { level: 2 });
            }
        } else if (target instanceof BaseVehicle) {
            target.takeDamage(damage);
            // Bullet impact force
            const dir = target.chassisBody.position.clone().vsub(attackerPos as any).unit();
            target.chassisBody.applyImpulse(dir.scale(damage * 10), target.chassisBody.position);
        }
    }
}
