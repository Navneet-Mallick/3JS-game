import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

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
        this.buildCollectibles(scene);
        this.buildDestructibles(scene, world);
        this.buildPowerUps(scene);
    }

    public getCollectibles() { return this.collectibles; }
    public getDestructibles() { return this.destructibles; }
    public getPowerUps()      { return this.powerUps; }

    private buildGround(scene: THREE.Scene, world: CANNON.World, groundMaterial: CANNON.Material) {
        // Single large ground plane — MeshLambertMaterial, no shadow receive needed
        const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(2000, 2000),
            new THREE.MeshLambertMaterial({ color: 0x3a3a3a })
        );
        mesh.rotation.x = -Math.PI / 2;
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
        // Merge ALL road geometry into a single draw call using BufferGeometryUtils
        const roadMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
        const dashMat = new THREE.MeshLambertMaterial({ color: 0xddaa00 });
        const half    = ((EXTENT * 2 + 1) * STEP) / 2 + ROAD;

        const roadGeos: THREE.BufferGeometry[] = [];
        const dashGeos: THREE.BufferGeometry[] = [];

        for (let i = -EXTENT; i <= EXTENT + 1; i++) {
            const offset = i * STEP - STEP / 2;

            // Horizontal road strip
            const hg = new THREE.PlaneGeometry(half * 2, ROAD);
            hg.rotateX(-Math.PI / 2);
            hg.translate(0, 0.01, offset);
            roadGeos.push(hg);

            // Vertical road strip
            const vg = new THREE.PlaneGeometry(ROAD, half * 2);
            vg.rotateX(-Math.PI / 2);
            vg.translate(offset, 0.01, 0);
            roadGeos.push(vg);

            // Centre dashes — merged
            for (let x = -half; x < half; x += 10) {
                const dh = new THREE.PlaneGeometry(5, 0.25);
                dh.rotateX(-Math.PI / 2);
                dh.translate(x + 2.5, 0.02, offset);
                dashGeos.push(dh);

                const dv = new THREE.PlaneGeometry(0.25, 5);
                dv.rotateX(-Math.PI / 2);
                dv.translate(offset, 0.02, x + 2.5);
                dashGeos.push(dv);
            }
        }

        // Merge into single mesh each
        const mergedRoad = mergeGeometries(roadGeos);
        const mergedDash = mergeGeometries(dashGeos);
        if (mergedRoad) scene.add(new THREE.Mesh(mergedRoad, roadMat));
        if (mergedDash) scene.add(new THREE.Mesh(mergedDash, dashMat));

        // Dispose source geos
        roadGeos.forEach(g => g.dispose());
        dashGeos.forEach(g => g.dispose());
    }

    private buildBlocks(scene: THREE.Scene, world: CANNON.World) {
        const rng = mulberry32(42);

        // Shared materials — Lambert only, no metalness/roughness PBR cost
        const mats = [
            new THREE.MeshLambertMaterial({ color: 0x1a1a28 }),
            new THREE.MeshLambertMaterial({ color: 0x0e0e1c }),
            new THREE.MeshLambertMaterial({ color: 0x222230 }),
            new THREE.MeshLambertMaterial({ color: 0x181820 }),
        ];
        // Neon accent — emissive only, NO PointLights
        const neonMats = [
            new THREE.MeshBasicMaterial({ color: 0x00eeff }),
            new THREE.MeshBasicMaterial({ color: 0x8800ff }),
            new THREE.MeshBasicMaterial({ color: 0xff0055 }),
            new THREE.MeshBasicMaterial({ color: 0x00ffaa }),
        ];

        for (let bx = -EXTENT; bx <= EXTENT; bx++) {
            for (let bz = -EXTENT; bz <= EXTENT; bz++) {
                if (bx === 0 && bz === 0) continue;
                const cx   = bx * STEP;
                const cz   = bz * STEP;
                const dist = Math.sqrt(bx * bx + bz * bz);
                const numB = Math.floor(rng() * 3) + 1;

                for (let i = 0; i < numB; i++) {
                    const w  = 8  + rng() * 14;
                    const d  = 8  + rng() * 14;
                    const h  = 10 + rng() * Math.max(12, 80 - dist * 8);
                    const ox = (rng() - 0.5) * (BLOCK - w - 2);
                    const oz = (rng() - 0.5) * (BLOCK - d - 2);
                    const mat = mats[Math.floor(rng() * mats.length)];

                    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
                    mesh.position.set(cx + ox, h / 2, cz + oz);
                    mesh.castShadow = false; // buildings don't cast — huge perf win
                    mesh.receiveShadow = false;
                    scene.add(mesh);

                    // Physics body
                    world.addBody(new CANNON.Body({
                        type: CANNON.Body.STATIC,
                        shape: new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)),
                        position: new CANNON.Vec3(cx + ox, h / 2, cz + oz),
                    }));

                    // Neon accent — emissive mesh only, zero lights
                    if (rng() > 0.5) {
                        const nm = neonMats[Math.floor(rng() * neonMats.length)];
                        if (rng() > 0.5) {
                            const strip = new THREE.Mesh(new THREE.BoxGeometry(0.3, h * 0.6, 0.3), nm);
                            strip.position.set(cx + ox + w / 2, h * 0.6, cz + oz + d / 2);
                            scene.add(strip);
                        } else {
                            const crown = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.6, d + 0.3), nm);
                            crown.position.set(cx + ox, h - 0.3, cz + oz);
                            scene.add(crown);
                        }
                        // NO PointLight — emissive colour gives the visual, zero GPU cost
                    }
                }
            }
        }
    }

    private buildStreetLights(scene: THREE.Scene) {
        // Poles only — NO PointLights. Ambient light handles illumination.
        const poleMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
        const lampMat = new THREE.MeshBasicMaterial({ color: 0xffffcc }); // BasicMaterial = free

        const poleGeos: THREE.BufferGeometry[] = [];
        const lampGeos: THREE.BufferGeometry[] = [];

        for (let bx = -EXTENT; bx <= EXTENT + 1; bx++) {
            for (let bz = -EXTENT; bz <= EXTENT + 1; bz++) {
                const x = bx * STEP - STEP / 2;
                const z = bz * STEP - STEP / 2;

                const pg = new THREE.CylinderGeometry(0.08, 0.08, 7, 5);
                pg.translate(x, 3.5, z);
                poleGeos.push(pg);

                const lg = new THREE.BoxGeometry(0.5, 0.18, 0.5);
                lg.translate(x, 7.1, z);
                lampGeos.push(lg);
            }
        }

        const mergedPoles = mergeGeometries(poleGeos);
        const mergedLamps = mergeGeometries(lampGeos);
        if (mergedPoles) scene.add(new THREE.Mesh(mergedPoles, poleMat));
        if (mergedLamps) scene.add(new THREE.Mesh(mergedLamps, lampMat));

        poleGeos.forEach(g => g.dispose());
        lampGeos.forEach(g => g.dispose());
    }

    private buildCollectibles(scene: THREE.Scene) {
        const positions: [number, number, number][] = [
            [15, 1, 15], [-15, 1, 15], [15, 1, -15], [-15, 1, -15],
            [40, 1, 0],  [-40, 1, 0],  [0, 1, 40],   [0, 1, -40],
        ];
        // Shared geometry + material — instanced would be ideal but this is fine for 8
        const geo = new THREE.OctahedronGeometry(0.7, 0);
        const mat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });

        positions.forEach(([x, y, z], i) => {
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(x, y, z);
            mesh.userData = { type: 'collectible', id: i, collected: false, rotationSpeed: 0.025 };
            scene.add(mesh);
            this.collectibles.push(mesh);
        });
    }

    private buildDestructibles(scene: THREE.Scene, world: CANNON.World) {
        const positions: [number, number, number][] = [
            [25, 1, 10], [-25, 1, 10], [25, 1, -10], [-25, 1, -10],
            [10, 1, 25], [10, 1, -25], [-10, 1, 25], [-10, 1, -25],
        ];
        const geo = new THREE.BoxGeometry(2, 2, 2);
        const mat = new THREE.MeshLambertMaterial({ color: 0xcc3333 });

        positions.forEach(([x, y, z], i) => {
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(x, y, z);
            mesh.castShadow = false;
            mesh.userData = { type: 'destructible', id: i, health: 100 };
            scene.add(mesh);

            const body = new CANNON.Body({
                mass: 50,
                shape: new CANNON.Box(new CANNON.Vec3(1, 1, 1)),
                position: new CANNON.Vec3(x, y, z),
            });
            world.addBody(body);
            this.destructibles.push({ mesh, body, health: 100 });
        });
    }

    private buildPowerUps(scene: THREE.Scene) {
        const positions: [number, number, number][] = [
            [20, 1, 0], [-20, 1, 0], [0, 1, 20], [0, 1, -20],
        ];
        const geo = new THREE.TetrahedronGeometry(0.6, 0);
        const mat = new THREE.MeshBasicMaterial({ color: 0xff00ff });

        positions.forEach(([x, y, z], i) => {
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(x, y, z);
            mesh.userData = {
                type: 'powerup', id: i, collected: false,
                powerType: 'speed', rotationSpeed: 0.03
            };
            scene.add(mesh);
            this.powerUps.push(mesh);
        });
    }
}
