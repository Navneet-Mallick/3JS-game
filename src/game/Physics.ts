import * as CANNON from 'cannon-es';

export class Physics {
    private world: CANNON.World;

    public groundMaterial: CANNON.Material;
    public wheelMaterial: CANNON.Material;
    public playerMaterial: CANNON.Material;

    constructor() {
        this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -22, 0) });
        this.world.broadphase = new CANNON.SAPBroadphase(this.world);
        this.world.allowSleep = true;

        this.groundMaterial = new CANNON.Material('ground');
        this.wheelMaterial  = new CANNON.Material('wheel');
        this.playerMaterial = new CANNON.Material('player');

        // Wheel ↔ Ground: good grip, zero bounce
        this.world.addContactMaterial(new CANNON.ContactMaterial(
            this.groundMaterial, this.wheelMaterial,
            { friction: 0.6, restitution: 0.0 }
        ));

        // Player ↔ Ground: smooth sliding, no bounce
        this.world.addContactMaterial(new CANNON.ContactMaterial(
            this.groundMaterial, this.playerMaterial,
            { friction: 0.3, restitution: 0.0 }
        ));

        // Vehicle chassis ↔ Ground (for side scrapes)
        this.world.addContactMaterial(new CANNON.ContactMaterial(
            this.groundMaterial, this.groundMaterial,
            { friction: 0.4, restitution: 0.0 }
        ));
    }

    public update(deltaTime: number) {
        this.world.step(1 / 60, deltaTime, 3);
    }

    public getWorld() { return this.world; }
}
