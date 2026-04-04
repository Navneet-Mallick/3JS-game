import * as THREE from 'three';
import * as CANNON from 'cannon-es';

const COLORS = [0x8b0000, 0x003366, 0x1a4a1a, 0x4a3000, 0x2a0050, 0x444444, 0x660033];

// Road grid constants (must match City.ts)
const BLOCK = 60;
const ROAD  = 18;
const STEP  = BLOCK + ROAD;

/** Snap a world position to the nearest road centre-line */
function nearestRoadPoint(x: number, z: number): THREE.Vector3 {
    // Road centres are at multiples of STEP offset by -STEP/2
    const snapX = Math.round((x + STEP / 2) / STEP) * STEP - STEP / 2;
    const snapZ = Math.round((z + STEP / 2) / STEP) * STEP - STEP / 2;
    // Pick whichever axis is closer
    const dX = Math.abs(x - snapX);
    const dZ = Math.abs(z - snapZ);
    return dX < dZ
        ? new THREE.Vector3(snapX, 0, z)
        : new THREE.Vector3(x, 0, snapZ);
}

/** Pick a random road waypoint within the city grid */
function randomWaypoint(): THREE.Vector3 {
    const EXTENT = 3;
    const i = Math.floor(Math.random() * (EXTENT * 2 + 1)) - EXTENT;
    const axis = Math.random() > 0.5;
    const along = (Math.random() * (EXTENT * 2 + 1) - EXTENT) * STEP;
    const road = i * STEP - STEP / 2;
    return axis
        ? new THREE.Vector3(along, 0, road)
        : new THREE.Vector3(road, 0, along);
}

export class TrafficCar {
    public chassisBody: CANNON.Body;
    private chassisMesh: THREE.Group;
    private vehicle: CANNON.RaycastVehicle;
    private wheelMeshes: THREE.Group[] = [];

    private waypoint: THREE.Vector3;
    private stuckTimer = 0;
    private lastPos = new THREE.Vector3();

    constructor(scene: THREE.Scene, world: CANNON.World, position: CANNON.Vec3) {
        const color = COLORS[Math.floor(Math.random() * COLORS.length)];

        const chassisShape = new CANNON.Box(new CANNON.Vec3(0.9, 0.3, 2.0));
        this.chassisBody = new CANNON.Body({ mass: 1000, shape: chassisShape });
        // Spawn high enough so wheels reach ground: wheel_radius(0.35) + rest(0.28) + half_height(0.3) ≈ 1.0
        this.chassisBody.position.set(position.x, position.y + 1.0, position.z);
        this.chassisBody.linearDamping  = 0.1;
        this.chassisBody.angularDamping = 0.6;
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

        const wPos = [[-0.85,-0.1,1.4],[0.85,-0.1,1.4],[-0.85,-0.1,-1.4],[0.85,-0.1,-1.4]];
        wPos.forEach(p => {
            wheelOpts.chassisConnectionPointLocal.set(p[0], p[1], p[2]);
            this.vehicle.addWheel({ ...wheelOpts });
            const wm = this.buildWheel();
            this.wheelMeshes.push(wm);
            scene.add(wm);
        });

        this.vehicle.addToWorld(world);

        // Start with a road-snapped waypoint
        this.waypoint = nearestRoadPoint(position.x, position.z);
        this.lastPos.set(position.x, position.y + 1.0, position.z);
    }

    private buildModel(color: number): THREE.Group {
        const g = new THREE.Group();
        const paint = new THREE.MeshLambertMaterial({ color });
        const glass = new THREE.MeshLambertMaterial({ color: 0x223344, transparent: true, opacity: 0.5 });
        const hlMat = new THREE.MeshBasicMaterial({ color: 0xffffcc });
        const tlMat = new THREE.MeshBasicMaterial({ color: 0xff2200 });

        const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 4.0), paint);
        body.castShadow = false;
        g.add(body);

        const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.42, 1.9), glass);
        cabin.position.set(0, 0.46, -0.1);
        g.add(cabin);

        const hlL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.06), hlMat);
        hlL.position.set(-0.55, 0.06, 2.03);
        g.add(hlL);
        const hlR = hlL.clone(); hlR.position.set(0.55, 0.06, 2.03); g.add(hlR);

        const tlL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.06), tlMat);
        tlL.position.set(-0.55, 0.06, -2.03);
        g.add(tlL);
        const tlR = tlL.clone(); tlR.position.set(0.55, 0.06, -2.03); g.add(tlR);

        return g;
    }

    private buildWheel(): THREE.Group {
        const g = new THREE.Group();
        const tire = new THREE.Mesh(
            new THREE.CylinderGeometry(0.35, 0.35, 0.28, 8), // 8 segments instead of 16
            new THREE.MeshLambertMaterial({ color: 0x111111 })
        );
        tire.rotation.z = Math.PI / 2;
        g.add(tire);
        return g;
    }

    public update(dt: number) {
        const pos = this.chassisBody.position;
        const curPos = new THREE.Vector3(pos.x, pos.y, pos.z);

        // Stuck detection — if barely moved in 2s, pick new waypoint
        this.stuckTimer += dt;
        if (this.stuckTimer > 2.0) {
            if (curPos.distanceTo(this.lastPos) < 1.5) {
                this.waypoint = randomWaypoint();
                // Give a small nudge
                this.chassisBody.velocity.set(
                    (Math.random() - 0.5) * 4,
                    0,
                    (Math.random() - 0.5) * 4
                );
            }
            this.lastPos.copy(curPos);
            this.stuckTimer = 0;
        }

        // Reached waypoint → pick next road waypoint
        const flatDist = new THREE.Vector2(pos.x - this.waypoint.x, pos.z - this.waypoint.z).length();
        if (flatDist < 8) {
            this.waypoint = randomWaypoint();
        }

        // Steering toward waypoint
        const toWP = new THREE.Vector3(this.waypoint.x - pos.x, 0, this.waypoint.z - pos.z).normalize();
        const carFwd = new THREE.Vector3(0, 0, 1).applyQuaternion(
            this.chassisBody.quaternion as unknown as THREE.Quaternion
        );
        const cross = carFwd.x * toWP.z - carFwd.z * toWP.x; // signed angle
        const steer = Math.max(-0.45, Math.min(0.45, -cross * 1.8));

        const vx = this.chassisBody.velocity.x;
        const vz = this.chassisBody.velocity.z;
        const spd = Math.sqrt(vx * vx + vz * vz);
        const force = spd < 11 ? 1200 : 0;

        this.vehicle.applyEngineForce(force, 2);
        this.vehicle.applyEngineForce(force, 3);
        this.vehicle.setSteeringValue(steer, 0);
        this.vehicle.setSteeringValue(steer, 1);
        this.vehicle.setBrake(0, 0);
        this.vehicle.setBrake(0, 1);
        this.vehicle.setBrake(0, 2);
        this.vehicle.setBrake(0, 3);

        this.chassisMesh.position.copy(this.chassisBody.position as unknown as THREE.Vector3);
        this.chassisMesh.quaternion.copy(this.chassisBody.quaternion as unknown as THREE.Quaternion);

        for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
            this.vehicle.updateWheelTransform(i);
            const t = this.vehicle.wheelInfos[i].worldTransform;
            this.wheelMeshes[i].position.copy(t.position as unknown as THREE.Vector3);
            this.wheelMeshes[i].quaternion.copy(t.quaternion as unknown as THREE.Quaternion);
        }
    }

    public getPosition() { return this.chassisMesh.position; }
}
