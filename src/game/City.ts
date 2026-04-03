import * as THREE from 'three';
import * as CANNON from 'cannon-es';

const BLOCK  = 60;
const ROAD   = 18;
const STEP   = BLOCK + ROAD;
const EXTENT = 3;

function mulberry32(seed: number) {
    return function () {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

export class City {
    private collectibles: THREE.Mesh[] = [];
    private destructibles: { mesh: THREE.Mesh; body: CANNON.Body; health: number }[] = [];
    private powerUps: THREE.Mesh[] = [];

    constructor(scene: THREE.Scene, world: CANNON.World, groundMaterial: CANNON.Material) {
        this.buildGround(scene, world, groundMaterial);
        this.buildRoads(scene);
        this.buildBlocks(scene, world);
        this.buildStreetLights(scene);
        this.buildCollectibles(scene, world);
        this.buildDestructibles(scene, world);
        this.buildPowerUps(scene, world);
    }

    public getCollectibles() { return this.collectibles; }
    public getDestructibles() { return this.destructibles; }
    public getPowerUps() { return this.powerUps; }

    private buildGround(scene: THREE.Scene, world: CANNON.World, groundMaterial: CANNON.Material) {
        const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(2000, 2000),
            new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.8 })
        );
        mesh.rotation.x = -Math.PI / 2;
        mesh.receiveShadow = true;
        scene.add(mesh);
        const body = new CANNON.Body({ 
            type: CANNON.Body.STATIC, 
            shape: new CANNON.Plane(),
            material: groundMaterial 
        });
        body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        world.addBody(body);
    }

    private buildRoads(scene: THREE.Scene) {
        const roadMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.8 });
        const dashMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, emissive: 0xffcc00, emissiveIntensity: 0.3 });
        const edgeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.15 });
        const half = ((EXTENT * 2 + 1) * STEP) / 2 + ROAD;

        for (let i = -EXTENT; i <= EXTENT + 1; i++) {
            const z = i * STEP - STEP / 2;
            const hRoad = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, ROAD), roadMat);
            hRoad.rotation.x = -Math.PI / 2;
            hRoad.position.set(0, 0.01, z);
            hRoad.receiveShadow = true;
            scene.add(hRoad);
            for (let x = -half; x < half; x += 8) {
                const dash = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.2), dashMat);
                dash.rotation.x = -Math.PI / 2;
                dash.position.set(x + 2, 0.02, z);
                scene.add(dash);
            }
            for (const off of [-ROAD / 2 + 0.3, ROAD / 2 - 0.3]) {
                const edge = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, 0.25), edgeMat);
                edge.rotation.x = -Math.PI / 2;
                edge.position.set(0, 0.02, z + off);
                scene.add(edge);
            }
            const vRoad = new THREE.Mesh(new THREE.PlaneGeometry(ROAD, half * 2), roadMat);
            vRoad.rotation.x = -Math.PI / 2;
            vRoad.position.set(z, 0.01, 0);
            vRoad.receiveShadow = true;
            scene.add(vRoad);
            for (let zz = -half; zz < half; zz += 8) {
                const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 4), dashMat);
                dash.rotation.x = -Math.PI / 2;
                dash.position.set(z, 0.02, zz + 2);
                scene.add(dash);
            }
        }
    }

    private buildBlocks(scene: THREE.Scene, world: CANNON.World) {
        const rng = mulberry32(42);
        const mats = [
            new THREE.MeshStandardMaterial({ color: 0x111118, roughness: 0.6, metalness: 0.4 }),
            new THREE.MeshStandardMaterial({ color: 0x0a0a14, roughness: 0.2, metalness: 0.8 }),
            new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.9, metalness: 0.1 }),
        ];
        const neonColors = [0x00f2ff, 0x7000ff, 0xff0055, 0x00ffaa];

        for (let bx = -EXTENT; bx <= EXTENT; bx++) {
            for (let bz = -EXTENT; bz <= EXTENT; bz++) {
                if (bx === 0 && bz === 0) continue;
                const cx = bx * STEP;
                const cz = bz * STEP;
                const dist = Math.sqrt(bx * bx + bz * bz);
                const numB = Math.floor(rng() * 3) + 1;
                for (let i = 0; i < numB; i++) {
                    const w = 8 + rng() * 14;
                    const d = 8 + rng() * 14;
                    const h = 10 + rng() * Math.max(12, 80 - dist * 8);
                    const mat = mats[Math.floor(rng() * mats.length)];
                    const ox = (rng() - 0.5) * (BLOCK - w - 2);
                    const oz = (rng() - 0.5) * (BLOCK - d - 2);
                    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
                    mesh.position.set(cx + ox, h / 2, cz + oz);
                    mesh.castShadow = true;
                    mesh.receiveShadow = true;
                    scene.add(mesh);
                    world.addBody(new CANNON.Body({
                        type: CANNON.Body.STATIC,
                        shape: new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)),
                        position: new CANNON.Vec3(cx + ox, h / 2, cz + oz),
                    }));
                    if (rng() > 0.45) {
                        const nc = neonColors[Math.floor(rng() * neonColors.length)];
                        const nMat = new THREE.MeshBasicMaterial({ color: nc });
                        if (rng() > 0.5) {
                            const strip = new THREE.Mesh(new THREE.BoxGeometry(0.4, h * 0.7, 0.4), nMat);
                            strip.position.set(cx + ox + w / 2, h * 0.65, cz + oz + d / 2);
                            scene.add(strip);
                        } else {
                            const crown = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.8, d + 0.4), nMat);
                            crown.position.set(cx + ox, h - 0.4, cz + oz);
                            scene.add(crown);
                        }
                        const pl = new THREE.PointLight(nc, 1.5, 20);
                        pl.position.set(cx + ox, h + 1, cz + oz);
                        scene.add(pl);
                    }
                }
            }
        }
    }

    private buildStreetLights(scene: THREE.Scene) {
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8 });
        const lampMat = new THREE.MeshStandardMaterial({ color: 0xffffcc, emissive: 0xffffcc, emissiveIntensity: 3 });
        for (let bx = -EXTENT; bx <= EXTENT + 1; bx++) {
            for (let bz = -EXTENT; bz <= EXTENT + 1; bz++) {
                const x = bx * STEP - STEP / 2;
                const z = bz * STEP - STEP / 2;
                const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 8, 6), poleMat);
                pole.position.set(x, 4, z);
                scene.add(pole);
                const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.6), lampMat);
                lamp.position.set(x, 8.1, z);
                scene.add(lamp);
                const light = new THREE.PointLight(0xffffaa, 2, 28);
                light.position.set(x, 8, z);
                scene.add(light);
            }
        }
    }

    private buildCollectibles(scene: THREE.Scene, world: CANNON.World) {
        const collectiblePositions: [number, number, number][] = [
            [15, 1, 15], [-15, 1, 15], [15, 1, -15], [-15, 1, -15],
            [40, 1, 0], [-40, 1, 0], [0, 1, 40], [0, 1, -40],
            [30, 1, 30], [-30, 1, 30], [30, 1, -30], [-30, 1, -30]
        ];

        collectiblePositions.forEach(([x, y, z], index) => {
            const geometry = new THREE.OctahedronGeometry(0.8, 0);
            const material = new THREE.MeshStandardMaterial({
                color: 0x00ff88,
                emissive: 0x00ff88,
                emissiveIntensity: 0.5,
                metalness: 0.8,
                roughness: 0.2
            });
            const collectible = new THREE.Mesh(geometry, material);
            collectible.position.set(x, y, z);
            collectible.castShadow = true;
            collectible.userData = { type: 'collectible', id: index, collected: false };
            
            // Add rotation animation
            collectible.userData.rotationSpeed = Math.random() * 0.02 + 0.01;
            
            scene.add(collectible);
            this.collectibles.push(collectible);

            // Add physics body for collision detection
            const body = new CANNON.Body({
                mass: 0,
                shape: new CANNON.Sphere(0.8),
                position: new CANNON.Vec3(x, y, z)
            });
            body.collisionFilterGroup = 2; // Collectible group
            body.collisionFilterMask = 1; // Collide with player/vehicle
            world.addBody(body);
        });
    }

    private buildDestructibles(scene: THREE.Scene, world: CANNON.World) {
        const destructiblePositions: [number, number, number][] = [
            [25, 1, 10], [-25, 1, 10], [25, 1, -10], [-25, 1, -10],
            [10, 1, 25], [10, 1, -25], [-10, 1, 25], [-10, 1, -25]
        ];

        destructiblePositions.forEach(([x, y, z], index) => {
            const geometry = new THREE.BoxGeometry(2, 2, 2);
            const material = new THREE.MeshStandardMaterial({
                color: 0xff4444,
                roughness: 0.7,
                metalness: 0.3
            });
            const destructible = new THREE.Mesh(geometry, material);
            destructible.position.set(x, y, z);
            destructible.castShadow = true;
            destructible.receiveShadow = true;
            destructible.userData = { type: 'destructible', id: index, health: 100 };
            
            scene.add(destructible);

            const body = new CANNON.Body({
                mass: 50,
                shape: new CANNON.Box(new CANNON.Vec3(1, 1, 1)),
                position: new CANNON.Vec3(x, y, z)
            });
            body.collisionFilterGroup = 4; // Destructible group
            body.collisionFilterMask = 1; // Collide with player/vehicle
            world.addBody(body);

            this.destructibles.push({ mesh: destructible, body, health: 100 });
        });
    }

    private buildPowerUps(scene: THREE.Scene, world: CANNON.World) {
        const powerUpPositions: [number, number, number][] = [
            [20, 1, 0], [-20, 1, 0], [0, 1, 20], [0, 1, -20],
            [35, 1, 15], [-35, 1, 15], [35, 1, -15], [-35, 1, -15]
        ];

        powerUpPositions.forEach(([x, y, z], index) => {
            const geometry = new THREE.TetrahedronGeometry(0.6, 0);
            const material = new THREE.MeshStandardMaterial({
                color: 0xff00ff,
                emissive: 0xff00ff,
                emissiveIntensity: 0.8,
                metalness: 0.7,
                roughness: 0.3
            });
            const powerUp = new THREE.Mesh(geometry, material);
            powerUp.position.set(x, y, z);
            powerUp.castShadow = true;
            powerUp.userData = { 
                type: 'powerup', 
                id: index, 
                collected: false,
                powerType: 'speed',
                rotationSpeed: Math.random() * 0.03 + 0.02
            };
            
            scene.add(powerUp);
            this.powerUps.push(powerUp);

            // Add physics body for collision detection
            const body = new CANNON.Body({
                mass: 0,
                shape: new CANNON.Sphere(0.6),
                position: new CANNON.Vec3(x, y, z)
            });
            body.collisionFilterGroup = 8; // Power-up group
            body.collisionFilterMask = 1; // Collide with player/vehicle
            world.addBody(body);
        });
    }
}
