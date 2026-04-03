export class MainMenu {
    private isVisible: boolean = true;
    private menuElement: HTMLElement | null = null;
    private onGameStart: () => void;
    private onSettings: () => void;
    private onExit: () => void;

    constructor(onGameStart: () => void, onSettings: () => void, onExit: () => void) {
        this.onGameStart = onGameStart;
        this.onSettings = onSettings;
        this.onExit = onExit;
        this.createMenu();
        this.setupEventListeners();
    }

    private createMenu() {
        // Check if menu already exists
        this.menuElement = document.getElementById('main-menu');
        if (this.menuElement) {
            return;
        }

        // Create main menu
        this.menuElement = document.createElement('div');
        this.menuElement.id = 'main-menu';
        this.menuElement.className = 'main-menu';
        this.menuElement.innerHTML = `
            <div class="menu-container">
                <div class="menu-header">
                    <h1 class="game-title">NEO-NOIR CITY</h1>
                    <div class="game-subtitle">A GTA-Style Open World Experience</div>
                    <div class="game-version">Version 1.0.0</div>
                </div>
                
                <div class="menu-options">
                    <button class="menu-button primary" id="start-game">
                        <span class="button-icon">▶</span>
                        <span class="button-text">START GAME</span>
                    </button>
                    
                    <button class="menu-button" id="continue-game">
                        <span class="button-icon">⏸</span>
                        <span class="button-text">CONTINUE</span>
                    </button>
                    
                    <button class="menu-button" id="settings">
                        <span class="button-icon">⚙</span>
                        <span class="button-text">SETTINGS</span>
                    </button>
                    
                    <button class="menu-button" id="credits">
                        <span class="button-icon">📋</span>
                        <span class="button-text">CREDITS</span>
                    </button>
                    
                    <button class="menu-button" id="exit">
                        <span class="button-icon">❌</span>
                        <span class="button-text">EXIT</span>
                    </button>
                </div>
                
                <div class="menu-footer">
                    <div class="loading-tips">
                        <div class="tip-text">Press ENTER to select • Arrow keys to navigate</div>
                    </div>
                    <div class="copyright">© 2026 Neo-Noir City. All rights reserved.</div>
                </div>
            </div>
        `;

        document.body.appendChild(this.menuElement);
    }

    private setupEventListeners() {
        if (!this.menuElement) return;

        // Button click handlers
        const startBtn = document.getElementById('start-game');
        const continueBtn = document.getElementById('continue-game');
        const settingsBtn = document.getElementById('settings');
        const creditsBtn = document.getElementById('credits');
        const exitBtn = document.getElementById('exit');

        startBtn?.addEventListener('click', () => this.startGame());
        continueBtn?.addEventListener('click', () => this.continueGame());
        settingsBtn?.addEventListener('click', () => this.openSettings());
        creditsBtn?.addEventListener('click', () => this.showCredits());
        exitBtn?.addEventListener('click', () => this.exitGame());

        // Keyboard navigation
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
    }

    private handleKeyPress(e: KeyboardEvent) {
        if (!this.isVisible) return;

        switch (e.key) {
            case 'Enter':
                this.startGame();
                break;
            case 'Escape':
                this.exitGame();
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

    private startGame() {
        this.hide();
        this.onGameStart();
    }

    private continueGame() {
        // Check if save exists
        const hasSave = localStorage.getItem('neo_noir_city_save');
        if (hasSave) {
            this.hide();
            this.onGameStart();
        } else {
            this.showNotification('No save game found!');
        }
    }

    private openSettings() {
        this.showSettings();
        this.onSettings();
    }

    private showCredits() {
        this.showCreditsScreen();
    }

    private exitGame() {
        this.showExitConfirmation();
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
                        <label>Mouse Sensitivity</label>
                        <input type="range" id="mouse-sensitivity" min="1" max="10" value="5">
                    </div>
                    <div class="setting-group">
                        <label>Fullscreen</label>
                        <input type="checkbox" id="fullscreen">
                    </div>
                </div>
                <div class="settings-footer">
                    <button class="menu-button" id="back-to-menu">BACK</button>
                </div>
            </div>
        `;

        this.showModal(settingsHtml, 'settings');
    }

    private showCreditsScreen() {
        const creditsHtml = `
            <div class="credits-screen">
                <div class="credits-content">
                    <h2>CREDITS</h2>
                    <div class="credits-section">
                        <h3>DEVELOPMENT</h3>
                        <p>Lead Developer: Navneet Mallick</p>
                        <p>Game Design: AI Assistant</p>
                        <p>Programming: TypeScript & Three.js</p>
                    </div>
                    <div class="credits-section">
                        <h3>TECHNOLOGY</h3>
                        <p>Engine: Three.js + Cannon.js</p>
                        <p>Audio: Web Audio API</p>
                        <p>Physics: Cannon.js</p>
                    </div>
                    <div class="credits-section">
                        <h3>SPECIAL THANKS</h3>
                        <p>Open Source Community</p>
                        <p>WebGL Contributors</p>
                        <p>Game Development Community</p>
                    </div>
                </div>
                <div class="credits-footer">
                    <button class="menu-button" id="back-to-menu-credits">BACK</button>
                </div>
            </div>
        `;

        this.showModal(creditsHtml, 'credits');
    }

    private showExitConfirmation() {
        const exitHtml = `
            <div class="exit-confirmation">
                <div class="exit-content">
                    <h2>EXIT GAME?</h2>
                    <p>Are you sure you want to exit Neo-Noir City?</p>
                    <div class="exit-buttons">
                        <button class="menu-button danger" id="confirm-exit">YES</button>
                        <button class="menu-button" id="cancel-exit">NO</button>
                    </div>
                </div>
            </div>
        `;

        this.showModal(exitHtml, 'exit');
    }

    private showModal(html: string, type: string) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = html;
        document.body.appendChild(modal);

        // Setup modal event listeners
        if (type === 'settings') {
            document.getElementById('back-to-menu')?.addEventListener('click', () => {
                document.body.removeChild(modal);
            });
        } else if (type === 'credits') {
            document.getElementById('back-to-menu-credits')?.addEventListener('click', () => {
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

    public show() {
        if (this.menuElement) {
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

    public isMenuVisible(): boolean {
        return this.isVisible;
    }
}
