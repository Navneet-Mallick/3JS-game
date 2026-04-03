export class ScoreSystem {
    private score = 0;
    private multiplier = 1;
    private multTimer = 0;
    private driftTimer = 0;
    private airTimer = 0;

    private scoreEl      = document.getElementById('score-value');
    private multEl       = document.getElementById('multiplier-value');
    private comboEl      = document.getElementById('combo-text');

    public add(points: number, label?: string) {
        const earned = Math.round(points * this.multiplier);
        this.score += earned;
        this.updateUI();
        if (label) this.flashCombo(`${label}  +${earned}`);
    }

    public updateDrift(driftSpeed: number, dt: number) {
        if (driftSpeed > 8) {
            this.driftTimer += dt;
            if (this.driftTimer > 0.5) {
                this.add(Math.round(driftSpeed * dt * 10), 'DRIFT');
                this.boostMultiplier();
            }
        } else {
            this.driftTimer = 0;
        }
    }

    public updateAir(onGround: boolean, dt: number) {
        if (!onGround) {
            this.airTimer += dt;
        } else {
            if (this.airTimer > 0.8) {
                this.add(Math.round(this.airTimer * 200), 'AIR TIME');
                this.boostMultiplier();
            }
            this.airTimer = 0;
        }
    }

    public updateMultiplier(dt: number) {
        if (this.multTimer > 0) {
            this.multTimer -= dt;
            if (this.multTimer <= 0) {
                this.multiplier = 1;
                this.updateUI();
            }
        }
    }

    private boostMultiplier() {
        this.multiplier = Math.min(8, this.multiplier + 1);
        this.multTimer = 4;
        this.updateUI();
    }

    private updateUI() {
        if (this.scoreEl) this.scoreEl.textContent = this.score.toLocaleString();
        if (this.multEl)  this.multEl.textContent  = `x${this.multiplier}`;
        if (this.multEl)  this.multEl.style.color  = this.multiplier > 1 ? '#ff0055' : '#00f2ff';
    }

    private flashCombo(text: string) {
        if (!this.comboEl) return;
        this.comboEl.textContent = text;
        this.comboEl.classList.remove('pop');
        void this.comboEl.offsetWidth; // reflow
        this.comboEl.classList.add('pop');
    }

    public getScore() { return this.score; }
}
