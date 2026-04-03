export class SaveSystem {
    private static readonly SAVE_VERSION = '1.0.0';
    private static readonly SAVE_KEY = 'neo_noir_city_save';
    
    private saveData: GameSaveData;
    private autoSaveTimer: number = 0;
    private autoSaveInterval: number = 60000; // 1 minute in milliseconds

    constructor() {
        this.saveData = this.loadSaveData();
        this.startAutoSave();
    }

    // Save data structure
    private createSaveData(): GameSaveData {
        return {
            version: SaveSystem.SAVE_VERSION,
            timestamp: Date.now(),
            player: {
                position: { x: 0, y: 3, z: 0 },
                health: 100,
                armor: 0,
                money: 1000,
                weapons: [],
                wantedLevel: 0
            },
            vehicles: {
                owned: [],
                current: null,
                positions: []
            },
            missions: {
                completed: [],
                active: null,
                progress: {}
            },
            world: {
                collectibles: [],
                destructibles: [],
                powerUps: [],
                buildingsOwned: []
            },
            statistics: {
                totalPlayTime: 0,
                missionsCompleted: 0,
                vehiclesStolen: 0,
                crimesCommitted: 0,
                moneyEarned: 0,
                moneySpent: 0,
                distanceTraveled: 0,
                highestWantedLevel: 0
            },
            settings: {
                volume: 1.0,
                sensitivity: 1.0,
                quality: 'high',
                autoSave: true
            }
        };
    }

    // Core save/load functions
    public saveGame(): boolean {
        try {
            this.updateSaveData();
            const saveString = JSON.stringify(this.saveData);
            localStorage.setItem(SaveSystem.SAVE_KEY, saveString);
            
            // Also create a backup save
            const backupKey = `${SaveSystem.SAVE_KEY}_backup_${Date.now()}`;
            localStorage.setItem(backupKey, saveString);
            
            console.log('Game saved successfully');
            return true;
        } catch (error) {
            console.error('Failed to save game:', error);
            return false;
        }
    }

    public loadGame(): boolean {
        try {
            const saveString = localStorage.getItem(SaveSystem.SAVE_KEY);
            if (!saveString) {
                console.log('No save file found');
                return false;
            }
            
            this.saveData = JSON.parse(saveString);
            
            // Verify save version compatibility
            if (!this.verifySaveVersion()) {
                console.warn('Save version mismatch, attempting migration');
                this.migrateSaveData();
            }
            
            console.log('Game loaded successfully');
            return true;
        } catch (error) {
            console.error('Failed to load game:', error);
            return false;
        }
    }

    public deleteSave(): boolean {
        try {
            localStorage.removeItem(SaveSystem.SAVE_KEY);
            
            // Remove backup saves
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith(`${SaveSystem.SAVE_KEY}_backup_`)) {
                    localStorage.removeItem(key);
                }
            });
            
            console.log('Save deleted successfully');
            return true;
        } catch (error) {
            console.error('Failed to delete save:', error);
            return false;
        }
    }

    // Auto-save system
    private startAutoSave(): void {
        setInterval(() => {
            if (this.saveData.settings.autoSave) {
                this.autoSave();
            }
        }, this.autoSaveInterval);
    }

    private autoSave(): void {
        this.saveGame();
        console.log('Auto-save completed');
    }

    // Update save data from current game state
    private updateSaveData(): void {
        // This would be called by the Core class to update save data
        // For now, just update timestamp
        this.saveData.timestamp = Date.now();
    }

    // Data accessors
    public getPlayerData(): PlayerSaveData {
        return this.saveData.player;
    }

    public getVehicleData(): VehicleSaveData {
        return this.saveData.vehicles;
    }

    public getMissionData(): MissionSaveData {
        return this.saveData.missions;
    }

    public getWorldData(): WorldSaveData {
        return this.saveData.world;
    }

    public getStatistics(): StatisticsSaveData {
        return this.saveData.statistics;
    }

    public getSettings(): SettingsSaveData {
        return this.saveData.settings;
    }

    // Data modifiers
    public updatePlayerData(data: Partial<PlayerSaveData>): void {
        this.saveData.player = { ...this.saveData.player, ...data };
        this.saveGame();
    }

    public updateVehicleData(data: Partial<VehicleSaveData>): void {
        this.saveData.vehicles = { ...this.saveData.vehicles, ...data };
        this.saveGame();
    }

    public updateMissionData(data: Partial<MissionSaveData>): void {
        this.saveData.missions = { ...this.saveData.missions, ...data };
        this.saveGame();
    }

    public updateWorldData(data: Partial<WorldSaveData>): void {
        this.saveData.world = { ...this.saveData.world, ...data };
        this.saveGame();
    }

    public updateStatistics(data: Partial<StatisticsSaveData>): void {
        this.saveData.statistics = { ...this.saveData.statistics, ...data };
        this.saveGame();
    }

    public updateSettings(data: Partial<SettingsSaveData>): void {
        this.saveData.settings = { ...this.saveData.settings, ...data };
        this.saveGame();
    }

    // Quick save/load functions
    public quickSave(): boolean {
        const quickSaveKey = `${SaveSystem.SAVE_KEY}_quicksave`;
        try {
            this.updateSaveData();
            localStorage.setItem(quickSaveKey, JSON.stringify(this.saveData));
            console.log('Quick save completed');
            return true;
        } catch (error) {
            console.error('Failed to quick save:', error);
            return false;
        }
    }

    public quickLoad(): boolean {
        const quickSaveKey = `${SaveSystem.SAVE_KEY}_quicksave`;
        try {
            const saveString = localStorage.getItem(quickSaveKey);
            if (!saveString) {
                console.log('No quick save found');
                return false;
            }
            
            this.saveData = JSON.parse(saveString);
            console.log('Quick load completed');
            return true;
        } catch (error) {
            console.error('Failed to quick load:', error);
            return false;
        }
    }

    // Save management
    public getSaveSlots(): SaveSlot[] {
        const slots: SaveSlot[] = [];
        
        // Main save
        const mainSave = this.getSaveSlotInfo(SaveSystem.SAVE_KEY);
        if (mainSave) {
            slots.push(mainSave);
        }
        
        // Quick save
        const quickSave = this.getSaveSlotInfo(`${SaveSystem.SAVE_KEY}_quicksave`);
        if (quickSave) {
            quickSave.name = 'Quick Save';
            slots.push(quickSave);
        }
        
        // Backup saves
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith(`${SaveSystem.SAVE_KEY}_backup_`)) {
                const backup = this.getSaveSlotInfo(key);
                if (backup) {
                    backup.name = `Backup ${new Date(parseInt(key.split('_')[3])).toLocaleString()}`;
                    slots.push(backup);
                }
            }
        });
        
        return slots.sort((a, b) => b.timestamp - a.timestamp);
    }

    private getSaveSlotInfo(key: string): SaveSlot | null {
        try {
            const saveString = localStorage.getItem(key);
            if (!saveString) return null;
            
            const data = JSON.parse(saveString) as GameSaveData;
            
            return {
                key: key,
                name: 'Main Save',
                timestamp: data.timestamp,
                playTime: data.statistics.totalPlayTime,
                money: data.player.money,
                missions: data.missions.completed.length,
                version: data.version
            };
        } catch (error) {
            return null;
        }
    }

    public loadFromSlot(slotKey: string): boolean {
        try {
            const saveString = localStorage.getItem(slotKey);
            if (!saveString) {
                console.log('Save slot not found');
                return false;
            }
            
            this.saveData = JSON.parse(saveString);
            
            if (!this.verifySaveVersion()) {
                this.migrateSaveData();
            }
            
            console.log(`Loaded save from slot: ${slotKey}`);
            return true;
        } catch (error) {
            console.error('Failed to load from save slot:', error);
            return false;
        }
    }

    // Save verification and migration
    private verifySaveVersion(): boolean {
        return this.saveData.version === SaveSystem.SAVE_VERSION;
    }

    private migrateSaveData(): void {
        // Migrate save data from older versions
        const currentVersion = this.saveData.version;
        
        // Example migration logic
        if (currentVersion < '1.0.0') {
            // Add new fields for version 1.0.0
            if (!this.saveData.statistics.highestWantedLevel) {
                this.saveData.statistics.highestWantedLevel = 0;
            }
            if (!this.saveData.settings.autoSave) {
                this.saveData.settings.autoSave = true;
            }
        }
        
        this.saveData.version = SaveSystem.SAVE_VERSION;
        console.log(`Migrated save from version ${currentVersion} to ${SaveSystem.SAVE_VERSION}`);
    }

    // Export/Import functionality
    public exportSave(): string {
        try {
            this.updateSaveData();
            return JSON.stringify(this.saveData, null, 2);
        } catch (error) {
            console.error('Failed to export save:', error);
            return '';
        }
    }

    public importSave(saveString: string): boolean {
        try {
            const data = JSON.parse(saveString) as GameSaveData;
            
            // Validate save data structure
            if (!this.validateSaveData(data)) {
                console.error('Invalid save data structure');
                return false;
            }
            
            this.saveData = data;
            
            if (!this.verifySaveVersion()) {
                this.migrateSaveData();
            }
            
            this.saveGame();
            console.log('Save imported successfully');
            return true;
        } catch (error) {
            console.error('Failed to import save:', error);
            return false;
        }
    }

    private validateSaveData(data: any): boolean {
        // Basic validation of save data structure
        return (
            data &&
            typeof data === 'object' &&
            data.player &&
            data.vehicles &&
            data.missions &&
            data.world &&
            data.statistics &&
            data.settings
        );
    }

    // Statistics tracking
    public updatePlayTime(deltaTime: number): void {
        this.saveData.statistics.totalPlayTime += deltaTime;
    }

    public addMissionCompleted(): void {
        this.saveData.statistics.missionsCompleted++;
    }

    public addVehicleStolen(): void {
        this.saveData.statistics.vehiclesStolen++;
    }

    public addCrime(): void {
        this.saveData.statistics.crimesCommitted++;
    }

    public addMoneyEarned(amount: number): void {
        this.saveData.statistics.moneyEarned += amount;
    }

    public addMoneySpent(amount: number): void {
        this.saveData.statistics.moneySpent += amount;
    }

    public addDistanceTraveled(distance: number): void {
        this.saveData.statistics.distanceTraveled += distance;
    }

    public updateHighestWantedLevel(level: number): void {
        if (level > this.saveData.statistics.highestWantedLevel) {
            this.saveData.statistics.highestWantedLevel = level;
        }
    }

    // Utility functions
    public hasSaveData(): boolean {
        return localStorage.getItem(SaveSystem.SAVE_KEY) !== null;
    }

    public getSaveFileInfo(): {
        exists: boolean;
        timestamp: number;
        version: string;
        playTime: number;
    } {
        const exists = this.hasSaveData();
        if (!exists) {
            return {
                exists: false,
                timestamp: 0,
                version: '0.0.0',
                playTime: 0
            };
        }

        return {
            exists: true,
            timestamp: this.saveData.timestamp,
            version: this.saveData.version,
            playTime: this.saveData.statistics.totalPlayTime
        };
    }

    private loadSaveData(): GameSaveData {
        try {
            const saveString = localStorage.getItem(SaveSystem.SAVE_KEY);
            if (saveString) {
                const data = JSON.parse(saveString);
                if (this.verifySaveVersion()) {
                    return data;
                } else {
                    this.migrateSaveData();
                    return data;
                }
            }
        } catch (error) {
            console.error('Failed to load save data:', error);
        }
        
        return this.createSaveData();
    }
}

// Type definitions
interface GameSaveData {
    version: string;
    timestamp: number;
    player: PlayerSaveData;
    vehicles: VehicleSaveData;
    missions: MissionSaveData;
    world: WorldSaveData;
    statistics: StatisticsSaveData;
    settings: SettingsSaveData;
}

interface PlayerSaveData {
    position: { x: number; y: number; z: number };
    health: number;
    armor: number;
    money: number;
    weapons: string[];
    wantedLevel: number;
}

interface VehicleSaveData {
    owned: string[];
    current: string | null;
    positions: { x: number; y: number; z: number }[];
}

interface MissionSaveData {
    completed: string[];
    active: string | null;
    progress: { [key: string]: any };
}

interface WorldSaveData {
    collectibles: number[];
    destructibles: number[];
    powerUps: number[];
    buildingsOwned: string[];
}

interface StatisticsSaveData {
    totalPlayTime: number;
    missionsCompleted: number;
    vehiclesStolen: number;
    crimesCommitted: number;
    moneyEarned: number;
    moneySpent: number;
    distanceTraveled: number;
    highestWantedLevel: number;
}

interface SettingsSaveData {
    volume: number;
    sensitivity: number;
    quality: string;
    autoSave: boolean;
}

interface SaveSlot {
    key: string;
    name: string;
    timestamp: number;
    playTime: number;
    money: number;
    missions: number;
    version: string;
}
