import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { BaseVehicle, VehicleStats } from './BaseVehicle';
import { Sound } from './Sound';

const BIKE_STATS: VehicleStats = {
    name: 'PCJ-600',
    mass: 250,
    engineForce: 1500,
    maxSteer: 0.6,
    maxSpeed: 180,
    brakingForce: 50,
    maxHealth: 80,
    suspensionStiffness: 45
};

export class Bike extends BaseVehicle {
    constructor(
        scene: THREE.Scene,
        world: CANNON.World,
        camera: THREE.PerspectiveCamera,
        position: CANNON.Vec3,
        sound: Sound
    ) {
        super(scene, world, camera, position, sound, BIKE_STATS);
    }

    protected initPhysics(position: CANNON.Vec3) {
        const chassisShape = new CANNON.Box(new CANNON.Vec3(0.3, 0.4, 0.9));
        this.chassisBody = new CANNON.Body({ mass: this.stats.mass, shape: chassisShape });
        this.chassisBody.position.set(position.x, position.y + 1.0, position.z);
        this.chassisBody.linearDamping = 0.1;
        this.chassisBody.angularDamping = 0.65;
        this.world.addBody(this.chassisBody);

        this.vehicle = new CANNON.RaycastVehicle({
            chassisBody: this.chassisBody,
            indexForwardAxis: 2,
            indexRightAxis: 0,
            indexUpAxis: 1,
        });

        const wheelOpts = {
            radius: 0.32,
            directionLocal: new CANNON.Vec3(0, -1, 0),
            suspensionStiffness: this.stats.suspensionStiffness,
            suspensionRestLength: 0.35,
            frictionSlip: 2.5,
            dampingRelaxation: 5.0,
            dampingCompression: 7.0,
            maxSuspensionForce: 100000,
            rollInfluence: 0.001,
            axleLocal: new CANNON.Vec3(1, 0, 0),
            chassisConnectionPointLocal: new CANNON.Vec3(0, 0, 0),
            maxSuspensionTravel: 0.25,
        };

        const wPos = [[0, -0.2, 0.7], [0, -0.2, -0.7]];
        wPos.forEach(p => {
            wheelOpts.chassisConnectionPointLocal.set(p[0], p[1], p[2]);
            this.vehicle.addWheel(wheelOpts);
        });

        this.vehicle.addToWorld(this.world);
    }

    protected initModel() {
        this.chassisMesh = new THREE.Group();
        const bodyGeo = new THREE.BoxGeometry(0.5, 0.8, 1.8);
        const bodyMat = new THREE.MeshLambertMaterial({ color: 0x0066ff });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.castShadow = true;
        this.chassisMesh.add(body);

        this.scene.add(this.chassisMesh);

        // Wheels
        const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.2, 12);
        wheelGeo.rotateZ(Math.PI / 2);
        const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        for (let i = 0; i < 2; i++) {
            const w = new THREE.Mesh(wheelGeo, wheelMat);
            const g = new THREE.Group();
            g.add(w);
            this.wheelMeshes.push(g);
            this.scene.add(g);
        }
    }

    protected handleInput(dt: number) {
        super.handleInput(dt);
        
        // Stabilize bike — prevent tipping over too much
        const rot = this.chassisBody.quaternion;
        const euler = new THREE.Euler().setFromQuaternion(rot as any);
        // Apply counter-force to keep upright
        this.chassisBody.angularVelocity.z -= euler.z * 0.5;
        this.chassisBody.angularVelocity.x -= euler.x * 0.5;
    }

    protected applyEngineForce(force: number) {
        // Rear wheel drive for bikes
        this.vehicle.applyEngineForce(force, 1);
    }

    protected updateCamera(dt: number) {
        const target = new THREE.Vector3().copy(this.chassisBody.position as any);
        const offset = new THREE.Vector3(0, 2, -5).applyQuaternion(this.chassisMesh.quaternion);
        this.camera.position.lerp(target.add(offset), 0.15);
        this.camera.lookAt(this.chassisBody.position as any);
    }

    public resetPosition() {
        this.chassisBody.position.y += 1;
        this.chassisBody.quaternion.set(0, 0, 0, 1);
        this.chassisBody.velocity.set(0, 0, 0);
    }
}
