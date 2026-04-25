import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class AssetManager {
    private loader: GLTFLoader;
    public models: Map<string, THREE.Group> = new Map();
    private loadingManager: THREE.LoadingManager;

    constructor() {
        this.loadingManager = new THREE.LoadingManager();
        this.loader = new GLTFLoader(this.loadingManager);
        
        // Setup loading UI updates if needed
        this.loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
            const bar = document.getElementById('loader-bar');
            if (bar) {
                bar.style.width = `${(itemsLoaded / itemsTotal) * 100}%`;
            }
        };
    }

    public async loadAll(): Promise<void> {
        // List of models to load in the future. 
        // Currently, these files don't exist, so we will catch errors and continue.
        const assets = [
            { id: 'player', url: '/models/player.glb' },
            { id: 'car', url: '/models/car.glb' },
            { id: 'police', url: '/models/police.glb' },
            { id: 'bike', url: '/models/bike.glb' },
            { id: 'pedestrian', url: '/models/pedestrian.glb' }
        ];

        const loadPromises = assets.map(asset => {
            return new Promise<void>((resolve) => {
                this.loader.load(
                    asset.url,
                    (gltf) => {
                        this.models.set(asset.id, gltf.scene);
                        // Optional: Traverse and enable shadows
                        gltf.scene.traverse((child) => {
                            if (child instanceof THREE.Mesh) {
                                child.castShadow = true;
                                child.receiveShadow = true;
                            }
                        });
                        resolve();
                    },
                    undefined,
                    (error) => {
                        // Suppress error in console, just resolve. 
                        // The game will gracefully fallback to primitive meshes.
                        // console.warn(`Model ${asset.url} not found. Using primitives.`);
                        resolve();
                    }
                );
            });
        });

        await Promise.all(loadPromises);
    }

    public getModel(id: string): THREE.Group | null {
        const model = this.models.get(id);
        if (model) {
            return model.clone(); // Return a clone so multiple instances can be spawned
        }
        return null;
    }
}
