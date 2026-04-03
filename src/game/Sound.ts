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
    
    // Radio/BGM System
    private bgmGain: GainNode | null = null;
    private currentStation: number = 0;
    private bgmOscillators: OscillatorNode[] = [];
    private isRadioOn = false;
    private radioVolume = 0.3;

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
        
        // Initialize BGM system
        this.initBGMSystem();
    }

    private initBGMSystem() {
        if (!this.ctx || !this.masterGain) return;
        
        this.bgmGain = this.ctx.createGain();
        this.bgmGain.gain.value = 0;
        this.bgmGain.connect(this.masterGain);
        
        // Don't start BGM automatically - wait for user interaction
        console.log('🎵 Radio system initialized - Press Home to start music');
    }

    // Radio Stations - 3 Actual Songs
    private readonly radioStations = [
        {
            name: "Neo-Noir FM",
            type: "synthwave",
            description: "Midnight City - Synthwave Anthem",
            tempo: 120,
            key: "C minor",
            melody: [
                { note: 261.63, duration: 0.5 }, // C4
                { note: 311.13, duration: 0.5 }, // Eb4
                { note: 369.99, duration: 1.0 }, // F4
                { note: 311.13, duration: 0.5 }, // Eb4
                { note: 261.63, duration: 0.5 }, // C4
                { note: 349.23, duration: 1.0 }, // F4
                { note: 311.13, duration: 0.5 }, // Eb4
                { note: 261.63, duration: 1.5 }  // C4
            ],
            bass: [
                { note: 130.81, duration: 1.0 }, // C3
                { note: 130.81, duration: 1.0 }, // C3
                { note: 155.56, duration: 1.0 }, // Eb3
                { note: 130.81, duration: 1.0 }  // C3
            ],
            waveform: "sawtooth" as OscillatorType
        },
        {
            name: "City Beats 98.5",
            type: "electronic",
            description: "Urban Dreams - Electronic Journey",
            tempo: 128,
            key: "G minor",
            melody: [
                { note: 392.00, duration: 0.25 }, // G4
                { note: 466.16, duration: 0.25 }, // Bb4
                { note: 523.25, duration: 0.5 },  // C5
                { note: 466.16, duration: 0.25 }, // Bb4
                { note: 392.00, duration: 0.5 },  // G4
                { note: 349.23, duration: 0.5 },  // F4
                { note: 392.00, duration: 1.0 }   // G4
            ],
            bass: [
                { note: 196.00, duration: 0.5 }, // G3
                { note: 233.08, duration: 0.5 }, // Bb3
                { note: 196.00, duration: 0.5 }, // G3
                { note: 174.61, duration: 0.5 }  // F3
            ],
            waveform: "square" as OscillatorType
        },
        {
            name: "Rock Radio 101",
            type: "rock",
            description: "Highway Thunder - Rock Anthem",
            tempo: 140,
            key: "E minor",
            melody: [
                { note: 329.63, duration: 0.33 }, // E4
                { note: 329.63, duration: 0.33 }, // E4
                { note: 392.00, duration: 0.33 }, // G4
                { note: 329.63, duration: 0.33 }, // E4
                { note: 392.00, duration: 0.33 }, // G4
                { note: 440.00, duration: 0.33 }, // A4
                { note: 392.00, duration: 0.33 }, // G4
                { note: 329.63, duration: 0.66 }  // E4
            ],
            bass: [
                { note: 164.81, duration: 0.5 }, // E3
                { note: 164.81, duration: 0.5 }, // E3
                { note: 196.00, duration: 0.5 }, // G3
                { note: 164.81, duration: 0.5 }  // E3
            ],
            waveform: "sawtooth" as OscillatorType
        }
    ];

    public startBGM() {
        if (!this.ctx || !this.bgmGain) return;
        
        this.stopBGM(); // Clear any existing BGM
        
        const station = this.radioStations[this.currentStation];
        this.isRadioOn = true;
        
        // Start continuous music loop
        this.startSongLoop(station);
        
        // Fade in
        this.bgmGain.gain.setTargetAtTime(this.radioVolume, this.ctx.currentTime, 1.0);
        
        console.log(`🎵 Now playing: ${station.name} - ${station.description}`);
    }

    private startSongLoop(station: any) {
        if (!this.ctx || !this.bgmGain) return;
        
        // Clear any existing interval
        if ((this as any).songLoopInterval) {
            clearInterval((this as any).songLoopInterval);
            (this as any).songLoopInterval = null;
        }
        
        const songDuration = 4; // 4 seconds per loop
        const loopInterval = setInterval(() => {
            if (!this.isRadioOn || !(this as any).songLoopInterval) {
                clearInterval(loopInterval);
                return;
            }
            
            // Create a new iteration of the song
            this.createDrums(station.tempo);
            this.createBassLine(station.bass, station.tempo, station.waveform);
            this.createMelody(station.melody, station.tempo, station.waveform);
        }, songDuration * 1000);
        
        // Store interval ID for cleanup
        (this as any).songLoopInterval = loopInterval;
    }

    private createDrums(tempo: number) {
        if (!this.ctx || !this.bgmGain) return;
        
        const beatDuration = 60 / tempo;
        
        // Kick drum
        const kickOsc = this.ctx.createOscillator();
        const kickGain = this.ctx.createGain();
        const kickFilter = this.ctx.createBiquadFilter();
        
        kickOsc.type = 'sine';
        kickOsc.frequency.setValueAtTime(60, this.ctx.currentTime);
        
        kickFilter.type = 'lowpass';
        kickFilter.frequency.value = 100;
        kickFilter.Q.value = 1;
        
        kickGain.gain.setValueAtTime(0, this.ctx.currentTime);
        kickGain.gain.linearRampToValueAtTime(0.8, this.ctx.currentTime + 0.01);
        kickGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.1);
        
        kickOsc.connect(kickFilter);
        kickFilter.connect(kickGain);
        kickGain.connect(this.bgmGain);
        
        kickOsc.start(this.ctx.currentTime);
        kickOsc.stop(this.ctx.currentTime + 0.1);
        
        this.bgmOscillators.push(kickOsc);
        
        // Hi-hat
        const hihatOsc = this.ctx.createOscillator();
        const hihatGain = this.ctx.createGain();
        const hihatFilter = this.ctx.createBiquadFilter();
        
        hihatOsc.type = 'square';
        hihatOsc.frequency.setValueAtTime(800, this.ctx.currentTime);
        
        hihatFilter.type = 'highpass';
        hihatFilter.frequency.value = 5000;
        hihatFilter.Q.value = 1;
        
        hihatGain.gain.setValueAtTime(0, this.ctx.currentTime);
        hihatGain.gain.linearRampToValueAtTime(0.1, this.ctx.currentTime + 0.01);
        hihatGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.05);
        
        hihatOsc.connect(hihatFilter);
        hihatFilter.connect(hihatGain);
        hihatGain.connect(this.bgmGain);
        
        hihatOsc.start(this.ctx.currentTime + beatDuration * 0.5);
        hihatOsc.stop(this.ctx.currentTime + beatDuration * 0.5 + 0.05);
        
        this.bgmOscillators.push(hihatOsc);
    }

    private createBassLine(bassNotes: { note: number; duration: number }[], tempo: number, waveform: OscillatorType) {
        if (!this.ctx || !this.bgmGain) return;
        
        const beatDuration = 60 / tempo;
        let currentTime = this.ctx.currentTime;
        
        bassNotes.forEach((note, index) => {
            const bassOsc = this.ctx!.createOscillator();
            const bassGain = this.ctx!.createGain();
            const bassFilter = this.ctx!.createBiquadFilter();
            
            bassOsc.type = waveform;
            bassOsc.frequency.setValueAtTime(note.note, currentTime);
            
            bassFilter.type = 'lowpass';
            bassFilter.frequency.value = 500;
            bassFilter.Q.value = 1;
            
            bassGain.gain.setValueAtTime(0, currentTime);
            bassGain.gain.linearRampToValueAtTime(0.3, currentTime + 0.01);
            bassGain.gain.linearRampToValueAtTime(0, currentTime + note.duration * 0.8);
            
            bassOsc.connect(bassFilter);
            bassFilter.connect(bassGain);
            bassGain.connect(this.bgmGain!);
            
            bassOsc.start(currentTime);
            bassOsc.stop(currentTime + note.duration);
            
            this.bgmOscillators.push(bassOsc);
            
            currentTime += note.duration;
        });
    }

    private createMelody(melodyNotes: { note: number; duration: number }[], tempo: number, waveform: OscillatorType) {
        if (!this.ctx || !this.bgmGain) return;
        
        const beatDuration = 60 / tempo;
        let currentTime = this.ctx.currentTime;
        
        melodyNotes.forEach((note, index) => {
            const melodyOsc = this.ctx!.createOscillator();
            const melodyGain = this.ctx!.createGain();
            const melodyFilter = this.ctx!.createBiquadFilter();
            
            melodyOsc.type = waveform;
            melodyOsc.frequency.setValueAtTime(note.note, currentTime);
            
            melodyFilter.type = 'lowpass';
            melodyFilter.frequency.value = 2000;
            melodyFilter.Q.value = 2;
            
            melodyGain.gain.setValueAtTime(0, currentTime);
            melodyGain.gain.linearRampToValueAtTime(0.2, currentTime + 0.01);
            melodyGain.gain.linearRampToValueAtTime(0.1, currentTime + note.duration * 0.5);
            melodyGain.gain.linearRampToValueAtTime(0, currentTime + note.duration * 0.9);
            
            melodyOsc.connect(melodyFilter);
            melodyFilter.connect(melodyGain);
            melodyGain.connect(this.bgmGain!);
            
            melodyOsc.start(currentTime);
            melodyOsc.stop(currentTime + note.duration);
            
            this.bgmOscillators.push(melodyOsc);
            
            currentTime += note.duration;
        });
    }

    public stopBGM() {
        if (!this.bgmGain) return;
        
        // Clear song loop interval
        if ((this as any).songLoopInterval) {
            clearInterval((this as any).songLoopInterval);
            (this as any).songLoopInterval = null;
        }
        
        // Fade out
        this.bgmGain.gain.setTargetAtTime(0, this.ctx!.currentTime, 0.5);
        
        // Stop all oscillators
        this.bgmOscillators.forEach(osc => {
            try {
                osc.stop();
            } catch (e) {
                // Oscillator might already be stopped
            }
        });
        
        this.bgmOscillators = [];
        this.isRadioOn = false;
    }

    public nextRadioStation() {
        this.currentStation = (this.currentStation + 1) % this.radioStations.length;
        if (this.isRadioOn) {
            this.startBGM();
        }
    }

    public previousRadioStation() {
        this.currentStation = (this.currentStation - 1 + this.radioStations.length) % this.radioStations.length;
        if (this.isRadioOn) {
            this.startBGM();
        }
    }

    public toggleRadio() {
        if (this.isRadioOn) {
            this.stopBGM();
            console.log('🔇 Radio OFF');
        } else {
            this.startBGM();
            console.log('🔊 Radio ON');
        }
    }

    public getCurrentStation() {
        return this.radioStations[this.currentStation];
    }

    public setRadioVolume(volume: number) {
        this.radioVolume = Math.max(0, Math.min(1, volume));
        if (this.bgmGain && this.isRadioOn) {
            this.bgmGain.gain.setTargetAtTime(this.radioVolume, this.ctx!.currentTime, 0.3);
        }
    }

    public getRadioVolume(): number {
        return this.radioVolume;
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

    public playPowerUp() {
        this.ensureAudioContext();
        if (!this.ctx || !this.masterGain) return;
        const g = this.ctx.createGain();
        g.gain.value = 0.3;
        g.connect(this.masterGain);
        
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1600, this.ctx.currentTime + 0.2);
        osc.connect(g);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);
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

    public toggleMute() {
        if (!this.masterGain || !this.ctx) return;
        this.muted = !this.muted;
        this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 0.6, this.ctx.currentTime, 0.1);
        return this.muted;
    }
}
