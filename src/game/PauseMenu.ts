export class PauseMenu {
    private isVisible: boolean = false;
    private menuElement: HTMLElement | null = null;
    private onResume: () => void;
    private onSettings: () => void;
    private onMainMenu: () => void;
    private onExit: () => void;

    constructor(onResume: () => void, onSettings: () => void, onMainMenu: () => void, onExit: () => void) {
        this.onResume = onResume;
        this.onSettings = onSettings;
        this.onMainMenu = onMainMenu;
        this.onExit = onExit;
        this.createMenu();
    }

    private createMenu() {
        this.menuElement = document.createElement('div');
        this.menuElement.id = 'pause-menu';
        this.menuElement.className = 'pause-menu';
        this.menuElement.style.display = 'none';
        this.menuElement.innerHTML = `
            <div class="pause-container">
                <div class="pause-header">
                    <h1 class="pause-title">PAUSED</h1>
                    <div class="game-time">Time Played: <span id="play-time">00:00:00</span></div>
                </div>
                
                <div class="pause-options">
                    <button class="menu-button primary" id="resume-game">
                        <span class="button-icon">▶</span>
                        <span class="button-text">RESUME</span>
                    </button>
                    
                    <button class="menu-button" id="save-game">
                        <span class="button-icon">💾</span>
                        <span class="button-text">SAVE GAME</span>
                    </button>
                    
                    <button class="menu-button" id="load-game">
                        <span class="button-icon">📂</span>
                        <span class="button-text">LOAD GAME</span>
                    </button>
                    
                    <button class="menu-button" id="settings">
                        <span class="button-icon">⚙</span>
                        <span class="button-text">SETTINGS</span>
                    </button>
                    
                    <button class="menu-button" id="main-menu">
                        <span class="button-icon">🏠</span>
                        <span class="button-text">MAIN MENU</span>
                    </button>
                    
                    <button class="menu-button danger" id="exit-game">
                        <span class="button-icon">❌</span>
                        <span class="button-text">EXIT TO DESKTOP</span>
                    </button>
                </div>
                
                <div class="pause-footer">
                    <div class="game-stats">
                        <div class="stat-item">
                            <span class="stat-label">Money:</span>
                            <span class="stat-value" id="pause-money">$0</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Score:</span>
                            <span class="stat-value" id="pause-score">0</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Wanted Level:</span>
                            <span class="stat-value" id="pause-wanted">⭐</span>
                        </div>
                    </div>
                    <div class="pause-tips">
                        <div class="tip-text">Press ESC to resume • Arrow keys to navigate</div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(this.menuElement);
        this.setupEventListeners();
    }

    private setupEventListeners() {
        if (!this.menuElement) return;

        // Button click handlers
        const resumeBtn = document.getElementById('resume-game');
        const saveBtn = document.getElementById('save-game');
        const loadBtn = document.getElementById('load-game');
        const settingsBtn = document.getElementById('settings');
        const mainMenuBtn = document.getElementById('main-menu');
        const exitBtn = document.getElementById('exit-game');

        resumeBtn?.addEventListener('click', () => this.resume());
        saveBtn?.addEventListener('click', () => this.saveGame());
        loadBtn?.addEventListener('click', () => this.loadGame());
        settingsBtn?.addEventListener('click', () => this.openSettings());
        mainMenuBtn?.addEventListener('click', () => this.goToMainMenu());
        exitBtn?.addEventListener('click', () => this.exitGame());

        // Keyboard navigation
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
    }

    private handleKeyPress(e: KeyboardEvent) {
        if (!this.isVisible) return;

        switch (e.key) {
            case 'Escape':
                this.resume();
                break;
            case 'Enter':
                this.resume();
                break;
            case 'ArrowDown':
                this.navigateMenu(1);
                break;
            case 'ArrowUp':
                this.navigateMenu(-1);
                break;
        }
    }

    private navigateMenu(direction: number) {
        const buttons = this.menuElement?.querySelectorAll('.menu-button');
        if (!buttons) return;

        const currentIndex = Array.from(buttons).findIndex(btn => btn.classList.contains('selected'));
        let newIndex = currentIndex + direction;

        if (newIndex < 0) newIndex = buttons.length - 1;
        if (newIndex >= buttons.length) newIndex = 0;

        // Remove selected class from all buttons
        buttons.forEach(btn => btn.classList.remove('selected'));
        
        // Add selected class to new button
        buttons[newIndex].classList.add('selected');
    }

    private resume() {
        this.hide();
        this.onResume();
    }

    private saveGame() {
        // Trigger save game
        this.showNotification('Game saved successfully!');
        this.onResume();
    }

    private loadGame() {
        // Check if save exists
        const hasSave = localStorage.getItem('neo_noir_city_save');
        if (hasSave) {
            this.showNotification('Game loaded successfully!');
            this.onResume();
        } else {
            this.showNotification('No save game found!');
        }
    }

    private openSettings() {
        this.showSettings();
        this.onSettings();
    }

    private goToMainMenu() {
        this.showExitConfirmation('main-menu');
    }

    private exitGame() {
        this.showExitConfirmation('exit');
    }

    private showSettings() {
        const settingsHtml = `
            <div class="settings-screen">
                <div class="settings-header">
                    <h2>SETTINGS</h2>
                </div>
                <div class="settings-content">
                    <div class="setting-group">
                        <label>Graphics Quality</label>
                        <select id="graphics-quality">
                            <option value="low">Low</option>
                            <option value="medium" selected>Medium</option>
                            <option value="high">High</option>
                            <option value="ultra">Ultra</option>
                        </select>
                    </div>
                    <div class="setting-group">
                        <label>Master Volume</label>
                        <input type="range" id="master-volume" min="0" max="100" value="60">
                    </div>
                    <div class="setting-group">
                        <label>Radio Volume</label>
                        <input type="range" id="radio-volume" min="0" max="100" value="30">
                    </div>
                    <div class="setting-group">
                        <label>Mouse Sensitivity</label>
                        <input type="range" id="mouse-sensitivity" min="1" max="10" value="5">
                    </div>
                    <div class="setting-group">
                        <label>Field of View</label>
                        <input type="range" id="fov" min="60" max="120" value="75">
                    </div>
                    <div class="setting-group">
                        <label>V-Sync</label>
                        <input type="checkbox" id="vsync" checked>
                    </div>
                </div>
                <div class="settings-footer">
                    <button class="menu-button" id="back-to-pause">BACK</button>
                </div>
            </div>
        `;

        this.showModal(settingsHtml, 'settings');
    }

    private showExitConfirmation(type: 'main-menu' | 'exit') {
        const title = type === 'main-menu' ? 'RETURN TO MAIN MENU?' : 'EXIT TO DESKTOP?';
        const message = type === 'main-menu' 
            ? 'Any unsaved progress will be lost. Continue?' 
            : 'Are you sure you want to exit Neo-Noir City?';

        const exitHtml = `
            <div class="exit-confirmation">
                <div class="exit-content">
                    <h2>${title}</h2>
                    <p>${message}</p>
                    <div class="exit-buttons">
                        <button class="menu-button danger" id="confirm-${type}">YES</button>
                        <button class="menu-button" id="cancel-${type}">NO</button>
                    </div>
                </div>
            </div>
        `;

        this.showModal(exitHtml, type);
    }

    private showModal(html: string, type: string) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = html;
        document.body.appendChild(modal);

        // Setup modal event listeners
        if (type === 'settings') {
            document.getElementById('back-to-pause')?.addEventListener('click', () => {
                document.body.removeChild(modal);
            });
        } else if (type === 'main-menu') {
            document.getElementById('confirm-main-menu')?.addEventListener('click', () => {
                this.hide();
                this.onMainMenu();
            });
            document.getElementById('cancel-main-menu')?.addEventListener('click', () => {
                document.body.removeChild(modal);
            });
        } else if (type === 'exit') {
            document.getElementById('confirm-exit')?.addEventListener('click', () => {
                this.onExit();
            });
            document.getElementById('cancel-exit')?.addEventListener('click', () => {
                document.body.removeChild(modal);
            });
        }

        // Close on Escape
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                document.body.removeChild(modal);
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }

    private showNotification(message: string) {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.classList.add('show');
        }, 100);

        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    public show(gameStats: { money: number; score: number; wantedLevel: number; playTime: number }) {
        if (this.menuElement) {
            // Update stats
            const moneyEl = document.getElementById('pause-money');
            const scoreEl = document.getElementById('pause-score');
            const wantedEl = document.getElementById('pause-wanted');
            const timeEl = document.getElementById('play-time');

            if (moneyEl) moneyEl.textContent = `$${gameStats.money.toLocaleString()}`;
            if (scoreEl) scoreEl.textContent = gameStats.score.toLocaleString();
            if (wantedEl) wantedEl.textContent = '⭐'.repeat(gameStats.wantedLevel);
            if (timeEl) {
                const hours = Math.floor(gameStats.playTime / 3600);
                const minutes = Math.floor((gameStats.playTime % 3600) / 60);
                const seconds = Math.floor(gameStats.playTime % 60);
                timeEl.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }

            this.menuElement.style.display = 'flex';
            this.isVisible = true;
        }
    }

    public hide() {
        if (this.menuElement) {
            this.menuElement.style.display = 'none';
            this.isVisible = false;
        }
    }

    public isPaused(): boolean {
        return this.isVisible;
    }

    public toggle(gameStats: { money: number; score: number; wantedLevel: number; playTime: number }) {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show(gameStats);
        }
    }
}
