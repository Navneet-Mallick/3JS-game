import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { BaseVehicle, VehicleStats } from './BaseVehicle';
import { Sound } from './Sound';

const SPORT_STATS: VehicleStats = {
    name: 'Infernus',
    mass: 1200,
    engineForce: 2500,
    maxSteer: 0.5,
    maxSpeed: 220,
    brakingForce: 100,
    maxHealth: 100,
    suspensionStiffness: 35
};

export class Vehicle extends BaseVehicle {
    constructor(
        scene: THREE.Scene,
        world: CANNON.World,
        camera: THREE.PerspectiveCamera,
        position: CANNON.Vec3,
        sound: Sound
    ) {
        super(scene, world, camera, position, sound, SPORT_STATS);
    }

    protected initPhysics(position: CANNON.Vec3) {
        const chassisShape = new CANNON.Box(new CANNON.Vec3(1.0, 0.3, 2.2));
        this.chassisBody = new CANNON.Body({ mass: this.stats.mass, shape: chassisShape });
        this.chassisBody.position.set(position.x, position.y + 1.2, position.z);
        this.chassisBody.linearDamping = 0.1;
        this.chassisBody.angularDamping = 0.85;
        this.world.addBody(this.chassisBody);

        this.vehicle = new CANNON.RaycastVehicle({
            chassisBody: this.chassisBody,
            indexForwardAxis: 2,
            indexRightAxis: 0,
            indexUpAxis: 1,
        });

        const wheelOpts = {
            radius: 0.38,
            directionLocal: new CANNON.Vec3(0, -1, 0),
            suspensionStiffness: this.stats.suspensionStiffness,
            suspensionRestLength: 0.35,
            frictionSlip: 2.5,
            dampingRelaxation: 4.5,
            dampingCompression: 6.5,
            maxSuspensionForce: 100000,
            rollInfluence: 0.01,
            axleLocal: new CANNON.Vec3(1, 0, 0),
            chassisConnectionPointLocal: new CANNON.Vec3(0, 0, 0),
            maxSuspensionTravel: 0.3,
        };

        const wPos = [[-0.85, -0.2, 1.4], [0.85, -0.2, 1.4], [-0.85, -0.2, -1.4], [0.85, -0.2, -1.4]];
        wPos.forEach(p => {
            wheelOpts.chassisConnectionPointLocal.set(p[0], p[1], p[2]);
            this.vehicle.addWheel(wheelOpts);
        });

        this.vehicle.addToWorld(this.world);
    }

    protected initModel() {
        this.chassisMesh = new THREE.Group();
        const bodyGeo = new THREE.BoxGeometry(2, 0.6, 4.4);
        const bodyMat = new THREE.MeshLambertMaterial({ color: 0xcc0000 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.castShadow = true;
        this.chassisMesh.add(body);

        const cabinGeo = new THREE.BoxGeometry(1.6, 0.6, 2.0);
        const cabinMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const cabin = new THREE.Mesh(cabinGeo, cabinMat);
        cabin.position.set(0, 0.6, -0.2);
        this.chassisMesh.add(cabin);

        this.scene.add(this.chassisMesh);

        // Wheels
        const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
        wheelGeo.rotateZ(Math.PI / 2);
        const wheelMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
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
        const offset = new THREE.Vector3(0, 3, -7).applyQuaternion(this.chassisMesh.quaternion);
        this.camera.position.lerp(target.add(offset), 0.1);
        this.camera.lookAt(this.chassisBody.position as any);
    }

    public boostSpeed() {
        this.chassisBody.applyImpulse(
            new CANNON.Vec3(0, 0, 5000).applyQuaternion(this.chassisBody.quaternion as any),
            this.chassisBody.position
        );
    }

    public resetPosition() {
        this.chassisBody.position.y += 2;
        this.chassisBody.quaternion.set(0, 0, 0, 1);
        this.chassisBody.velocity.set(0, 0, 0);
        this.chassisBody.angularVelocity.set(0, 0, 0);
    }

    public getGear() { return 1; } // Simplified for now
}