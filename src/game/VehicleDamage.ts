import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class VehicleDamage {
    public health = 100;
    public maxHealth = 100;
    private damageMeshes: THREE.Mesh[] = [];
    private originalMaterials: THREE.Material[] = [];
    private damagedParts: Map<string, number> = new Map();
    
    // Damage thresholds
    private readonly LIGHT_DAMAGE: number = 30;
    private readonly MEDIUM_DAMAGE: number = 60;
    private readonly HEAVY_DAMAGE: number = 85;
    private readonly CRITICAL_DAMAGE: number = 95;

    private vehicleMesh: THREE.Group;
    private vehicleBody: CANNON.Body;

    constructor(vehicleMesh: THREE.Group, vehicleBody: CANNON.Body) {
        this.vehicleMesh = vehicleMesh;
        this.vehicleBody = vehicleBody;
        this.setupDamageZones();
    }

    private setupDamageZones() {
        // Create damage zones for different parts of the vehicle
        this.vehicleMesh.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                // Store original material
                this.originalMaterials.push(child.material.clone());
                this.damageMeshes.push(child);
                
                // Initialize damage tracking for this part
                this.damagedParts.set(child.uuid, 0);
            }
        });
    }

    public applyDamage(damage: number, impactPoint?: THREE.Vector3, impactForce?: number): boolean {
        this.health = Math.max(0, this.health - damage);
        
        // Apply visual damage based on damage level
        this.updateVisualDamage();
        
        // Apply physics effects
        this.applyPhysicsEffects(impactForce || 10);
        
        // Check if vehicle is destroyed
        if (this.health <= 0) {
            this.destroyVehicle();
            return true; // Vehicle destroyed
        }
        
        return false; // Vehicle still functional
    }

    private updateVisualDamage() {
        const damagePercent = (this.maxHealth - this.health) / this.maxHealth;
        
        this.damageMeshes.forEach((mesh, index) => {
            const material = mesh.material as THREE.MeshStandardMaterial;
            
            if (damagePercent > 0.9) {
                // Critical damage - black, burnt appearance
                material.color.setHex(0x1a1a1a);
                material.metalness = 0.1;
                material.roughness = 0.9;
                this.addDeformation(mesh, 0.3);
            } else if (damagePercent > 0.6) {
                // Heavy damage - dark gray, rust
                material.color.setHex(0x3a3a3a);
                material.metalness = 0.3;
                material.roughness = 0.8;
                this.addDeformation(mesh, 0.2);
            } else if (damagePercent > 0.3) {
                // Medium damage - scratches, dents
                material.color.setHex(0x5a5a5a);
                material.metalness = 0.5;
                material.roughness = 0.6;
                this.addDeformation(mesh, 0.1);
            } else if (damagePercent > 0.1) {
                // Light damage - minor scratches
                material.color.setHex(0x7a7a7a);
                material.roughness = 0.5;
            }
            
            // Add damage effects
            if (damagePercent > 0.3) {
                this.addDamageEffects(mesh, damagePercent);
            }
        });
    }

    private addDeformation(mesh: THREE.Mesh, intensity: number) {
        const geometry = mesh.geometry;
        if (geometry instanceof THREE.BufferGeometry) {
            const positions = geometry.attributes.position;
            if (positions) {
                const positionArray = positions.array as Float32Array;
                
                for (let i = 0; i < positionArray.length; i += 3) {
                    // Random deformation
                    const randomFactor = (Math.random() - 0.5) * intensity * 0.1;
                    positionArray[i] += randomFactor;
                    positionArray[i + 1] += randomFactor;
                    positionArray[i + 2] += randomFactor;
                }
                
                positions.needsUpdate = true;
                geometry.computeVertexNormals();
            }
        }
    }

    private addDamageEffects(mesh: THREE.Mesh, damagePercent: number) {
        // Add emission for damaged parts (like sparks or heat glow)
        const material = mesh.material as THREE.MeshStandardMaterial;
        if (damagePercent > 0.6) {
            material.emissive = new THREE.Color(0xff4400);
            material.emissiveIntensity = damagePercent * 0.3;
        }
    }

    private applyPhysicsEffects(impactForce: number) {
        // Reduce engine performance based on damage
        const damagePercent = (this.maxHealth - this.health) / this.maxHealth;
        
        // Store damage info on vehicle body for other systems to use
        (this.vehicleBody as any).damageMultiplier = 1 - (damagePercent * 0.7); // Up to 70% performance reduction
        
        // Add instability at high damage
        if (damagePercent > 0.7) {
            const wobble = (Math.random() - 0.5) * damagePercent * 0.1;
            this.vehicleBody.angularVelocity.x += wobble;
            this.vehicleBody.angularVelocity.z += wobble;
        }
    }

    private destroyVehicle() {
        // Create explosion effect
        this.createExplosion();
        
        // Make vehicle inoperable
        (this.vehicleBody as any).destroyed = true;
        
        // Apply final destruction visuals
        this.damageMeshes.forEach(mesh => {
            const material = mesh.material as THREE.MeshStandardMaterial;
            material.color.setHex(0x0a0a0a);
            material.metalness = 0;
            material.roughness = 1;
            material.emissive = new THREE.Color(0xff0000);
            material.emissiveIntensity = 0.5;
        });
    }

    private createExplosion() {
        // Create multiple particle effects for explosion
        for (let i = 0; i < 20; i++) {
            const particleGeometry = new THREE.SphereGeometry(Math.random() * 0.5 + 0.2, 4, 4);
            const particleMaterial = new THREE.MeshBasicMaterial({
                color: new THREE.Color().setHSL(Math.random() * 0.1, 1, 0.5), // Orange to red
                transparent: true,
                opacity: 1
            });
            
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);
            particle.position.copy(this.vehicleMesh.position);
            
            // Random explosion direction
            const direction = new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                Math.random() * 2,
                (Math.random() - 0.5) * 2
            ).normalize();
            
            particle.userData = {
                velocity: direction.multiplyScalar(Math.random() * 20 + 10),
                life: 2.0
            };
            
            this.vehicleMesh.parent?.add(particle);
        }
    }

    public getDamageLevel(): 'none' | 'light' | 'medium' | 'heavy' | 'critical' | 'destroyed' {
        const damagePercent = (this.maxHealth - this.health) / this.maxHealth;
        
        if (this.health <= 0) return 'destroyed';
        if (damagePercent > this.CRITICAL_DAMAGE / 100) return 'critical';
        if (damagePercent > this.HEAVY_DAMAGE / 100) return 'heavy';
        if (damagePercent > this.MEDIUM_DAMAGE / 100) return 'medium';
        if (damagePercent > this.LIGHT_DAMAGE / 100) return 'light';
        return 'none';
    }

    public repair(amount: number): void {
        this.health = Math.min(this.maxHealth, this.health + amount);
        this.updateVisualDamage();
        
        // Remove destroyed status if repaired enough
        if (this.health > 20) {
            (this.vehicleBody as any).destroyed = false;
        }
    }

    public getHealthPercent(): number {
        return (this.health / this.maxHealth) * 100;
    }

    public updateExplosionParticles(dt: number): void {
        // Update explosion particles if any exist
        const particles: THREE.Mesh[] = [];
        
        this.vehicleMesh.parent?.traverse((child) => {
            if (child instanceof THREE.Mesh && child.userData.velocity) {
                particles.push(child);
            }
        });
        
        particles.forEach(particle => {
            const userData = particle.userData;
            userData.life -= dt;
            
            if (userData.life <= 0) {
                this.vehicleMesh.parent?.remove(particle);
            } else {
                // Update particle position
                const pos = particle.position;
                pos.x += userData.velocity.x * dt;
                pos.y += userData.velocity.y * dt;
                pos.z += userData.velocity.z * dt;
                
                // Apply gravity
                userData.velocity.y -= 9.8 * dt;
                
                // Fade out
                (particle.material as THREE.MeshBasicMaterial).opacity = userData.life / 2.0;
            }
        });
    }
}
