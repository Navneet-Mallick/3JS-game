export class Input {
    private static keys: Record<string, boolean> = {};
    private static keyPresses: Record<string, boolean> = {};

    public static movementX = 0;
    public static movementY = 0;
    public static isPointerLocked = false;

    public static init() {
        window.addEventListener('keydown', (e) => {
            // Prevent page scroll for arrow keys and space
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

        // Use document.body as click target — always exists
        // Pointer lock will be requested on the canvas once it exists
document.addEventListener('click', () => {
    if (this.isPointerLocked) return;
    // Use document.body instead of canvas for pointer lock
    document.body.requestPointerLock();
});

// ADD THIS — keyboard works without pointer lock
document.addEventListener('keydown', (e) => {
    // already handled above, but ensure canvas is focused
    const canvas = document.querySelector('canvas');
    if (canvas && document.activeElement !== canvas) {
        canvas.setAttribute('tabindex', '0');
        canvas.focus();
    }
});

        document.addEventListener('pointerlockchange', () => {
            this.isPointerLocked = !!document.pointerLockElement;
        });

        document.addEventListener('mousemove', (e) => {
            if (this.isPointerLocked) {
                this.movementX += e.movementX || 0;
                this.movementY += e.movementY || 0;
            }
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
