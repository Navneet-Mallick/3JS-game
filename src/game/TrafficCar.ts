import * as THREE from 'three';
import * as CANNON from 'cannon-es';

const COLORS = [0x8b0000, 0x003366, 0x1a4a1a, 0x4a3000, 0x2a0050, 0x444444, 0x660033];

export class TrafficCar {
    private chassisMesh: THREE.Group;
    private chassisBody: CANNON.Body;
    private vehicle: CANNON.RaycastVehicle;
    private wheelMeshes: THREE.Group[] = [];

    // Simple AI: drive forward, turn at random intervals
    private aiTimer = Math.random() * 3;
    private aiSteer = 0;
    private aiForce = 1200;

    constructor(scene: THREE.Scene, world: CANNON.World, position: CANNON.Vec3) {
        const color = COLORS[Math.floor(Math.random() * COLORS.length)];

        const chassisShape = new CANNON.Box(new CANNON.Vec3(0.9, 0.3, 2.0));
        this.chassisBody = new CANNON.Body({ mass: 1000, shape: chassisShape });
        this.chassisBody.position.copy(position);
        this.chassisBody.linearDamping  = 0.1;
        this.chassisBody.angularDamping = 0.5;
        // Random initial heading
        this.chassisBody.quaternion.setFromEuler(0, Math.random() * Math.PI * 2, 0);
        world.addBody(this.chassisBody);

        this.chassisMesh = this.buildModel(color);
        scene.add(this.chassisMesh);

        this.vehicle = new CANNON.RaycastVehicle({
            chassisBody: this.chassisBody,
            indexForwardAxis: 2,
            indexRightAxis: 0,
            indexUpAxis: 1,
        });

        const wheelOpts = {
            radius: 0.35,
            directionLocal: new CANNON.Vec3(0, -1, 0),
            suspensionStiffness: 40,
            suspensionRestLength: 0.28,
            frictionSlip: 2.0,
            dampingRelaxation: 2.3,
            dampingCompression: 4.5,
            maxSuspensionForce: 80000,
            rollInfluence: 0.01,
            axleLocal: new CANNON.Vec3(1, 0, 0),
            chassisConnectionPointLocal: new CANNON.Vec3(1, 1, 0),
            maxSuspensionTravel: 0.2,
            customSlidingFrictionWheelStep: 1,
        };

        const wPos = [[-0.85,-0.25,1.4],[0.85,-0.25,1.4],[-0.85,-0.25,-1.4],[0.85,-0.25,-1.4]];
        wPos.forEach(p => {
            wheelOpts.chassisConnectionPointLocal.set(p[0], p[1], p[2]);
            this.vehicle.addWheel({ ...wheelOpts });
            const wm = this.buildWheel();
            this.wheelMeshes.push(wm);
            scene.add(wm);
        });

        this.vehicle.addToWorld(world);
    }

    private buildModel(color: number): THREE.Group {
        const g = new THREE.Group();
        const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.6 });
        const glass = new THREE.MeshStandardMaterial({ color: 0x001122, transparent: true, opacity: 0.6 });
        const hlMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffcc, emissiveIntensity: 3 });
        const tlMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 1.5 });

        const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 4.0), paint);
        body.castShadow = true;
        g.add(body);

        const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.42, 1.9), glass);
        cabin.position.set(0, 0.46, -0.1);
        g.add(cabin);

        const roof = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.05, 1.92), paint);
        roof.position.set(0, 0.68, -0.1);
        g.add(roof);

        // Headlights
        const hlL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.06), hlMat);
        hlL.position.set(-0.55, 0.06, 2.03);
        g.add(hlL);
        const hlR = hlL.clone();
        hlR.position.set(0.55, 0.06, 2.03);
        g.add(hlR);

        // Taillights
        const tlL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.06), tlMat);
        tlL.position.set(-0.55, 0.06, -2.03);
        g.add(tlL);
        const tlR = tlL.clone();
        tlR.position.set(0.55, 0.06, -2.03);
        g.add(tlR);

        return g;
    }

    private buildWheel(): THREE.Group {
        const g = new THREE.Group();
        const tire = new THREE.Mesh(
            new THREE.CylinderGeometry(0.35, 0.35, 0.28, 16),
            new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1.0 })
        );
        tire.rotation.z = Math.PI / 2;
        g.add(tire);
        const rim = new THREE.Mesh(
            new THREE.CylinderGeometry(0.22, 0.22, 0.3, 8),
            new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8 })
        );
        rim.rotation.z = Math.PI / 2;
        g.add(rim);
        return g;
    }

    public update(deltaTime: number) {
        this.aiTimer -= deltaTime;
        if (this.aiTimer <= 0) {
            this.aiTimer = 2 + Math.random() * 4;
            this.aiSteer = (Math.random() - 0.5) * 0.5;
        }

        // Clamp speed to ~40 km/h so they don't fly off
        const vx = this.chassisBody.velocity.x;
        const vz = this.chassisBody.velocity.z;
        const spd = Math.sqrt(vx * vx + vz * vz);
        const force = spd < 11 ? this.aiForce : 0; // 11 m/s ≈ 40 km/h

        this.vehicle.applyEngineForce(force, 2);
        this.vehicle.applyEngineForce(force, 3);
        this.vehicle.setSteeringValue(this.aiSteer, 0);
        this.vehicle.setSteeringValue(this.aiSteer, 1);
        this.vehicle.setBrake(0, 0);
        this.vehicle.setBrake(0, 1);
        this.vehicle.setBrake(0, 2);
        this.vehicle.setBrake(0, 3);

        // Sync visuals
        this.chassisMesh.position.copy(this.chassisBody.position as unknown as THREE.Vector3);
        this.chassisMesh.quaternion.copy(this.chassisBody.quaternion as unknown as THREE.Quaternion);

        for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
            this.vehicle.updateWheelTransform(i);
            const t = this.vehicle.wheelInfos[i].worldTransform;
            this.wheelMeshes[i].position.copy(t.position as unknown as THREE.Vector3);
            this.wheelMeshes[i].quaternion.copy(t.quaternion as unknown as THREE.Quaternion);
        }
    }
}
