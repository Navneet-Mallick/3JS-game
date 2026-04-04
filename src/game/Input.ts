export class Input {
    private static keys:      Record<string, boolean> = {};
    private static keyPresses: Record<string, boolean> = {};

    public static movementX       = 0;
    public static movementY       = 0;
    public static isPointerLocked = false;

    public static init() {
        // ── Keyboard ──────────────────────────────────────────────────────────
        window.addEventListener('keydown', (e) => {
            // Prevent page scroll for game keys
            if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) {
                e.preventDefault();
            }
            const key = e.key.toLowerCase();
            if (!this.keys[key]) this.keyPresses[key] = true;
            this.keys[key] = true;
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });

        // ── Pointer lock ──────────────────────────────────────────────────────
        document.addEventListener('click', () => {
            if (!this.isPointerLocked) document.body.requestPointerLock();
        });

        document.addEventListener('pointerlockchange', () => {
            this.isPointerLocked = !!document.pointerLockElement;
        });

        // ── Mouse look ────────────────────────────────────────────────────────
        // Works WITH pointer lock (raw delta) AND without (relative movement)
        document.addEventListener('mousemove', (e) => {
            if (this.isPointerLocked) {
                // Pointer locked — use raw movementX/Y (no cursor boundary issues)
                this.movementX += e.movementX || 0;
                this.movementY += e.movementY || 0;
            }
            // Without pointer lock mouse look is disabled (cursor visible)
            // Player can still use keyboard to move
        });
    }

    public static isKeyDown(key: string)    { return !!this.keys[key.toLowerCase()]; }
    public static isKeyPressed(key: string) { return !!this.keyPresses[key.toLowerCase()]; }

    public static clearPerFrameData() {
        this.keyPresses = {};
        this.movementX  = 0;
        this.movementY  = 0;
    }
}
