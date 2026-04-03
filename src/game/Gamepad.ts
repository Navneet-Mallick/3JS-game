/**
 * Gamepad support — maps standard gamepad axes/buttons to game actions
 * Works alongside keyboard input
 */
export class GamepadInput {
    private static pad: Gamepad | null = null;

    // Exposed axes / buttons (read each frame)
    public static leftX  = 0;   // left stick horizontal
    public static leftY  = 0;   // left stick vertical
    public static rightX = 0;   // right stick horizontal
    public static rightY = 0;   // right stick vertical
    public static rt     = 0;   // right trigger (accelerate)
    public static lt     = 0;   // left trigger (brake/reverse)
    public static btnA   = false; // A / Cross
    public static btnB   = false; // B / Circle
    public static btnX   = false; // X / Square
    public static btnY   = false; // Y / Triangle
    public static btnLB  = false; // left bumper (handbrake)
    public static connected = false;

    private static prevBtnA = false;
    private static prevBtnX = false;

    public static init() {
        window.addEventListener('gamepadconnected',    (e) => { this.pad = (e as GamepadEvent).gamepad; this.connected = true; });
        window.addEventListener('gamepaddisconnected', ()  => { this.pad = null; this.connected = false; });
    }

    public static poll() {
        // Re-fetch each frame (required by spec)
        const pads = navigator.getGamepads();
        if (pads[0]) this.pad = pads[0];
        if (!this.pad) return;

        const axes    = this.pad.axes;
        const buttons = this.pad.buttons;

        this.leftX  = Math.abs(axes[0] ?? 0) > 0.12 ? (axes[0] ?? 0) : 0;
        this.leftY  = Math.abs(axes[1] ?? 0) > 0.12 ? (axes[1] ?? 0) : 0;
        this.rightX = Math.abs(axes[2] ?? 0) > 0.12 ? (axes[2] ?? 0) : 0;
        this.rightY = Math.abs(axes[3] ?? 0) > 0.12 ? (axes[3] ?? 0) : 0;

        this.rt  = buttons[7]?.value ?? 0;
        this.lt  = buttons[6]?.value ?? 0;

        this.prevBtnA = this.btnA;
        this.prevBtnX = this.btnX;

        this.btnA  = !!(buttons[0]?.pressed);
        this.btnB  = !!(buttons[1]?.pressed);
        this.btnX  = !!(buttons[2]?.pressed);
        this.btnY  = !!(buttons[3]?.pressed);
        this.btnLB = !!(buttons[4]?.pressed);
    }

    /** True only on the frame the button was pressed */
    public static btnAPressed()  { return this.btnA  && !this.prevBtnA; }
    public static btnXPressed()  { return this.btnX  && !this.prevBtnX; }
}
