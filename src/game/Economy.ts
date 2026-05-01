import { events, GameEvents } from './Events';

/**
 * Manages the player's wallet and transactions.
 * Interacts with the HUD and game systems via events.
 */
export class EconomyManager {
    private money: number = 500; // Starting money

    constructor() {
        this.updateHUD();
    }

    public getMoney(): number {
        return this.money;
    }

    public addMoney(amount: number) {
        this.money += amount;
        this.updateHUD();
        events.emit(GameEvents.MONEY_CHANGED, this.money);
    }

    public spendMoney(amount: number): boolean {
        if (this.money >= amount) {
            this.money -= amount;
            this.updateHUD();
            events.emit(GameEvents.MONEY_CHANGED, this.money);
            return true;
        }
        return false;
    }

    private updateHUD() {
        const moneyEl = document.getElementById('money-value');
        if (moneyEl) {
            moneyEl.textContent = `$${this.money.toLocaleString()}`;
            
            // Animation effect
            moneyEl.style.transform = 'scale(1.2)';
            setTimeout(() => {
                moneyEl.style.transform = 'scale(1)';
            }, 200);
        }
    }
}
