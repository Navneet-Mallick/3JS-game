export class MoneySystem {
    private currentMoney: number = 1000; // Starting money
    private bankMoney: number = 0;
    private totalEarned: number = 0;
    private totalSpent: number = 0;
    
    // Economy settings
    private readonly VEHICLE_PRICES = {
        sedan: 15000,
        sports: 45000,
        truck: 25000,
        motorcycle: 12000,
        police: 35000,
        ambulance: 40000
    };
    
    private readonly WEAPON_PRICES = {
        pistol: 500,
        shotgun: 1500,
        rifle: 3000,
        smg: 1200,
        sniper: 2500
    };
    
    private readonly PROPERTY_PRICES = {
        apartment: 50000,
        garage: 25000,
        shop: 75000,
        office: 100000
    };
    
    private readonly REWARDS = {
        collectible: 100,
        destruction: 50,
        powerup: 200,
        mission: 1000,
        stunt: 500,
        theft: 2000
    };

    constructor() {
        this.loadMoneyData();
    }

    // Money management
    public addMoney(amount: number, source: string): void {
        this.currentMoney += amount;
        this.totalEarned += amount;
        this.saveMoneyData();
        this.showMoneyChange(amount, true, source);
    }

    public removeMoney(amount: number, reason: string): boolean {
        if (this.currentMoney >= amount) {
            this.currentMoney -= amount;
            this.totalSpent += amount;
            this.saveMoneyData();
            this.showMoneyChange(amount, false, reason);
            return true;
        }
        return false; // Not enough money
    }

    public getCurrentMoney(): number {
        return this.currentMoney;
    }

    public getBankMoney(): number {
        return this.bankMoney;
    }

    public getTotalEarned(): number {
        return this.totalEarned;
    }

    public getTotalSpent(): number {
        return this.totalSpent;
    }

    // Banking system
    public deposit(amount: number): boolean {
        if (this.currentMoney >= amount) {
            this.currentMoney -= amount;
            this.bankMoney += amount;
            this.saveMoneyData();
            return true;
        }
        return false;
    }

    public withdraw(amount: number): boolean {
        if (this.bankMoney >= amount) {
            this.bankMoney += amount;
            this.currentMoney -= amount;
            this.saveMoneyData();
            return true;
        }
        return false;
    }

    // Vehicle pricing
    public getVehiclePrice(vehicleType: string): number {
        return this.VEHICLE_PRICES[vehicleType as keyof typeof this.VEHICLE_PRICES] || 0;
    }

    public canAffordVehicle(vehicleType: string): boolean {
        return this.currentMoney >= this.getVehiclePrice(vehicleType);
    }

    public purchaseVehicle(vehicleType: string): boolean {
        const price = this.getVehiclePrice(vehicleType);
        if (this.removeMoney(price, `Purchased ${vehicleType}`)) {
            return true;
        }
        return false;
    }

    // Weapon pricing
    public getWeaponPrice(weaponType: string): number {
        return this.WEAPON_PRICES[weaponType as keyof typeof this.WEAPON_PRICES] || 0;
    }

    public canAffordWeapon(weaponType: string): boolean {
        return this.currentMoney >= this.getWeaponPrice(weaponType);
    }

    public purchaseWeapon(weaponType: string): boolean {
        const price = this.getWeaponPrice(weaponType);
        if (this.removeMoney(price, `Purchased ${weaponType}`)) {
            return true;
        }
        return false;
    }

    // Property pricing
    public getPropertyPrice(propertyType: string): number {
        return this.PROPERTY_PRICES[propertyType as keyof typeof this.PROPERTY_PRICES] || 0;
    }

    public canAffordProperty(propertyType: string): boolean {
        return this.currentMoney >= this.getPropertyPrice(propertyType);
    }

    public purchaseProperty(propertyType: string): boolean {
        const price = this.getPropertyPrice(propertyType);
        if (this.removeMoney(price, `Purchased ${propertyType}`)) {
            return true;
        }
        return false;
    }

    // Reward system
    public addReward(type: keyof typeof this.REWARDS, multiplier: number = 1): void {
        const baseAmount = this.REWARDS[type];
        const totalAmount = baseAmount * multiplier;
        this.addMoney(totalAmount, type);
    }

    // Theft rewards (based on vehicle value)
    public calculateTheftReward(vehicleValue: number): number {
        return Math.floor(vehicleValue * 0.3); // 30% of vehicle value
    }

    public rewardVehicleTheft(vehicleType: string): void {
        const vehiclePrice = this.getVehiclePrice(vehicleType);
        const reward = this.calculateTheftReward(vehiclePrice);
        this.addMoney(reward, 'vehicle_theft');
    }

    // Save/Load system
    private saveMoneyData(): void {
        const moneyData = {
            currentMoney: this.currentMoney,
            bankMoney: this.bankMoney,
            totalEarned: this.totalEarned,
            totalSpent: this.totalSpent,
            timestamp: Date.now()
        };
        localStorage.setItem('moneyData', JSON.stringify(moneyData));
    }

    private loadMoneyData(): void {
        try {
            const savedData = localStorage.getItem('moneyData');
            if (savedData) {
                const moneyData = JSON.parse(savedData);
                this.currentMoney = moneyData.currentMoney || 1000;
                this.bankMoney = moneyData.bankMoney || 0;
                this.totalEarned = moneyData.totalEarned || 0;
                this.totalSpent = moneyData.totalSpent || 0;
            }
        } catch (error) {
            console.error('Failed to load money data:', error);
        }
    }

    // UI helpers
    private showMoneyChange(amount: number, isEarned: boolean, source: string): void {
        const moneyDisplay = document.getElementById('money-display');
        if (moneyDisplay) {
            moneyDisplay.textContent = `$${this.currentMoney.toLocaleString()}`;
            
            // Add animation
            moneyDisplay.style.transform = 'scale(1.2)';
            moneyDisplay.style.color = isEarned ? '#00ff00' : '#ff0000';
            
            setTimeout(() => {
                moneyDisplay.style.transform = 'scale(1)';
                moneyDisplay.style.color = '#ffffff';
            }, 300);
        }
        
        // Show floating text
        this.showFloatingMoney(amount, isEarned, source);
    }

    private showFloatingMoney(amount: number, isEarned: boolean, source: string): void {
        const floatingText = document.createElement('div');
        floatingText.className = 'floating-money';
        floatingText.textContent = `${isEarned ? '+' : '-'}$${amount}`;
        floatingText.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: ${isEarned ? '#00ff00' : '#ff0000'};
            font-size: 24px;
            font-weight: bold;
            font-family: Arial, sans-serif;
            pointer-events: none;
            z-index: 10000;
            animation: floatUp 2s ease-out forwards;
        `;
        
        // Add CSS animation if not exists
        if (!document.querySelector('#floating-money-style')) {
            const style = document.createElement('style');
            style.id = 'floating-money-style';
            style.textContent = `
                @keyframes floatUp {
                    0% { opacity: 1; transform: translate(-50%, -50%); }
                    100% { opacity: 0; transform: translate(-50%, -150%); }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(floatingText);
        setTimeout(() => {
            document.body.removeChild(floatingText);
        }, 2000);
    }

    // Economy calculations
    public getNetWorth(): number {
        return this.currentMoney + this.bankMoney;
    }

    public getProfit(): number {
        return this.totalEarned - this.totalSpent;
    }

    public getStatistics(): {
        currentMoney: number;
        bankMoney: number;
        totalEarned: number;
        totalSpent: number;
        netWorth: number;
        profit: number;
    } {
        return {
            currentMoney: this.currentMoney,
            bankMoney: this.bankMoney,
            totalEarned: this.totalEarned,
            totalSpent: this.totalSpent,
            netWorth: this.getNetWorth(),
            profit: this.getProfit()
        };
    }

    // Cheat codes (for testing)
    public addCheatMoney(amount: number): void {
        this.addMoney(amount, 'CHEAT');
    }

    public maxMoney(): void {
        this.currentMoney = 999999999;
        this.bankMoney = 999999999;
        this.saveMoneyData();
        this.showMoneyChange(999999999, true, 'MAX_MONEY_CHEAT');
    }

    // Reset system
    public reset(): void {
        this.currentMoney = 1000;
        this.bankMoney = 0;
        this.totalEarned = 0;
        this.totalSpent = 0;
        this.saveMoneyData();
    }
}
