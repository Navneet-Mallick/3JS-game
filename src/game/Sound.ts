/**
 * Sound – procedural Web Audio engine (no asset files needed)
 * Generates engine hum, footsteps, collision thuds, ambient city noise
 */
export class Sound {
    private ctx: AudioContext | null = null;
    private engineGain: GainNode | null = null;
    private engineOsc: OscillatorNode | null = null;
    private ambientGain: GainNode | null = null;
    private masterGain: GainNode | null = null;
    private footstepTimer = 0;
    private muted = false;

    public init() {
        // AudioContext will be created on first user interaction
        this.createAudioContext();
    }

    private createAudioContext() {
        if (this.ctx) return;
        
        try {
            this.ctx = new AudioContext();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.6;
            this.masterGain.connect(this.ctx.destination);
            this.startAmbient();
        } catch {
            // Web Audio not available
        }
    }

    public ensureAudioContext() {
        if (!this.ctx) {
            this.createAudioContext();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    public resume() {
        this.ensureAudioContext();
    }

    private startAmbient() {
    if (!this.ctx || !this.masterGain) return;
    
    try {  // ← ADD THIS
        this.ambientGain = this.ctx.createGain();
        this.ambientGain.gain.value = 0.04;
        this.ambientGain.connect(this.masterGain);

        const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 120;
        src.connect(filter);
        filter.connect(this.ambientGain);
        src.start();
    } catch(e) {
        console.warn('Audio init failed:', e);  // ← won't crash game
    }
}

    public startEngine() {
        if (!this.ctx || !this.masterGain || this.engineOsc) return;
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;
        this.engineGain.connect(this.masterGain);

        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.value = 60;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 400;

        this.engineOsc.connect(filter);
        filter.connect(this.engineGain);

        this.engineOsc.start();

        this.engineGain.gain.setTargetAtTime(0.18, this.ctx.currentTime, 0.3);
    }

    public stopEngine() {
        if (!this.engineOsc || !this.ctx) return;
        try {
            this.engineOsc.stop();
        } catch {
            // Already stopped
        }
        this.engineOsc = null;
        this.engineGain = null;
    }

    public updateEngine(speed: number, throttle: boolean) {
        if (!this.engineOsc || !this.engineGain || !this.ctx) return;
        
        // Vary frequency based on speed
        const freq = 60 + speed * 20;
        this.engineOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.1);
        
        // Vary gain based on throttle
        const targetGain = throttle ? 0.25 : 0.12;
        this.engineGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.2);
    }

    public playFootstep(dt: number, sprinting: boolean) {
        if (!this.ctx || !this.masterGain) return;
        this.footstepTimer -= dt;
        if (this.footstepTimer > 0) return;
        this.footstepTimer = sprinting ? 0.22 : 0.38;

        const g = this.ctx.createGain();
        g.gain.value = 0.08;
        g.connect(this.masterGain);

        const buf = this.ctx.createBuffer(1, 1024, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / 200);
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const f = this.ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 200 + Math.random() * 100;
        src.connect(f);
        f.connect(g);
        src.start();
    }

    public playCollision(intensity: number) {
        if (!this.ctx || !this.masterGain) return;
        const g = this.ctx.createGain();
        g.gain.value = Math.min(0.5, intensity * 0.01);
        g.connect(this.masterGain);

        const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.3, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.05));
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 300;
        src.connect(f);
        f.connect(g);
        g.gain.setValueAtTime(0.4, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
        src.start();
    }

    public playCollect() {
        if (!this.ctx || !this.masterGain) return;
        const g = this.ctx.createGain();
        g.gain.value = 0.2;
        g.connect(this.masterGain);

        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1600, this.ctx.currentTime + 0.1);
        osc.connect(g);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    }

    public playExplosion() {
        if (!this.ctx || !this.masterGain) return;
        const g = this.ctx.createGain();
        g.gain.value = 0.3;
        g.connect(this.masterGain);

        const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.5, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / 1500);
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 200;
        src.connect(f);
        f.connect(g);
        g.gain.setValueAtTime(0.4, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
        src.start();
    }

    public playPickup() {
        if (!this.ctx || !this.masterGain) return;
        const g = this.ctx.createGain();
        g.gain.value = 0.15;
        g.connect(this.masterGain);

        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.2);
        osc.connect(g);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);
    }

    public playPowerUp() {
        if (!this.ctx || !this.masterGain) return;
        const g = this.ctx.createGain();
        g.gain.value = 0.25;
        g.connect(this.masterGain);

        const osc = this.ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(200, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.3);
        osc.connect(g);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.3);
    }

    public playReload() {
        if (!this.ctx || !this.masterGain) return;
        const g = this.ctx.createGain();
        g.gain.value = 0.1;
        g.connect(this.masterGain);

        const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.2, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / 400);
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.connect(g);
        g.gain.setValueAtTime(0.2, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
        src.start();
    }

    public playShoot() {
        if (!this.ctx || !this.masterGain) return;
        const g = this.ctx.createGain();
        g.gain.value = 0.15;
        g.connect(this.masterGain);

        const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.1, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / 300);
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.connect(g);
        g.gain.setValueAtTime(0.3, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);
        src.start();
    }

    public toggleMute() {
        if (!this.masterGain || !this.ctx) return;
        this.muted = !this.muted;
        this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 0.6, this.ctx.currentTime, 0.1);
        return this.muted;
    }
}
