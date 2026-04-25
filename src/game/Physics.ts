import * as CANNON from 'cannon-es';

export class Physics {
    private world: CANNON.World;

    public groundMaterial: CANNON.Material;
    public wheelMaterial:  CANNON.Material;
    public playerMaterial: CANNON.Material;

    constructor() {
        this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -15, 0) });
        // FIX: SAPBroadphase silently stops detecting collisions at large world coordinates
        // (~±200 units) which causes vehicles and the player to fall through the ground.
        // NaiveBroadphase is O(n²) but 100% reliable at any coordinate scale.
        // With < 100 physics bodies in this scene it is still fast enough.
        this.world.broadphase = new CANNON.NaiveBroadphase();
        this.world.allowSleep = false; // FIX: prevent bodies sleeping mid-game causing freeze

        this.groundMaterial = new CANNON.Material('ground');
        this.wheelMaterial  = new CANNON.Material('wheel');
        this.playerMaterial = new CANNON.Material('player');

        // Wheel ↔ Ground — good grip, zero bounce
        this.world.addContactMaterial(new CANNON.ContactMaterial(
            this.groundMaterial, this.wheelMaterial,
            { friction: 0.7, restitution: 0.0 }
        ));

        // Player ↔ Ground — smooth, no bounce
        this.world.addContactMaterial(new CANNON.ContactMaterial(
            this.groundMaterial, this.playerMaterial,
            { friction: 0.4, restitution: 0.0 }
        ));

        // Default (chassis vs ground, etc.)
        this.world.addContactMaterial(new CANNON.ContactMaterial(
            this.groundMaterial, this.groundMaterial,
            { friction: 0.5, restitution: 0.0 }
        ));
    }

    public update(dt: number) {
        // Higher frequency (1/120) and more substeps (10) for "car game" smoothness
        this.world.step(1 / 120, dt, 10);
    }

    public getWorld() { return this.world; }
}
