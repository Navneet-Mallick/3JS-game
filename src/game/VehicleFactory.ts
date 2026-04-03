import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Vehicle } from './Vehicle';
import { Sound } from './Sound';

export const VehicleType = {
    SEDAN: 'sedan',
    SPORTS: 'sports',
    TRUCK: 'truck',
    MOTORCYCLE: 'motorcycle',
    POLICE: 'police',
    AMBULANCE: 'ambulance'
} as const;

export type VehicleType = typeof VehicleType[keyof typeof VehicleType];

export interface VehicleConfig {
    type: VehicleType;
    name: string;
    mass: number;
    maxSpeed: number;
    acceleration: number;
    braking: number;
    handling: number;
    durability: number;
    color: number;
    price?: number;
}

export class VehicleFactory {
    private static readonly VEHICLE_CONFIGS: Map<VehicleType, VehicleConfig> = new Map([
        [VehicleType.SEDAN, {
            type: VehicleType.SEDAN,
            name: 'Standard Sedan',
            mass: 1200,
            maxSpeed: 180,
            acceleration: 1.0,
            braking: 1.0,
            handling: 1.0,
            durability: 100,
            color: 0x2a4d8f,
            price: 15000
        }],
        [VehicleType.SPORTS, {
            type: VehicleType.SPORTS,
            name: 'Sports Car',
            mass: 800,
            maxSpeed: 250,
            acceleration: 1.8,
            braking: 1.5,
            handling: 1.6,
            durability: 70,
            color: 0xff0000,
            price: 45000
        }],
        [VehicleType.TRUCK, {
            type: VehicleType.TRUCK,
            name: 'Pickup Truck',
            mass: 2000,
            maxSpeed: 140,
            acceleration: 0.7,
            braking: 0.8,
            handling: 0.6,
            durability: 150,
            color: 0x8b4513,
            price: 25000
        }],
        [VehicleType.MOTORCYCLE, {
            type: VehicleType.MOTORCYCLE,
            name: 'Motorcycle',
            mass: 200,
            maxSpeed: 200,
            acceleration: 2.2,
            braking: 1.3,
            handling: 2.0,
            durability: 40,
            color: 0x000000,
            price: 12000
        }],
        [VehicleType.POLICE, {
            type: VehicleType.POLICE,
            name: 'Police Cruiser',
            mass: 1600,
            maxSpeed: 200,
            acceleration: 1.3,
            braking: 1.4,
            handling: 1.2,
            durability: 120,
            color: 0x000080
        }],
        [VehicleType.AMBULANCE, {
            type: VehicleType.AMBULANCE,
            name: 'Ambulance',
            mass: 1800,
            maxSpeed: 160,
            acceleration: 0.9,
            braking: 1.1,
            handling: 0.8,
            durability: 110,
            color: 0xffffff
        }]
    ]);

    static createVehicle(
        type: VehicleType,
        scene: THREE.Scene,
        world: CANNON.World,
        camera: THREE.PerspectiveCamera,
        position: CANNON.Vec3,
        sound: Sound
    ): Vehicle {
        const config = this.VEHICLE_CONFIGS.get(type);
        if (!config) {
            throw new Error(`Unknown vehicle type: ${type}`);
        }

        // Create a custom vehicle class based on type
        switch (type) {
            case VehicleType.SPORTS:
                return this.createSportsCar(scene, world, camera, position, sound, config);
            case VehicleType.TRUCK:
                return this.createTruck(scene, world, camera, position, sound, config);
            case VehicleType.MOTORCYCLE:
                return this.createMotorcycle(scene, world, camera, position, sound, config);
            case VehicleType.POLICE:
                return this.createPoliceCar(scene, world, camera, position, sound, config);
            case VehicleType.AMBULANCE:
                return this.createAmbulance(scene, world, camera, position, sound, config);
            default:
                return this.createSedan(scene, world, camera, position, sound, config);
        }
    }

    private static createSportsCar(
        scene: THREE.Scene,
        world: CANNON.World,
        camera: THREE.PerspectiveCamera,
        position: CANNON.Vec3,
        sound: Sound,
        config: VehicleConfig
    ): Vehicle {
        const vehicle = new Vehicle(scene, world, camera, position, sound);
        
        // Customize for sports car
        this.customizeVehicle(vehicle, config, {
            loweredSuspension: true,
            wideTires: true,
            spoiler: true,
            engineSound: 'sport'
        });
        
        return vehicle;
    }

    private static createTruck(
        scene: THREE.Scene,
        world: CANNON.World,
        camera: THREE.PerspectiveCamera,
        position: CANNON.Vec3,
        sound: Sound,
        config: VehicleConfig
    ): Vehicle {
        const vehicle = new Vehicle(scene, world, camera, position, sound);
        
        // Customize for truck
        this.customizeVehicle(vehicle, config, {
            raisedSuspension: true,
            offroadTires: true,
            truckBed: true,
            engineSound: 'truck'
        });
        
        return vehicle;
    }

    private static createMotorcycle(
        scene: THREE.Scene,
        world: CANNON.World,
        camera: THREE.PerspectiveCamera,
        position: CANNON.Vec3,
        sound: Sound,
        config: VehicleConfig
    ): Vehicle {
        // For now, return a regular vehicle but with motorcycle properties
        const vehicle = new Vehicle(scene, world, camera, position, sound);
        
        // Customize for motorcycle (would need special model)
        this.customizeVehicle(vehicle, config, {
            motorcycle: true,
            engineSound: 'bike'
        });
        
        return vehicle;
    }

    private static createPoliceCar(
        scene: THREE.Scene,
        world: CANNON.World,
        camera: THREE.PerspectiveCamera,
        position: CANNON.Vec3,
        sound: Sound,
        config: VehicleConfig
    ): Vehicle {
        const vehicle = new Vehicle(scene, world, camera, position, sound);
        
        // Customize for police car
        this.customizeVehicle(vehicle, config, {
            policeLights: true,
            siren: true,
            pushBar: true,
            engineSound: 'police'
        });
        
        return vehicle;
    }

    private static createAmbulance(
        scene: THREE.Scene,
        world: CANNON.World,
        camera: THREE.PerspectiveCamera,
        position: CANNON.Vec3,
        sound: Sound,
        config: VehicleConfig
    ): Vehicle {
        const vehicle = new Vehicle(scene, world, camera, position, sound);
        
        // Customize for ambulance
        this.customizeVehicle(vehicle, config, {
            medicalLights: true,
            siren: true,
            extendedBody: true,
            engineSound: 'ambulance'
        });
        
        return vehicle;
    }

    private static createSedan(
        scene: THREE.Scene,
        world: CANNON.World,
        camera: THREE.PerspectiveCamera,
        position: CANNON.Vec3,
        sound: Sound,
        config: VehicleConfig
    ): Vehicle {
        const vehicle = new Vehicle(scene, world, camera, position, sound);
        
        // Standard sedan - no special modifications
        this.customizeVehicle(vehicle, config, {});
        
        return vehicle;
    }

    private static customizeVehicle(
        vehicle: Vehicle,
        config: VehicleConfig,
        options: any
    ): void {
        // Update vehicle physics based on config
        const chassisBody = (vehicle as any).chassisBody;
        chassisBody.mass = config.mass;
        
        // Update vehicle appearance
        const chassisMesh = (vehicle as any).chassisMesh;
        chassisMesh.traverse((child: THREE.Mesh) => {
            if (child instanceof THREE.Mesh && child.material) {
                const material = child.material as THREE.MeshStandardMaterial;
                
                // Apply base color
                if (config.type !== VehicleType.POLICE && config.type !== VehicleType.AMBULANCE) {
                    material.color.setHex(config.color);
                }
                
                // Apply special modifications
                this.applyVehicleModifications(child, config.type, options);
            }
        });
        
        // Store vehicle config for reference
        (vehicle as any).config = config;
        (vehicle as any).options = options;
    }

    private static applyVehicleModifications(
        mesh: THREE.Mesh,
        type: VehicleType,
        options: any
    ): void {
        switch (type) {
            case VehicleType.POLICE:
                if (options.policeLights) {
                    this.addPoliceLights(mesh);
                }
                if (options.pushBar) {
                    this.addPushBar(mesh);
                }
                break;
            case VehicleType.SPORTS:
                if (options.spoiler) {
                    this.addSpoiler(mesh);
                }
                break;
            case VehicleType.AMBULANCE:
                if (options.medicalLights) {
                    this.addMedicalLights(mesh);
                }
                break;
        }
    }

    private static addPoliceLights(mesh: THREE.Mesh): void {
        // Add red and blue lights to police vehicle
        const lightGeometry = new THREE.BoxGeometry(0.1, 0.05, 0.1);
        const redLight = new THREE.Mesh(
            lightGeometry,
            new THREE.MeshStandardMaterial({
                color: 0xff0000,
                emissive: 0xff0000,
                emissiveIntensity: 2
            })
        );
        redLight.position.set(0.5, 0.3, 1);
        mesh.add(redLight);
        
        const blueLight = new THREE.Mesh(
            lightGeometry,
            new THREE.MeshStandardMaterial({
                color: 0x0000ff,
                emissive: 0x0000ff,
                emissiveIntensity: 2
            })
        );
        blueLight.position.set(-0.5, 0.3, 1);
        mesh.add(blueLight);
    }

    private static addPushBar(mesh: THREE.Mesh): void {
        // Add push bar to front of police vehicle
        const barGeometry = new THREE.BoxGeometry(2.2, 0.1, 0.1);
        const barMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            metalness: 0.8,
            roughness: 0.2
        });
        const pushBar = new THREE.Mesh(barGeometry, barMaterial);
        pushBar.position.set(0, 0.2, 1.1);
        mesh.add(pushBar);
    }

    private static addSpoiler(mesh: THREE.Mesh): void {
        // Add spoiler to sports car
        const spoilerGeometry = new THREE.BoxGeometry(1.6, 0.05, 0.2);
        const spoilerMaterial = new THREE.MeshStandardMaterial({
            color: 0x222222,
            metalness: 0.7,
            roughness: 0.3
        });
        const spoiler = new THREE.Mesh(spoilerGeometry, spoilerMaterial);
        spoiler.position.set(0, 0.4, -1.0);
        mesh.add(spoiler);
    }

    private static addMedicalLights(mesh: THREE.Mesh): void {
        // Add red cross lights to ambulance
        const lightGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.05);
        const crossMaterial = new THREE.MeshStandardMaterial({
            color: 0xff0000,
            emissive: 0xff0000,
            emissiveIntensity: 3
        });
        const crossLight = new THREE.Mesh(lightGeometry, crossMaterial);
        crossLight.position.set(0, 0.5, 1);
        mesh.add(crossLight);
    }

    static getVehicleConfig(type: VehicleType): VehicleConfig | undefined {
        return this.VEHICLE_CONFIGS.get(type);
    }

    static getAllVehicleTypes(): VehicleType[] {
        return Array.from(this.VEHICLE_CONFIGS.keys());
    }

    static getRandomVehicleType(): VehicleType {
        const types = this.getAllVehicleTypes();
        return types[Math.floor(Math.random() * types.length)];
    }
}
