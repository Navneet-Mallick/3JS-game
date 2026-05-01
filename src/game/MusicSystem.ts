/**
 * MusicSystem — GTA-style radio with fade crossfade, auto-advance,
 * and deferred play (browser autoplay policy safe).
 */
export class MusicSystem {
    private audio1: HTMLAudioElement;
    private audio2: HTMLAudioElement;
    private active: HTMLAudioElement;   // currently audible element
    private passive: HTMLAudioElement;  // being prepared / fading out

    private tracks: Record<string, string> = {
        demons:  '/demons_phonk.mp3',
        eagles:  '/eagles.mp3',
        keepers: '/Keepers_of_the_Flame.mp3',
    };
    private trackNames: string[] = ['demons', 'eagles', 'keepers'];
    private currentIndex = 0;
    private volume = 0.28;
    private muted  = false;

    // Fade state
    private fadeTimer   = 0;
    private fadeDur     = 1.5;   // seconds
    private isFading    = false;
    private fadeTarget  = 0;     // volume the active track fades TO

    constructor() {
        this.audio1 = this.makeEl();
        this.audio2 = this.makeEl();
        this.active  = this.audio1;
        this.passive = this.audio2;

        // Auto-advance to next track when one ends
        this.audio1.addEventListener('ended', () => this.nextTrack());
        this.audio2.addEventListener('ended', () => this.nextTrack());
    }

    private makeEl(): HTMLAudioElement {
        const a = document.createElement('audio');
        a.volume    = 0;
        a.preload   = 'auto';
        document.body.appendChild(a);
        return a;
    }

    /** Call once user has interacted (pointer-lock or button click) */
    public start() {
        const idx = Math.floor(Math.random() * this.trackNames.length);
        this.currentIndex = idx;
        this._play(this.active, this.trackNames[idx], true);
    }

    private _play(el: HTMLAudioElement, name: string, immediate: boolean) {
        const path = this.tracks[name];
        if (!path) return;
        el.src  = path;
        el.loop = false;
        el.volume = immediate ? (this.muted ? 0 : this.volume) : 0;
        el.play().catch(() => {/* blocked — user hasn't interacted yet */});
    }

    public playTrack(name: string) {
        const idx = this.trackNames.indexOf(name);
        if (idx < 0) return;
        this.currentIndex = idx;
        this._crossfade(name);
    }

    public nextTrack() {
        this.currentIndex = (this.currentIndex + 1) % this.trackNames.length;
        this._crossfade(this.trackNames[this.currentIndex]);
    }

    public previousTrack() {
        this.currentIndex = (this.currentIndex - 1 + this.trackNames.length) % this.trackNames.length;
        this._crossfade(this.trackNames[this.currentIndex]);
    }

    private _crossfade(name: string) {
        // Swap roles
        const tmp    = this.passive;
        this.passive = this.active;
        this.active  = tmp;

        this._play(this.active, name, false);

        // Fade out passive, fade in active
        this.isFading  = true;
        this.fadeTimer = 0;
    }

    /** Must be called every game frame from Core.animate */
    public update(dt: number) {
        if (!this.isFading) return;
        this.fadeTimer += dt;
        const t = Math.min(1, this.fadeTimer / this.fadeDur);

        const targetVol = this.muted ? 0 : this.volume;
        this.active.volume  = t * targetVol;
        this.passive.volume = (1 - t) * targetVol;

        if (t >= 1) {
            this.passive.pause();
            this.passive.src = '';
            this.isFading = false;
        }
    }

    public setVolume(v: number) {
        this.volume = Math.max(0, Math.min(1, v));
        if (!this.isFading) this.active.volume = this.muted ? 0 : this.volume;
    }
    public getVolume()       { return this.volume; }
    public getCurrentTrack() { return this.trackNames[this.currentIndex]; }
    public setMuted(m: boolean) {
        this.muted = m;
        this.active.volume  = m ? 0 : this.volume;
        this.passive.volume = 0;
    }
    public toggleMute() { this.setMuted(!this.muted); }
}
