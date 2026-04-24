import * as THREE from 'three';

export class GameScene {
    private scene:    THREE.Scene;
    private camera:   THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;

    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);
        this.scene.fog = new THREE.Fog(0x87CEEB, 80, 280);

        this.camera = new THREE.PerspectiveCamera(
            68, window.innerWidth / window.innerHeight, 0.5, 400
        );
        this.camera.position.set(0, 6, 10);

        this.renderer = new THREE.WebGLRenderer({
            antialias: false,
            powerPreference: 'high-performance',
            stencil: false,
            depth: true,
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(1); // always 1 — biggest single perf win on high-DPI screens
        this.renderer.toneMapping = THREE.NoToneMapping;
        this.renderer.shadowMap.enabled = false; // disabled — ambient+directional is enough
        this.renderer.sortObjects = false; // skip sort — all opaque except glass (minor win)

        const canvas = this.renderer.domElement;
        canvas.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:0';
        document.body.appendChild(canvas);

        // Lighting: bright ambient + one directional, NO shadows
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.9));
        const sun = new THREE.DirectionalLight(0xfffbe8, 0.8);
        sun.position.set(60, 120, 60);
        sun.castShadow = false;
        this.scene.add(sun);

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    public getScene()  { return this.scene; }
    public getCamera() { return this.camera; }
    public render()    { this.renderer.render(this.scene, this.camera); }
}
