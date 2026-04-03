/**
 * Sound – procedural Web Audio engine (no asset files needed)
 * Generates engine hum, footsteps, collision thuds, ambient city noise
 */
export class Sound {
    private ctx: AudioContext | null = null;
    private engineGain: GainNode | null = null;
    private engineOsc: OscillatorNode | null = null;
    private engineOsc2: OscillatorNode | null = null;
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

    private startAmbient() {
        if (!this.ctx || !this.masterGain) return;
        this.ambientGain = this.ctx.createGain();
        this.ambientGain.gain.value = 0.04;
        this.ambientGain.connect(this.masterGain);

        // Low city rumble
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
    }

    public startEngine() {
        if (!this.ctx || !this.masterGain || this.engineOsc) return;
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;
        this.engineGain.connect(this.masterGain);

        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.value = 60;

        this.engineOsc2 = this.ctx.createOscillator();
        this.engineOsc2.type = 'square';
        this.engineOsc2.frequency.value = 62;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 400;

        this.engineOsc.connect(filter);
        this.engineOsc2.connect(filter);
        filter.connect(this.engineGain);

        this.engineOsc.start();
        this.engineOsc2.start();

        this.engineGain.gain.setTargetAtTime(0.18, this.ctx.currentTime, 0.3);
    }

    public stopEngine() {
        if (!this.ctx || !this.engineGain) return;
        this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4);
        setTimeout(() => {
            this.engineOsc?.stop();
            this.engineOsc2?.stop();
            this.engineOsc = null;
            this.engineOsc2 = null;
            this.engineGain = null;
        }, 800);
    }

    public updateEngine(speedKmh: number, throttle: boolean) {
        if (!this.ctx || !this.engineOsc || !this.engineOsc2 || !this.engineGain) return;
        const rpm = 60 + speedKmh * 1.4 + (throttle ? 20 : 0);
        const t = this.ctx.currentTime;
        this.engineOsc.frequency.setTargetAtTime(rpm, t, 0.08);
        this.engineOsc2.frequency.setTargetAtTime(rpm * 1.01, t, 0.08);
        const vol = throttle ? 0.22 : 0.12;
        this.engineGain.gain.setTargetAtTime(vol, t, 0.1);
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
        src.start();
    }

    public playPickup() {
        this.ensureAudioContext();
        if (!this.ctx || !this.masterGain) return;
        const g = this.ctx.createGain();
        g.gain.value = 0.3;
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
        this.ensureAudioContext();
        if (!this.ctx || !this.masterGain) return;
        const g = this.ctx.createGain();
        g.gain.value = 0.4;
        g.connect(this.masterGain);
        
        // White noise for explosion
        const bufferSize = this.ctx.sampleRate * 0.3;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        const src = this.ctx.createBufferSource();
        src.buffer = buffer;
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 200;
        src.connect(f);
        f.connect(g);
        g.gain.setValueAtTime(0.4, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
        src.start();
    }

    public resume() {
        this.ctx?.resume();
    }

    public toggleMute() {
        if (!this.masterGain || !this.ctx) return;
        this.muted = !this.muted;
        this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 0.6, this.ctx.currentTime, 0.1);
        return this.muted;
    }
}
