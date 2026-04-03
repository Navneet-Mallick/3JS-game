import * as THREE from 'three';
import { EffectComposer, RenderPass, UnrealBloomPass } from 'three-stdlib';

export class GameScene {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private composer: EffectComposer;

    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x05050f);
        this.scene.fog = new THREE.FogExp2(0x05050f, 0.004);

        this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 800);
        this.camera.position.set(0, 8, 12);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.4;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFShadowMap;

        const canvas = this.renderer.domElement;
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100vw';
        canvas.style.height = '100vh';
        canvas.style.zIndex = '0';
        document.body.appendChild(canvas);

        // Ambient — dark night
        const ambient = new THREE.AmbientLight(0x111133, 2.5);
        this.scene.add(ambient);

        // Moon-like directional
        const moon = new THREE.DirectionalLight(0x8899ff, 2.0);
        moon.position.set(-50, 120, -80);
        moon.castShadow = true;
        moon.shadow.mapSize.set(2048, 2048);
        moon.shadow.camera.near = 1;
        moon.shadow.camera.far = 400;
        moon.shadow.camera.left = -150;
        moon.shadow.camera.right = 150;
        moon.shadow.camera.top = 150;
        moon.shadow.camera.bottom = -150;
        moon.shadow.bias = -0.001;
        this.scene.add(moon);

        // Post-processing
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));

        const bloom = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.8, 0.3, 0.9
        );
        this.composer.addPass(bloom);

        window.addEventListener('resize', () => this.onWindowResize());
    }

    private onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.composer.setSize(window.innerWidth, window.innerHeight);
    }

    public getScene() { return this.scene; }
    public getCamera() { return this.camera; }

    public render() {
        this.composer.render();
    }
}
