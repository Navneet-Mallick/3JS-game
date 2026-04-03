import * as CANNON from 'cannon-es';

export class Physics {
    private world: CANNON.World;

    constructor() {
        this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -25, 0) });
        this.world.broadphase = new CANNON.SAPBroadphase(this.world);
        this.world.allowSleep = true;

        const groundMat = new CANNON.Material('ground');
        const wheelMat = new CANNON.Material('wheel');
        const playerMat = new CANNON.Material('player');

        this.world.addContactMaterial(new CANNON.ContactMaterial(groundMat, wheelMat, {
            friction: 0.8,
            restitution: 0.0,
        }));
        this.world.addContactMaterial(new CANNON.ContactMaterial(groundMat, playerMat, {
            friction: 0.4,
            restitution: 0.0,
        }));
    }

    public update(deltaTime: number) {
        this.world.step(1 / 60, deltaTime, 3);
    }

    public getWorld() { return this.world; }
}
