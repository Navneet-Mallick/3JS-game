import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Vehicle } from './Vehicle';
import { Sound } from './Sound';

export class EnhancedPoliceAI {
    private vehicle: Vehicle;
    private targetPlayer: THREE.Vector3;
    private currentState: 'patrol' | 'pursuit' | 'roadblock' | 'helicopter' | 'swat';
    private tactics: PoliceTactics;
    private aggression: number;
    private intelligence: number;
    private coordination: number;
    
    // AI behavior parameters
    private pursuitDistance: number = 50;
    private roadblockDistance: number = 30;
    private escapeTimer: number = 0;
    private lastKnownPlayerPosition: THREE.Vector3;
    private searchPattern: SearchPattern;
    
    // Radio communication
    private lastRadioCall: number = 0;
    private backupRequested: boolean = false;
    private helicopterRequested: boolean = false;
    private swatRequested: boolean = false;

    constructor(vehicle: Vehicle, wantedLevel: number) {
        this.vehicle = vehicle;
        this.targetPlayer = new THREE.Vector3();
        this.lastKnownPlayerPosition = new THREE.Vector3();
        
        this.tactics = new PoliceTactics();
        this.aggression = Math.min(1.0, wantedLevel * 0.2);
        this.intelligence = Math.min(1.0, wantedLevel * 0.15);
        this.coordination = Math.min(1.0, wantedLevel * 0.25);
        
        this.searchPattern = new SearchPattern();
        this.currentState = 'patrol';
    }

    public update(
        dt: number,
        playerPosition: THREE.Vector3,
        playerVelocity: THREE.Vector3,
        wantedLevel: number,
        otherPolice: EnhancedPoliceAI[]
    ): void {
        this.targetPlayer = playerPosition;
        
        // Update AI state based on wanted level
        this.updateAIState(wantedLevel);
        
        // Execute current AI behavior
        switch (this.currentState) {
            case 'patrol':
                this.executePatrol(dt, playerPosition);
                break;
            case 'pursuit':
                this.executePursuit(dt, playerPosition, playerVelocity, otherPolice);
                break;
            case 'roadblock':
                this.executeRoadblock(dt, playerPosition, otherPolice);
                break;
            case 'helicopter':
                this.executeHelicopterSupport(dt, playerPosition);
                break;
            case 'swat':
                this.executeSwatTactics(dt, playerPosition, otherPolice);
                break;
        }
        
        // Update coordination with other police
        this.updateCoordination(otherPolice, dt);
        
        // Radio communication
        this.updateRadioCommunication(wantedLevel);
    }

    private updateAIState(wantedLevel: number): void {
        const distance = this.vehicle.getPosition().distanceTo(this.targetPlayer);
        
        // State transitions based on wanted level and distance
        if (wantedLevel >= 5 && !this.swatRequested) {
            this.currentState = 'swat';
            this.swatRequested = true;
        } else if (wantedLevel >= 3 && distance < 100 && !this.helicopterRequested) {
            this.currentState = 'helicopter';
            this.helicopterRequested = true;
        } else if (wantedLevel >= 2 && distance < this.roadblockDistance) {
            this.currentState = 'roadblock';
        } else if (wantedLevel >= 1 && distance < this.pursuitDistance) {
            this.currentState = 'pursuit';
        } else {
            this.currentState = 'patrol';
        }
    }

    private executePatrol(dt: number, playerPosition: THREE.Vector3): void {
        // Random patrol behavior
        const patrolSpeed = 15; // km/h
        const currentSpeed = this.vehicle.getSpeedKmh();
        
        if (currentSpeed < patrolSpeed) {
            // Accelerate
            this.applyThrottle(0.3);
        }
        
        // Random steering for patrol
        if (Math.random() < 0.02) {
            const randomSteer = (Math.random() - 0.5) * 0.3;
            this.applySteering(randomSteer);
        }
        
        // Check for player
        const distance = this.vehicle.getPosition().distanceTo(playerPosition);
        if (distance < this.pursuitDistance) {
            this.lastKnownPlayerPosition.copy(playerPosition);
            this.currentState = 'pursuit';
        }
    }

    private executePursuit(
        dt: number,
        playerPosition: THREE.Vector3,
        playerVelocity: THREE.Vector3,
        otherPolice: EnhancedPoliceAI[]
    ): void {
        // Intelligent pursuit behavior
        const distance = this.vehicle.getPosition().distanceTo(playerPosition);
        const playerSpeed = playerVelocity.length() * 3.6; // Convert to km/h
        const currentSpeed = this.vehicle.getSpeedKmh();
        
        // Predict player movement
        const predictedPosition = this.tactics.predictPlayerPosition(
            playerPosition,
            playerVelocity,
            distance / currentSpeed
        );
        
        // Calculate optimal pursuit angle
        const pursuitAngle = this.tactics.calculatePursuitAngle(
            this.vehicle.getPosition(),
            playerPosition,
            predictedPosition
        );
        
        // Apply pursuit tactics
        if (distance > 20) {
            // Close distance - full throttle
            this.applyThrottle(this.aggression);
            this.applySteering(pursuitAngle);
        } else if (distance > 10) {
            // Medium distance - strategic positioning
            this.applyThrottle(this.aggression * 0.8);
            this.applySteering(pursuitAngle * 0.7);
            
            // Try to intercept
            const interceptAngle = this.tactics.calculateInterceptAngle(
                this.vehicle.getPosition(),
                playerPosition,
                playerVelocity
            );
            this.applySteering(interceptAngle);
        } else {
            // Close range - ramming tactics
            this.applyThrottle(this.aggression * 1.2);
            this.applySteering(pursuitAngle);
            
            // Attempt PIT maneuver
            if (currentSpeed > 40 && Math.random() < 0.1) {
                this.executePITManeuver(playerPosition);
            }
        }
        
        // Coordinate with other police
        if (this.coordination > 0.5) {
            this.coordinatePursuit(otherPolice, playerPosition);
        }
        
        // Update last known position
        this.lastKnownPlayerPosition.copy(playerPosition);
        this.escapeTimer = 0;
    }

    private executeRoadblock(
        dt: number,
        playerPosition: THREE.Vector3,
        otherPolice: EnhancedPoliceAI[]
    ): void {
        // Position for roadblock
        const roadblockPosition = this.calculateRoadblockPosition(playerPosition, otherPolice);
        const distance = this.vehicle.getPosition().distanceTo(roadblockPosition);
        
        if (distance > 5) {
            // Move to roadblock position
            const direction = roadblockPosition.clone().sub(this.vehicle.getPosition()).normalize();
            const angle = Math.atan2(direction.x, direction.z);
            this.applySteering(angle);
            this.applyThrottle(0.5);
        } else {
            // Hold position
            this.applyThrottle(0);
            this.applyBrake(1.0);
            
            // Turn on emergency lights
            this.activateEmergencyLights();
        }
    }

    private executeHelicopterSupport(dt: number, playerPosition: THREE.Vector3): void {
        // Helicopter provides air support
        const helicopterHeight = 50;
        const helicopterPosition = new THREE.Vector3(
            playerPosition.x + Math.sin(Date.now() * 0.001) * 100,
            helicopterHeight,
            playerPosition.z + Math.cos(Date.now() * 0.001) * 100
        );
        
        // Spotlight on player
        this.executeSpotlight(helicopterPosition, playerPosition);
        
        // Radio updates
        if (Date.now() - this.lastRadioCall > 5000) {
            this.makeRadioCall('Air support monitoring suspect');
            this.lastRadioCall = Date.now();
        }
    }

    private executeSwatTactics(
        dt: number,
        playerPosition: THREE.Vector3,
        otherPolice: EnhancedPoliceAI[]
    ): void {
        // SWAT tactics - surround and contain
        const surroundPositions = this.tactics.calculateSurroundPositions(
            playerPosition,
            otherPolice.length + 1
        );
        
        const myPosition = surroundPositions[this.getPoliceIndex(otherPolice)];
        const distance = this.vehicle.getPosition().distanceTo(myPosition);
        
        if (distance > 3) {
            // Move to surround position
            const direction = myPosition.clone().sub(this.vehicle.getPosition()).normalize();
            const angle = Math.atan2(direction.x, direction.z);
            this.applySteering(angle);
            this.applyThrottle(0.3);
        } else {
            // Hold position
            this.applyThrottle(0);
            this.applyBrake(1.0);
        }
        
        // Request backup
        if (!this.backupRequested) {
            this.requestBackup();
            this.backupRequested = true;
        }
    }

    private applyThrottle(amount: number): void {
        // Apply throttle to vehicle
        const maxForce = 8000 * amount;
        (this.vehicle as any).vehicle.applyEngineForce(maxForce, 2);
        (this.vehicle as any).vehicle.applyEngineForce(maxForce, 3);
    }

    private applySteering(angle: number): void {
        // Apply steering to vehicle
        (this.vehicle as any).vehicle.setSteeringValue(angle, 0);
        (this.vehicle as any).vehicle.setSteeringValue(angle, 1);
    }

    private applyBrake(amount: number): void {
        // Apply brake to vehicle
        for (let i = 0; i < 4; i++) {
            (this.vehicle as any).vehicle.setBrake(amount * 100, i);
        }
    }

    private executePITManeuver(playerPosition: THREE.Vector3): void {
        // PIT maneuver - spin out target vehicle
        const relativePosition = playerPosition.clone().sub(this.vehicle.getPosition());
        const angle = Math.atan2(relativePosition.x, relativePosition.z);
        
        // Quick steering change for PIT
        this.applySteering(angle + Math.PI / 4);
        setTimeout(() => {
            this.applySteering(angle - Math.PI / 4);
        }, 200);
    }

    private calculateRoadblockPosition(
        playerPosition: THREE.Vector3,
        otherPolice: EnhancedPoliceAI[]
    ): THREE.Vector3 {
        // Calculate optimal roadblock position
        const playerVelocity = new THREE.Vector3();
        const predictedPosition = playerPosition.clone().add(
            playerVelocity.multiplyScalar(2) // 2 seconds ahead
        );
        
        // Find best position to block
        const positions = [];
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
            const pos = new THREE.Vector3(
                predictedPosition.x + Math.cos(angle) * 20,
                predictedPosition.y,
                predictedPosition.z + Math.sin(angle) * 20
            );
            positions.push(pos);
        }
        
        // Choose position not occupied by other police
        for (const pos of positions) {
            let occupied = false;
            for (const police of otherPolice) {
                if (police.vehicle.getPosition().distanceTo(pos) < 5) {
                    occupied = true;
                    break;
                }
            }
            if (!occupied) {
                return pos;
            }
        }
        
        return positions[0];
    }

    private coordinatePursuit(otherPolice: EnhancedPoliceAI[], playerPosition: THREE.Vector3): void {
        // Share information with other police
        if (Date.now() - this.lastRadioCall > 3000) {
            this.makeRadioCall(`Target sighted at ${playerPosition.x.toFixed(0)}, ${playerPosition.z.toFixed(0)}`);
            this.lastRadioCall = Date.now();
        }
    }

    private updateCoordination(otherPolice: EnhancedPoliceAI[], dt: number): void {
        // Update coordination with other police units
        for (const police of otherPolice) {
            if (police !== this) {
                const distance = this.vehicle.getPosition().distanceTo(police.vehicle.getPosition());
                
                // Avoid collisions with other police
                if (distance < 10) {
                    const avoidDirection = this.vehicle.getPosition().clone().sub(police.vehicle.getPosition()).normalize();
                    const avoidAngle = Math.atan2(avoidDirection.x, avoidDirection.z);
                    this.applySteering(avoidAngle * 0.3);
                }
            }
        }
    }

    private updateRadioCommunication(wantedLevel: number): void {
        // Radio communication based on situation
        if (this.currentState === 'pursuit' && wantedLevel >= 2) {
            if (Date.now() - this.lastRadioCall > 8000) {
                this.makeRadioCall('In pursuit, requesting backup');
                this.lastRadioCall = Date.now();
            }
        }
    }

    private makeRadioCall(message: string): void {
        // Radio communication (would play audio in full game)
        console.log(`[POLICE RADIO] ${message}`);
    }

    private activateEmergencyLights(): void {
        // Activate emergency lights (visual effect)
        // This would trigger siren and light animations
    }

    private executeSpotlight(helicopterPosition: THREE.Vector3, targetPosition: THREE.Vector3): void {
        // Helicopter spotlight effect
        // This would create a cone of light from helicopter to ground
    }

    private getPoliceIndex(otherPolice: EnhancedPoliceAI[]): number {
        // Get this police unit's index in the array
        for (let i = 0; i < otherPolice.length; i++) {
            if (otherPolice[i] === this) {
                return i;
            }
        }
        return 0;
    }

    private requestBackup(): void {
        // Request additional units
        this.makeRadioCall('Requesting immediate backup - suspect is armed and dangerous');
    }

    public getCurrentState(): string {
        return this.currentState;
    }

    public getAggression(): number {
        return this.aggression;
    }

    public getIntelligence(): number {
        return this.intelligence;
    }

    public getCoordination(): number {
        return this.coordination;
    }
}

class PoliceTactics {
    // Advanced police tactics calculations
    
    public predictPlayerPosition(
        currentPosition: THREE.Vector3,
        currentVelocity: THREE.Vector3,
        timeToIntercept: number
    ): THREE.Vector3 {
        // Predict where player will be
        return currentPosition.clone().add(currentVelocity.clone().multiplyScalar(timeToIntercept));
    }

    public calculatePursuitAngle(
        policePosition: THREE.Vector3,
        playerPosition: THREE.Vector3,
        predictedPosition: THREE.Vector3
    ): number {
        // Calculate optimal pursuit angle
        const toPlayer = playerPosition.clone().sub(policePosition).normalize();
        const toPredicted = predictedPosition.clone().sub(policePosition).normalize();
        
        // Blend between current and predicted position
        const blend = 0.7;
        const targetDirection = toPlayer.clone().multiplyScalar(1 - blend).add(toPredicted.multiplyScalar(blend));
        
        return Math.atan2(targetDirection.x, targetDirection.z);
    }

    public calculateInterceptAngle(
        policePosition: THREE.Vector3,
        playerPosition: THREE.Vector3,
        playerVelocity: THREE.Vector3
    ): number {
        // Calculate intercept angle for ramming
        const relativePosition = playerPosition.clone().sub(policePosition);
        const relativeVelocity = playerVelocity.clone();
        
        const timeToIntercept = relativePosition.length() / Math.max(relativeVelocity.length(), 1);
        const interceptPosition = playerPosition.clone().add(relativeVelocity.clone().multiplyScalar(timeToIntercept));
        
        const toIntercept = interceptPosition.clone().sub(policePosition).normalize();
        return Math.atan2(toIntercept.x, toIntercept.z);
    }

    public calculateSurroundPositions(target: THREE.Vector3, numPolice: number): THREE.Vector3[] {
        // Calculate positions to surround target
        const positions = [];
        const radius = 20;
        
        for (let i = 0; i < numPolice; i++) {
            const angle = (i / numPolice) * Math.PI * 2;
            const position = new THREE.Vector3(
                target.x + Math.cos(angle) * radius,
                target.y,
                target.z + Math.sin(angle) * radius
            );
            positions.push(position);
        }
        
        return positions;
    }
}

class SearchPattern {
    // Search patterns for lost suspects
    
    public expandingSearch(startPosition: THREE.Vector3, time: number): THREE.Vector3 {
        // Expanding square search pattern
        const radius = time * 10;
        const angle = time * 0.5;
        
        return new THREE.Vector3(
            startPosition.x + Math.cos(angle) * radius,
            startPosition.y,
            startPosition.z + Math.sin(angle) * radius
        );
    }

    public lineSearch(startPosition: THREE.Vector3, direction: THREE.Vector3, time: number): THREE.Vector3 {
        // Line search pattern
        return startPosition.clone().add(direction.clone().multiplyScalar(time * 15));
    }
}
