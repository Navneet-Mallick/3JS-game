import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { BaseVehicle, VehicleStats } from './BaseVehicle';
import { Sound } from './Sound';

const TRUCK_STATS: VehicleStats = {
    name: 'Mule',
    mass: 3500,
    engineForce: 3500,
    maxSteer: 0.4,
    maxSpeed: 100,
    brakingForce: 200,
    maxHealth: 300,
    suspensionStiffness: 50
};

export class Truck extends BaseVehicle {
    constructor(
        scene: THREE.Scene,
        world: CANNON.World,
        camera: THREE.PerspectiveCamera,
        position: CANNON.Vec3,
        sound: Sound
    ) {
        super(scene, world, camera, position, sound, TRUCK_STATS);
    }

    protected initPhysics(position: CANNON.Vec3) {
        const chassisShape = new CANNON.Box(new CANNON.Vec3(1.2, 0.8, 3.5));
        this.chassisBody = new CANNON.Body({ mass: this.stats.mass, shape: chassisShape });
        this.chassisBody.position.set(position.x, position.y + 1.5, position.z);
        this.world.addBody(this.chassisBody);

        this.vehicle = new CANNON.RaycastVehicle({
            chassisBody: this.chassisBody,
            indexForwardAxis: 2,
            indexRightAxis: 0,
            indexUpAxis: 1,
        });

        const wheelOpts = {
            radius: 0.5,
            directionLocal: new CANNON.Vec3(0, -1, 0),
            suspensionStiffness: this.stats.suspensionStiffness,
            suspensionRestLength: 0.4,
            frictionSlip: 3.0,
            dampingRelaxation: 5.0,
            dampingCompression: 7.0,
            maxSuspensionForce: 200000,
            rollInfluence: 0.05,
            axleLocal: new CANNON.Vec3(1, 0, 0),
            chassisConnectionPointLocal: new CANNON.Vec3(0, 0, 0),
            maxSuspensionTravel: 0.4,
        };

        const wPos = [[-1.1, -0.4, 2.5], [1.1, -0.4, 2.5], [-1.1, -0.4, -2.5], [1.1, -0.4, -2.5]];
        wPos.forEach(p => {
            wheelOpts.chassisConnectionPointLocal.set(p[0], p[1], p[2]);
            this.vehicle.addWheel(wheelOpts);
        });

        this.vehicle.addToWorld(this.world);
    }

    protected initModel() {
        this.chassisMesh = new THREE.Group();
        
        // Cab
        const cabGeo = new THREE.BoxGeometry(2.4, 1.8, 2.0);
        const cabMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
        const cab = new THREE.Mesh(cabGeo, cabMat);
        cab.position.set(0, 0.4, 2.5);
        this.chassisMesh.add(cab);

        // Bed
        const bedGeo = new THREE.BoxGeometry(2.4, 2.2, 5.0);
        const bedMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
        const bed = new THREE.Mesh(bedGeo, bedMat);
        bed.position.set(0, 0.6, -1.0);
        this.chassisMesh.add(bed);

        this.scene.add(this.chassisMesh);

        // Wheels
        const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 12);
        wheelGeo.rotateZ(Math.PI / 2);
        const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        for (let i = 0; i < 4; i++) {
            const w = new THREE.Mesh(wheelGeo, wheelMat);
            const g = new THREE.Group();
            g.add(w);
            this.wheelMeshes.push(g);
            this.scene.add(g);
        }
    }

    protected updateCamera(dt: number) {
        const target = new THREE.Vector3().copy(this.chassisBody.position as any);
        const offset = new THREE.Vector3(0, 5, -12).applyQuaternion(this.chassisMesh.quaternion);
        this.camera.position.lerp(target.add(offset), 0.1);
        this.camera.lookAt(this.chassisBody.position as any);
    }
}
