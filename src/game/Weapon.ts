import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Input } from './Input';

export class Weapon {
    private scene: THREE.Scene;
    private world: CANNON.World;
    private camera: THREE.PerspectiveCamera;
    
    private mesh: THREE.Group;
    private ammo = 30;
    private maxAmmo = 30;
    private fireRate = 0.15; // Seconds between shots
    private lastFireTime = 0;
    private reloadTime = 2.0;
    private reloadTimer = 0;
    private isReloading = false;
    
    private damage = 25;
    private range = 100;
    private bulletSpeed = 50;
    
    private muzzleFlash: THREE.PointLight;
    private shootSound: (position: THREE.Vector3) => void;

    constructor(scene: THREE.Scene, world: CANNON.World, camera: THREE.PerspectiveCamera) {
        this.scene = scene;
        this.world = world;
        this.camera = camera;
        
        this.mesh = this.createWeaponModel();
        this.muzzleFlash = this.createMuzzleFlash();
        this.shootSound = this.createShootSound();
    }

    private createWeaponModel(): THREE.Group {
        const weapon = new THREE.Group();
        
        // Pistol body
        const bodyGeometry = new THREE.BoxGeometry(0.3, 0.15, 0.8);
        const bodyMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x2a2a2a, 
            metalness: 0.8, 
            roughness: 0.3 
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.z = -0.2;
        weapon.add(body);
        
        // Barrel
        const barrelGeometry = new THREE.CylinderGeometry(0.06, 0.06, 0.6, 8);
        const barrelMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x1a1a1a, 
            metalness: 0.9, 
            roughness: 0.2 
        });
        const barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.z = -0.4;
        weapon.add(barrel);
        
        // Grip
        const gripGeometry = new THREE.BoxGeometry(0.15, 0.25, 0.3);
        const gripMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x4a2c2a, // Brown grip
            roughness: 0.8 
        });
        const grip = new THREE.Mesh(gripGeometry, gripMaterial);
        grip.position.y = -0.1;
        grip.position.z = 0.1;
        weapon.add(grip);
        
        // Trigger guard
        const guardGeometry = new THREE.TorusGeometry(0.08, 0.02, 6, 8);
        const guardMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x1a1a1a, 
            metalness: 0.8, 
            roughness: 0.3 
        });
        const guard = new THREE.Mesh(guardGeometry, guardMaterial);
        guard.rotation.z = Math.PI / 2;
        guard.position.y = -0.05;
        guard.position.z = 0.1;
        weapon.add(guard);
        
        return weapon;
    }

    private createMuzzleFlash(): THREE.PointLight {
        const flash = new THREE.PointLight(0xffaa00, 0, 5);
        flash.position.z = -0.6;
        this.mesh.add(flash);
        return flash;
    }

    private createShootSound(): (position: THREE.Vector3) => void {
        return (position: THREE.Vector3) => {
            // Create a simple gunshot sound using Web Audio API
            try {
                const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.1);
                
                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
                
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.1);
            } catch (e) {
                // Audio not available
            }
        };
    }

    public update(dt: number, cameraPosition: THREE.Vector3, cameraQuaternion: THREE.Quaternion): boolean {
        // Handle reload
        if (this.isReloading) {
            this.reloadTimer -= dt;
            if (this.reloadTimer <= 0) {
                this.isReloading = false;
                this.ammo = this.maxAmmo;
            }
            return false;
        }

        // Handle shooting
        if (Input.isKeyDown('r') && this.ammo < this.maxAmmo) {
            this.startReload();
            return false;
        }

        if (Input.isKeyDown(' ') && !this.isReloading && this.ammo > 0) {
            const currentTime = performance.now() / 1000;
            if (currentTime - this.lastFireTime >= this.fireRate) {
                this.shoot(cameraPosition, cameraQuaternion);
                this.lastFireTime = currentTime;
                return true;
            }
        }

        return false;
    }

    private shoot(cameraPosition: THREE.Vector3, cameraQuaternion: THREE.Quaternion) {
        this.ammo--;
        
        // Visual effects
        this.muzzleFlash.intensity = 10;
        setTimeout(() => {
            this.muzzleFlash.intensity = 0;
        }, 50);
        
        // Sound
        this.shootSound(cameraPosition);
        
        // Create bullet raycast
        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyQuaternion(cameraQuaternion);
        
        const rayStart = cameraPosition.clone();
        const rayEnd = rayStart.clone().add(direction.multiplyScalar(this.range));
        
        // Physics raycast
        const result = new CANNON.RaycastResult();
        this.world.raycastClosest(
            new CANNON.Vec3(rayStart.x, rayStart.y, rayStart.z),
            new CANNON.Vec3(rayEnd.x, rayEnd.y, rayEnd.z),
            {},
            result
        );
        
        if (result.hasHit && result.body) {
            // Apply damage to hit target
            this.handleHit(result.body, result.hitPointWorld);
            
            // Visual impact effect
            this.createImpactEffect(new THREE.Vector3(
                result.hitPointWorld.x,
                result.hitPointWorld.y,
                result.hitPointWorld.z
            ));
        }
    }

    private handleHit(body: CANNON.Body, hitPoint: CANNON.Vec3) {
        // Apply impulse to hit object
        const impulse = new CANNON.Vec3(0, 0, -5);
        body.applyImpulse(impulse, hitPoint);
        
        // Store damage info on body for other systems to process
        body.velocity = body.velocity; // Trigger collision event
        (body as any).lastDamage = {
            damage: this.damage,
            hitPoint: hitPoint,
            time: Date.now()
        };
    }

    private createImpactEffect(position: THREE.Vector3) {
        // Create a simple impact particle effect
        const particleGeometry = new THREE.SphereGeometry(0.1, 4, 4);
        const particleMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xffaa00,
            transparent: true,
            opacity: 1
        });
        const particle = new THREE.Mesh(particleGeometry, particleMaterial);
        particle.position.copy(position);
        this.scene.add(particle);
        
        // Animate and remove particle
        let scale = 1;
        let opacity = 1;
        const animate = () => {
            scale += 0.1;
            opacity -= 0.05;
            
            particle.scale.setScalar(scale);
            (particle.material as THREE.MeshBasicMaterial).opacity = opacity;
            
            if (opacity > 0) {
                requestAnimationFrame(animate);
            } else {
                this.scene.remove(particle);
            }
        };
        animate();
    }

    private startReload() {
        this.isReloading = true;
        this.reloadTimer = this.reloadTime;
    }

    public getAmmo(): number { return this.ammo; }
    public getMaxAmmo(): number { return this.maxAmmo; }
    public isReloadingStatus(): boolean { return this.isReloading; }

    public setVisible(visible: boolean) {
        this.mesh.visible = visible;
    }

    public updatePosition(position: THREE.Vector3, quaternion: THREE.Quaternion) {
        this.mesh.position.copy(position);
        this.mesh.quaternion.copy(quaternion);
        
        // Offset weapon to right side of camera
        const offset = new THREE.Vector3(0.3, -0.2, -0.5);
        offset.applyQuaternion(quaternion);
        this.mesh.position.add(offset);
    }
}
