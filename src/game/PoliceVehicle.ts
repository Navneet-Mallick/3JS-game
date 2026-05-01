import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Vehicle } from './Vehicle';
import { Sound } from './Sound';

export class PoliceVehicle extends Vehicle {
    private sirenFlash = 0;
    private sirenLights: THREE.Mesh[] = [];

    constructor(
        scene: THREE.Scene,
        world: CANNON.World,
        camera: THREE.PerspectiveCamera,
        position: CANNON.Vec3,
        sound: Sound
    ) {
        super(scene, world, camera, position, sound);
        this.addSirens();
    }

    private addSirens() {
        const geo = new THREE.BoxGeometry(0.4, 0.15, 0.8);
        const matR = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const matB = new THREE.MeshBasicMaterial({ color: 0x0000ff });
        
        const lightR = new THREE.Mesh(geo, matR);
        const lightB = new THREE.Mesh(geo, matB);
        
        lightR.position.set(-0.4, 0.8, 0.2);
        lightB.position.set(0.4, 0.8, 0.2);
        
        this.chassisMesh.add(lightR, lightB);
        this.sirenLights = [lightR, lightB];
    }

    public update(dt: number) {
        super.update(dt);
        
        if (this.isOccupied) {
            this.sirenFlash += dt * 8;
            const on = Math.sin(this.sirenFlash) > 0;
            (this.sirenLights[0].material as THREE.MeshBasicMaterial).color.setHex(on ? 0xff0000 : 0x220000);
            (this.sirenLights[1].material as THREE.MeshBasicMaterial).color.setHex(on ? 0x220022 : 0x0000ff);
        }
    }
}
