import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class BuildingInterior {
    private scene: THREE.Scene;
    private world: CANNON.World;
    private exteriorMesh: THREE.Group;
    private interiorScene: THREE.Scene;
    private interiorPhysics: CANNON.World;
    
    private isPlayerInside = false;
    private entrancePosition: THREE.Vector3;
    private exitPosition: THREE.Vector3;
    private buildingType: 'apartment' | 'shop' | 'garage' | 'office';
    
    constructor(
        scene: THREE.Scene,
        world: CANNON.World,
        position: THREE.Vector3,
        buildingType: 'apartment' | 'shop' | 'garage' | 'office'
    ) {
        this.scene = scene;
        this.world = world;
        this.buildingType = buildingType;
        this.entrancePosition = position.clone();
        
        this.exteriorMesh = this.buildExterior();
        this.exteriorMesh.position.copy(position);
        scene.add(this.exteriorMesh);
        
        this.interiorScene = new THREE.Scene();
        this.interiorPhysics = new CANNON.World();
        this.interiorPhysics.gravity.set(0, -9.82, 0);
        
        this.buildInterior();
        this.setupEntranceTrigger();
    }

    private buildExterior(): THREE.Group {
        const building = new THREE.Group();
        
        switch (this.buildingType) {
            case 'apartment':
                this.buildApartmentExterior(building);
                break;
            case 'shop':
                this.buildShopExterior(building);
                break;
            case 'garage':
                this.buildGarageExterior(building);
                break;
            case 'office':
                this.buildOfficeExterior(building);
                break;
        }
        
        return building;
    }

    private buildApartmentExterior(building: THREE.Group): void {
        // Main building structure
        const wallMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x8b7355, 
            roughness: 0.8 
        });
        const windowMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x87ceeb, 
            transparent: true, 
            opacity: 0.3 
        });
        
        // Back wall
        const backWall = new THREE.Mesh(
            new THREE.BoxGeometry(8, 6, 0.3),
            wallMaterial
        );
        backWall.position.set(0, 3, -4);
        building.add(backWall);
        
        // Side walls
        const leftWall = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 6, 8),
            wallMaterial
        );
        leftWall.position.set(-4, 3, 0);
        building.add(leftWall);
        
        const rightWall = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 6, 8),
            wallMaterial
        );
        rightWall.position.set(4, 3, 0);
        building.add(rightWall);
        
        // Windows
        for (let i = -3; i <= 3; i += 2) {
            const window = new THREE.Mesh(
                new THREE.BoxGeometry(1.5, 2, 0.1),
                windowMaterial
            );
            window.position.set(i, 4, -3.85);
            building.add(window);
        }
        
        // Door
        const doorMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x654321, 
            roughness: 0.7 
        });
        const door = new THREE.Mesh(
            new THREE.BoxGeometry(1.2, 2.5, 0.2),
            doorMaterial
        );
        door.position.set(0, 1.25, 3.9);
        building.add(door);
        
        // Roof
        const roof = new THREE.Mesh(
            new THREE.BoxGeometry(8.3, 0.3, 8.3),
            wallMaterial
        );
        roof.position.set(0, 6.15, 0);
        building.add(roof);
    }

    private buildShopExterior(building: THREE.Group): void {
        // Shop with glass front
        const wallMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x696969, 
            roughness: 0.6 
        });
        const glassMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xadd8e6, 
            transparent: true, 
            opacity: 0.4 
        });
        
        // Back and side walls
        const backWall = new THREE.Mesh(
            new THREE.BoxGeometry(10, 5, 0.3),
            wallMaterial
        );
        backWall.position.set(0, 2.5, -5);
        building.add(backWall);
        
        // Glass front
        const glassFront = new THREE.Mesh(
            new THREE.BoxGeometry(10, 4, 0.1),
            glassMaterial
        );
        glassFront.position.set(0, 2.5, 4.9);
        building.add(glassFront);
        
        // Shop door
        const door = new THREE.Mesh(
            new THREE.BoxGeometry(2, 3, 0.1),
            new THREE.MeshStandardMaterial({ color: 0x333333 })
        );
        door.position.set(0, 1.5, 4.95);
        building.add(door);
        
        // Sign
        const sign = new THREE.Mesh(
            new THREE.BoxGeometry(6, 1, 0.2),
            new THREE.MeshStandardMaterial({ 
                color: 0xff0000, 
                emissive: 0xff0000, 
                emissiveIntensity: 0.5 
            })
        );
        sign.position.set(0, 4.5, 5);
        building.add(sign);
    }

    private buildGarageExterior(building: THREE.Group): void {
        // Industrial garage
        const metalMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x4a4a4a, 
            metalness: 0.7, 
            roughness: 0.3 
        });
        
        // Main structure
        const mainBuilding = new THREE.Mesh(
            new THREE.BoxGeometry(12, 4, 8),
            metalMaterial
        );
        mainBuilding.position.set(0, 2, 0);
        building.add(mainBuilding);
        
        // Large garage door
        const garageDoor = new THREE.Mesh(
            new THREE.BoxGeometry(4, 3, 0.1),
            new THREE.MeshStandardMaterial({ color: 0x333333 })
        );
        garageDoor.position.set(0, 1.5, 4.05);
        building.add(garageDoor);
        
        // Windows
        for (let i = -4; i <= 4; i += 2) {
            const window = new THREE.Mesh(
                new THREE.BoxGeometry(1, 1.5, 0.1),
                new THREE.MeshStandardMaterial({ 
                    color: 0x87ceeb, 
                    transparent: true, 
                    opacity: 0.5 
                })
            );
            window.position.set(i, 2.5, -3.95);
            building.add(window);
        }
    }

    private buildOfficeExterior(building: THREE.Group): void {
        // Modern office building
        const glassMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x4682b4, 
            transparent: true, 
            opacity: 0.3 
        });
        const frameMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x2f4f4f, 
            metalness: 0.8 
        });
        
        // Glass walls
        const frontGlass = new THREE.Mesh(
            new THREE.BoxGeometry(15, 8, 0.1),
            glassMaterial
        );
        frontGlass.position.set(0, 4, 7.5);
        building.add(frontGlass);
        
        // Frame structure
        const frame = new THREE.Mesh(
            new THREE.BoxGeometry(15.2, 8.2, 0.2),
            frameMaterial
        );
        frame.position.set(0, 4, 7.4);
        building.add(frame);
        
        // revolving door
        const door = new THREE.Mesh(
            new THREE.CylinderGeometry(1, 1, 0.3, 8),
            frameMaterial
        );
        door.rotation.x = Math.PI / 2;
        door.position.set(0, 1, 7.6);
        building.add(door);
    }

    private buildInterior(): void {
        switch (this.buildingType) {
            case 'apartment':
                this.buildApartmentInterior();
                break;
            case 'shop':
                this.buildShopInterior();
                break;
            case 'garage':
                this.buildGarageInterior();
                break;
            case 'office':
                this.buildOfficeInterior();
                break;
        }
    }

    private buildApartmentInterior(): void {
        // Interior lighting
        const light = new THREE.PointLight(0xffffff, 1, 20);
        light.position.set(0, 4, 0);
        this.interiorScene.add(light);
        
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.interiorScene.add(ambientLight);
        
        // Floor
        const floorMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x8b7355, 
            roughness: 0.8 
        });
        const floor = new THREE.Mesh(
            new THREE.BoxGeometry(7.5, 0.1, 7.5),
            floorMaterial
        );
        floor.position.set(0, 0, 0);
        this.interiorScene.add(floor);
        
        // Furniture
        this.addApartmentFurniture();
        
        // Interior walls
        const wallMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xf5f5dc, 
            roughness: 0.7 
        });
        
        // Back wall
        const backWall = new THREE.Mesh(
            new THREE.BoxGeometry(7.5, 5, 0.1),
            wallMaterial
        );
        backWall.position.set(0, 2.5, -3.7);
        this.interiorScene.add(backWall);
        
        // Set exit position
        this.exitPosition = new THREE.Vector3(0, 0, 3.5);
    }

    private addApartmentFurniture(): void {
        // Sofa
        const sofaMaterial = new THREE.MeshStandardMaterial({ color: 0x4169e1 });
        const sofa = new THREE.Mesh(
            new THREE.BoxGeometry(2, 0.8, 1),
            sofaMaterial
        );
        sofa.position.set(-2, 0.4, -1);
        this.interiorScene.add(sofa);
        
        // TV
        const tvMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
        const tv = new THREE.Mesh(
            new THREE.BoxGeometry(1.5, 0.8, 0.1),
            tvMaterial
        );
        tv.position.set(0, 1.2, -3.5);
        this.interiorScene.add(tv);
        
        // Table
        const tableMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
        const table = new THREE.Mesh(
            new THREE.BoxGeometry(1.2, 0.1, 0.8),
            tableMaterial
        );
        table.position.set(2, 0.5, 0);
        this.interiorScene.add(table);
        
        // Bed
        const bedMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
        const bed = new THREE.Mesh(
            new THREE.BoxGeometry(2, 0.3, 1.5),
            bedMaterial
        );
        bed.position.set(2, 0.3, 2);
        this.interiorScene.add(bed);
    }

    private buildShopInterior(): void {
        // Shop interior with shelves and counter
        const light = new THREE.PointLight(0xffffff, 1.5, 25);
        light.position.set(0, 4, 0);
        this.interiorScene.add(light);
        
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
        this.interiorScene.add(ambientLight);
        
        // Floor
        const floor = new THREE.Mesh(
            new THREE.BoxGeometry(9.5, 0.1, 9.5),
            new THREE.MeshStandardMaterial({ color: 0x696969 })
        );
        floor.position.set(0, 0, 0);
        this.interiorScene.add(floor);
        
        // Counter
        const counterMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
        const counter = new THREE.Mesh(
            new THREE.BoxGeometry(8, 1, 0.5),
            counterMaterial
        );
        counter.position.set(0, 0.5, -4);
        this.interiorScene.add(counter);
        
        // Shelves
        const shelfMaterial = new THREE.MeshStandardMaterial({ color: 0x654321 });
        for (let x = -3; x <= 3; x += 3) {
            const shelf = new THREE.Mesh(
                new THREE.BoxGeometry(0.5, 3, 2),
                shelfMaterial
            );
            shelf.position.set(x, 1.5, 2);
            this.interiorScene.add(shelf);
        }
        
        this.exitPosition = new THREE.Vector3(0, 0, 4.5);
    }

    private buildGarageInterior(): void {
        // Garage interior with tools and work area
        const light = new THREE.PointLight(0xffffff, 0.8, 30);
        light.position.set(0, 3, 0);
        this.interiorScene.add(light);
        
        // Floor with oil stains
        const floor = new THREE.Mesh(
            new THREE.BoxGeometry(11.5, 0.1, 7.5),
            new THREE.MeshStandardMaterial({ color: 0x2f2f2f })
        );
        floor.position.set(0, 0, 0);
        this.interiorScene.add(floor);
        
        // Work bench
        const benchMaterial = new THREE.MeshStandardMaterial({ color: 0x4a4a4a });
        const workbench = new THREE.Mesh(
            new THREE.BoxGeometry(3, 0.8, 1),
            benchMaterial
        );
        workbench.position.set(-3, 0.4, 0);
        this.interiorScene.add(workbench);
        
        // Tool chest
        const toolChest = new THREE.Mesh(
            new THREE.BoxGeometry(1, 0.8, 0.8),
            new THREE.MeshStandardMaterial({ color: 0xff0000 })
        );
        toolChest.position.set(-3, 0.4, 2);
        this.interiorScene.add(toolChest);
        
        // Car lift
        const liftMaterial = new THREE.MeshStandardMaterial({ color: 0x666666 });
        const lift = new THREE.Mesh(
            new THREE.BoxGeometry(0.2, 0.5, 2),
            liftMaterial
        );
        lift.position.set(3, 0.3, 0);
        this.interiorScene.add(lift);
        
        this.exitPosition = new THREE.Vector3(0, 0, 3.5);
    }

    private buildOfficeInterior(): void {
        // Modern office interior
        const light = new THREE.PointLight(0xffffff, 1.2, 30);
        light.position.set(0, 5, 0);
        this.interiorScene.add(light);
        
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.interiorScene.add(ambientLight);
        
        // Floor
        const floor = new THREE.Mesh(
            new THREE.BoxGeometry(14.5, 0.1, 14.5),
            new THREE.MeshStandardMaterial({ color: 0xf0f0f0 })
        );
        floor.position.set(0, 0, 0);
        this.interiorScene.add(floor);
        
        // Desks
        const deskMaterial = new THREE.MeshStandardMaterial({ color: 0x8b7355 });
        for (let x = -5; x <= 5; x += 5) {
            for (let z = -5; z <= 5; z += 5) {
                const desk = new THREE.Mesh(
                    new THREE.BoxGeometry(2, 0.8, 1),
                    deskMaterial
                );
                desk.position.set(x, 0.4, z);
                this.interiorScene.add(desk);
                
                // Chair
                const chair = new THREE.Mesh(
                    new THREE.BoxGeometry(0.8, 0.8, 0.8),
                    new THREE.MeshStandardMaterial({ color: 0x333333 })
                );
                chair.position.set(x, 0.4, z + 0.8);
                this.interiorScene.add(chair);
            }
        }
        
        this.exitPosition = new THREE.Vector3(0, 0, 6.5);
    }

    private setupEntranceTrigger(): void {
        // Create entrance trigger zone
        const triggerShape = new CANNON.Box(new CANNON.Vec3(1, 2, 1));
        const triggerBody = new CANNON.Body({
            mass: 0,
            shape: triggerShape,
            position: new CANNON.Vec3(
                this.entrancePosition.x,
                this.entrancePosition.y + 1,
                this.entrancePosition.z + 1
            ),
            isTrigger: true
        });
        
        triggerBody.addEventListener('collide', () => {
            if (!this.isPlayerInside) {
                this.enterBuilding();
            }
        });
        
        this.world.addBody(triggerBody);
    }

    public enterBuilding(): void {
        this.isPlayerInside = true;
        // This would be handled by the Core class
        console.log(`Entered ${this.buildingType} building`);
    }

    public exitBuilding(): void {
        this.isPlayerInside = false;
        console.log(`Exited ${this.buildingType} building`);
    }

    public getInteriorScene(): THREE.Scene {
        return this.interiorScene;
    }

    public getExitPosition(): THREE.Vector3 {
        return this.exitPosition;
    }

    public isPlayerInBuilding(): boolean {
        return this.isPlayerInside;
    }

    public getBuildingType(): string {
        return this.buildingType;
    }
}
