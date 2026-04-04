import * as THREE from 'three';

export class GameScene {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;

    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);
        // Lighter fog — less draw-call pressure, still gives depth
        this.scene.fog = new THREE.Fog(0x87CEEB, 80, 300);

        this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 500);
        this.camera.position.set(0, 6, 10);

        this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        // Cap at 1x pixel ratio for performance — looks fine on most screens
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
        this.renderer.toneMapping = THREE.LinearToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.BasicShadowMap; // cheapest shadow type

        const canvas = this.renderer.domElement;
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100vw';
        canvas.style.height = '100vh';
        canvas.style.zIndex = '0';
        document.body.appendChild(canvas);

        // Bright ambient — reduces need for many shadow-casting lights
        const ambient = new THREE.AmbientLight(0xffffff, 1.0);
        this.scene.add(ambient);

        // Single directional sun — reduced shadow map size
        const sun = new THREE.DirectionalLight(0xfffbe8, 1.0);
        sun.position.set(50, 100, 50);
        sun.castShadow = true;
        sun.shadow.mapSize.set(1024, 1024); // was 2048 — halved for perf
        sun.shadow.camera.near = 1;
        sun.shadow.camera.far  = 300;
        sun.shadow.camera.left   = -120;
        sun.shadow.camera.right  =  120;
        sun.shadow.camera.top    =  120;
        sun.shadow.camera.bottom = -120;
        sun.shadow.bias = -0.001;
        this.scene.add(sun);

        window.addEventListener('resize', () => this.onWindowResize());
    }

    private onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    public getScene()  { return this.scene; }
    public getCamera() { return this.camera; }

    public render() {
        this.renderer.render(this.scene, this.camera);
    }
}
