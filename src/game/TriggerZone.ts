import * as THREE from 'three';

/**
 * TriggerZone — A 3D area that detects when the player enters.
 * Used for starting missions, checkpoints, and shops.
 */
export class TriggerZone {
    private mesh: THREE.Mesh;
    private radius: number;
    public onEnter: () => void;
    private wasInside = false;

    constructor(scene: THREE.Scene, position: THREE.Vector3, radius: number, color: number = 0xffff00) {
        this.radius = radius;
        
        const geo = new THREE.CylinderGeometry(radius, radius, 0.1, 16);
        const mat = new THREE.MeshBasicMaterial({ 
            color: color, 
            transparent: true, 
            opacity: 0.3,
            side: THREE.DoubleSide
        });
        
        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.position.copy(position);
        scene.add(this.mesh);

        // Add a floating marker
        const markerGeo = new THREE.TorusGeometry(0.5, 0.1, 8, 24);
        const marker = new THREE.Mesh(markerGeo, mat);
        marker.position.set(0, 2, 0);
        marker.rotation.x = Math.PI / 2;
        this.mesh.add(marker);
    }

    public update(playerPos: THREE.Vector3) {
        this.mesh.rotation.y += 0.02;
        
        const dist = playerPos.distanceTo(this.mesh.position);
        const isInside = dist < this.radius;

        if (isInside && !this.wasInside) {
            if (this.onEnter) this.onEnter();
        }
        
        this.wasInside = isInside;
    }

    public setVisible(v: boolean) {
        this.mesh.visible = v;
    }
}
