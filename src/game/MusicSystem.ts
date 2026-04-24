/**
 * Music System - Plays background music like GTA Vice City
 * Supports multiple tracks that can be switched
 */
export class MusicSystem {
    private currentTrack: HTMLAudioElement | null = null;
    private tracks: { [key: string]: string } = {
        'demons': '/demons_phonk.mp3',
        'eagles': '/eagles.mp3',
        'keepers': '/Keepers_of_the_Flame.mp3'
    };
    private currentTrackName: string = '';
    private volume: number = 0.3;
    private isPlaying: boolean = false;

    constructor() {
        this.initAudio();
    }

    private initAudio() {
        // Create audio element
        const audio = document.createElement('audio');
        audio.loop = true;
        audio.volume = this.volume;
        document.body.appendChild(audio);
        this.currentTrack = audio;
    }

    public playTrack(trackName: string) {
        const trackPath = this.tracks[trackName.toLowerCase()];
        if (!trackPath) {
            console.warn(`Track not found: ${trackName}`);
            return;
        }

        if (this.currentTrack) {
            this.currentTrack.pause();
            this.currentTrack.currentTime = 0;
            this.currentTrack.src = trackPath;
            
            // Try to play
            const playPromise = this.currentTrack.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.warn('Audio playback failed:', error);
                });
            }
            
            this.isPlaying = true;
            this.currentTrackName = trackName;
        }
    }

    public stopMusic() {
        if (this.currentTrack) {
            this.currentTrack.pause();
            this.currentTrack.currentTime = 0;
            this.isPlaying = false;
        }
    }

    public setVolume(vol: number) {
        this.volume = Math.max(0, Math.min(1, vol));
        if (this.currentTrack) {
            this.currentTrack.volume = this.volume;
        }
    }

    public getVolume(): number {
        return this.volume;
    }

    public getCurrentTrack(): string {
        return this.currentTrackName;
    }

    public isPlayingStatus(): boolean {
        return this.isPlaying;
    }

    public nextTrack() {
        const trackNames = Object.keys(this.tracks);
        const currentIndex = trackNames.indexOf(this.currentTrackName);
        const nextIndex = (currentIndex + 1) % trackNames.length;
        this.playTrack(trackNames[nextIndex]);
    }

    public previousTrack() {
        const trackNames = Object.keys(this.tracks);
        const currentIndex = trackNames.indexOf(this.currentTrackName);
        const prevIndex = (currentIndex - 1 + trackNames.length) % trackNames.length;
        this.playTrack(trackNames[prevIndex]);
    }
}
