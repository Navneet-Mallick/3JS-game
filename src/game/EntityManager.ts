import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Pedestrian } from './Pedestrian';
import { TrafficCar } from './TrafficCar';
import { Police } from './Police';
import { PoliceSystem } from './PoliceSystem';

/**
 * EntityManager — handles spawning, despawning, and pooling.
 * Keeps the city alive around the player without overflowing memory.
 */
export class EntityManager {
    private scene: THREE.Scene;
    private world: CANNON.World;
    
    public pedestrians: Pedestrian[] = [];
    public traffic: TrafficCar[] = [];
    public police: Police[] = [];
    private policeSystem: PoliceSystem;
    
    private readonly MAX_PEDS = 15;
    private readonly MAX_TRAFFIC = 10;
    private readonly MAX_POLICE = 4;
    private readonly SPAWN_RADIUS = 80;
    private readonly DESPAWN_RADIUS = 120;

    constructor(scene: THREE.Scene, world: CANNON.World) {
        this.scene = scene;
        this.world = world;
        this.policeSystem = new PoliceSystem();
    }

    public update(dt: number, playerPos: THREE.Vector3, playerVel: THREE.Vector3, isWanted: boolean) {
        this.handleLOD(playerPos);
        this.maintainDensity(playerPos);
        
        // Update active entities
        this.pedestrians.forEach(p => p.update(dt, playerPos));
        this.traffic.forEach(t => t.update(dt));
        
        // Let the PoliceSystem handle police updates (coordination)
        this.policeSystem.update(dt, playerPos, playerVel, isWanted);
    }

    private handleLOD(playerPos: THREE.Vector3) {
        // Despawn far pedestrians
        for (let i = this.pedestrians.length - 1; i >= 0; i--) {
            const p = this.pedestrians[i];
            if (p.getPosition().distanceTo(playerPos) > this.DESPAWN_RADIUS) {
                this.scene.remove(p.mesh);
                this.pedestrians.splice(i, 1);
            }
        }

        // Despawn far traffic
        for (let i = this.traffic.length - 1; i >= 0; i--) {
            const t = this.traffic[i];
            if (t.getPosition().distanceTo(playerPos) > this.DESPAWN_RADIUS && !t.isOccupied) {
                this.scene.remove((t as any).chassisMesh);
                this.world.removeBody(t.chassisBody);
                this.traffic.splice(i, 1);
            }
        }
        
        // Despawn far police
        for (let i = this.police.length - 1; i >= 0; i--) {
            const p = this.police[i];
            if (p.getPosition().distanceTo(playerPos) > this.DESPAWN_RADIUS && !p.isOccupied) {
                this.policeSystem.unregisterUnit(p);
                this.scene.remove((p as any).chassisMesh);
                this.world.removeBody(p.chassisBody);
                this.police.splice(i, 1);
            }
        }
    }

    private maintainDensity(playerPos: THREE.Vector3) {
        // Spawn pedestrians
        if (this.pedestrians.length < this.MAX_PEDS) {
            this.spawnPedestrian(playerPos);
        }

        // Spawn traffic
        if (this.traffic.length < this.MAX_TRAFFIC) {
            this.spawnTraffic(playerPos);
        }
        
        // Spawn police if wanted
        if (this.police.length < this.MAX_POLICE) {
            this.spawnPolice(playerPos);
        }
    }

    private onPlayerHit: (() => void) | null = null;
    private player: any = null;

    public setPlayer(player: any, onHit: () => void) {
        this.player = player;
        this.onPlayerHit = onHit;
    }

    private spawnPolice(playerPos: THREE.Vector3) {
        const angle = Math.random() * Math.PI * 2;
        const dist = this.SPAWN_RADIUS + 20;
        const pos = new CANNON.Vec3(
            playerPos.x + Math.sin(angle) * dist,
            1,
            playerPos.z + Math.cos(angle) * dist
        );
        const p = new Police(this.scene, this.world, pos);
        p.onShoot = (dmg) => {
            if (this.player && this.player.health > 0) {
                this.player.health -= dmg;
                if (this.onPlayerHit) this.onPlayerHit();
            }
        };
        this.police.push(p);
        this.policeSystem.registerUnit(p);
    }

    private spawnPedestrian(playerPos: THREE.Vector3) {
        const angle = Math.random() * Math.PI * 2;
        const dist = this.SPAWN_RADIUS + Math.random() * 20;
        const pos = new THREE.Vector3(
            playerPos.x + Math.sin(angle) * dist,
            0,
            playerPos.z + Math.cos(angle) * dist
        );
        this.pedestrians.push(new Pedestrian(this.scene, null, pos));
    }

    private spawnTraffic(playerPos: THREE.Vector3) {
        const angle = Math.random() * Math.PI * 2;
        const dist = this.SPAWN_RADIUS + Math.random() * 30;
        const pos = new CANNON.Vec3(
            playerPos.x + Math.sin(angle) * dist,
            1,
            playerPos.z + Math.cos(angle) * dist
        );
        this.traffic.push(new TrafficCar(this.scene, this.world, pos));
    }

    public cleanup() {
        this.pedestrians.forEach(p => this.scene.remove(p.mesh));
        this.traffic.forEach(t => {
            this.scene.remove((t as any).chassisMesh);
            this.world.removeBody(t.chassisBody);
        });
        this.pedestrians = [];
        this.traffic = [];
    }
}
