export class Input {
    private static keys: Record<string, boolean> = {};
    private static keyPresses: Record<string, boolean> = {};

    public static mouseX: number = 0;
    public static mouseY: number = 0;
    public static movementX: number = 0;
    public static movementY: number = 0;
    public static isPointerLocked: boolean = false;

    public static init() {
        window.addEventListener('keydown', (e) => {
            // Prevent browser from scrolling on space/arrow keys
            if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) {
                e.preventDefault();
            }
            const key = e.key.toLowerCase();
            if (!this.keys[key]) {
                this.keyPresses[key] = true;
            }
            this.keys[key] = true;
        });

        window.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            this.keys[key] = false;
        });

        const appCanvas = document.querySelector('canvas') || document.body;

        const requestLock = () => {
            if (!this.isPointerLocked) {
                appCanvas.requestPointerLock();
            }
        };

        appCanvas.addEventListener('click', requestLock);

        const lockPrompt = document.getElementById('lock-prompt');
        if (lockPrompt) lockPrompt.addEventListener('click', requestLock);

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

    public static isKeyDown(key: string): boolean {
        return !!this.keys[key.toLowerCase()];
    }

    public static isKeyPressed(key: string): boolean {
        return !!this.keyPresses[key.toLowerCase()];
    }

    public static clearPerFrameData() {
        this.keyPresses = {};
        this.movementX = 0;
        this.movementY = 0;
    }
}
