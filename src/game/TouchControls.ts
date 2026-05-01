/**
 * TouchControls — full GTA-style mobile overlay
 *
 * Layout:
 *   Left  zone  → joystick (move on foot / steer in vehicle)
 *   Right zone  → swipe to look (on foot) / no action in vehicle
 *   Bottom-right → action buttons (FIRE, JUMP, SPRINT, F)
 *   Bottom-right → vehicle buttons (GAS ▲, BRAKE ▼) shown when in vehicle
 *   Top-centre  → horn / weapon switch strip (future use)
 */

export class TouchControls {
    // ── Public state read by Player / Vehicle / Bike ──────────────────────────
    public static moveX  = 0;   // -1…1  (joystick X)
    public static moveY  = 0;   // -1…1  (joystick Y, forward/back)
    public static lookX  = 0;   // delta px per frame
    public static lookY  = 0;
    public static jumpPressed   = false;
    public static enterPressed  = false;
    public static firePressed   = false;
    public static sprintPressed = false;
    public static gasPressed    = false;
    public static brakePressed  = false;
    public static active        = false;

    // ── Private ───────────────────────────────────────────────────────────────
    private static knobEl: HTMLElement | null    = null;
    private static joystickId: number | null     = null;
    private static joystickOrigin                = { x: 0, y: 0 };
    private static lookId: number | null         = null;
    private static lookLast                      = { x: 0, y: 0 };

    // ── Init ──────────────────────────────────────────────────────────────────
    public static init() {
        if (!('ontouchstart' in window)) return;
        this.active = true;

        // ── Inject styles ─────────────────────────────────────────────────────
        const style = document.createElement('style');
        style.textContent = `
            #tc-ui {
                position: fixed; inset: 0;
                pointer-events: none;
                z-index: 500;
                touch-action: none;
                -webkit-user-select: none;
                user-select: none;
            }

            /* ── Left joystick zone ─────────── */
            #tc-joy-zone {
                position: absolute;
                left: 0; bottom: 0;
                width: 50%; height: 55%;
                pointer-events: auto;
            }
            #tc-joy-base {
                position: absolute;
                left: 60px; bottom: 70px;
                width: 120px; height: 120px;
                border-radius: 50%;
                background: rgba(255,255,255,0.08);
                border: 2px solid rgba(255,255,255,0.25);
                display: flex; align-items: center; justify-content: center;
            }
            #tc-joy-knob {
                width: 52px; height: 52px;
                border-radius: 50%;
                background: rgba(255,255,255,0.35);
                border: 2px solid rgba(255,255,255,0.6);
                transition: transform 0.05s;
                will-change: transform;
            }

            /* ── Right look zone ─────────────── */
            #tc-look-zone {
                position: absolute;
                right: 0; top: 0;
                width: 50%; height: 60%;
                pointer-events: auto;
            }

            /* ── On-foot action buttons ──────── */
            #tc-foot-btns {
                position: absolute;
                right: 18px; bottom: 90px;
                display: flex; flex-direction: column;
                align-items: flex-end;
                gap: 10px;
                pointer-events: auto;
            }
            #tc-foot-btns .tc-row {
                display: flex; gap: 10px;
            }

            /* ── Vehicle action buttons ──────── */
            #tc-veh-btns {
                position: absolute;
                right: 18px; bottom: 80px;
                display: flex; flex-direction: column;
                align-items: flex-end;
                gap: 12px;
                pointer-events: auto;
                display: none;
            }
            #tc-veh-btns .tc-row {
                display: flex; gap: 12px;
            }

            /* ── Generic button ──────────────── */
            .tc-btn {
                width: 64px; height: 64px;
                border-radius: 50%;
                border: 2px solid rgba(255,255,255,0.35);
                background: rgba(0,0,0,0.45);
                color: #fff;
                font-size: 11px;
                font-weight: 700;
                font-family: 'Outfit', Arial, sans-serif;
                letter-spacing: 0.5px;
                text-transform: uppercase;
                display: flex; align-items: center; justify-content: center;
                -webkit-tap-highlight-color: transparent;
                cursor: pointer;
                transition: background 0.1s, transform 0.08s;
                user-select: none;
                touch-action: none;
            }
            .tc-btn:active, .tc-btn.pressed {
                background: rgba(255,255,255,0.25);
                transform: scale(0.93);
            }
            /* Colour accents */
            #tc-btn-fire   { border-color: #ff4444; color: #ff6666; font-size: 13px; width: 72px; height: 72px; }
            #tc-btn-jump   { border-color: #44aaff; color: #66ccff; }
            #tc-btn-sprint { border-color: #ffaa00; color: #ffcc44; }
            #tc-btn-enter  { border-color: #44ff88; color: #66ffaa; font-size: 10px; }
            #tc-btn-gas    { border-color: #44ff88; color: #66ffaa; font-size: 13px; width: 76px; height: 76px; }
            #tc-btn-brake  { border-color: #ff4444; color: #ff6666; font-size: 13px; width: 76px; height: 76px; }

            /* ── Enter/exit F button fixed top-left of right side ── */
            #tc-btn-enter-veh {
                position: absolute;
                right: 18px; top: 18px;
                pointer-events: auto;
            }
        `;
        document.head.appendChild(style);

        // ── Build HTML ────────────────────────────────────────────────────────
        const ui = document.createElement('div');
        ui.id = 'tc-ui';
        ui.innerHTML = `
            <div id="tc-joy-zone">
                <div id="tc-joy-base">
                    <div id="tc-joy-knob"></div>
                </div>
            </div>

            <div id="tc-look-zone"></div>

            <!-- On-foot buttons -->
            <div id="tc-foot-btns">
                <div class="tc-row">
                    <button id="tc-btn-sprint" class="tc-btn">RUN</button>
                    <button id="tc-btn-jump"   class="tc-btn">JUMP</button>
                </div>
                <div class="tc-row">
                    <button id="tc-btn-enter"  class="tc-btn">EXIT<br>CAR</button>
                    <button id="tc-btn-fire"   class="tc-btn">🔫</button>
                </div>
            </div>

            <!-- Vehicle buttons -->
            <div id="tc-veh-btns">
                <div class="tc-row">
                    <button id="tc-btn-gas"   class="tc-btn">⬆<br>GAS</button>
                    <button id="tc-btn-brake" class="tc-btn">⬇<br>BRK</button>
                </div>
                <div class="tc-row">
                    <button id="tc-btn-enter-veh" class="tc-btn" style="position:static">EXIT</button>
                </div>
            </div>
        `;
        document.body.appendChild(ui);

        // ── Joystick ──────────────────────────────────────────────────────────
        this.knobEl = document.getElementById('tc-joy-knob');
        const base  = document.getElementById('tc-joy-base')!;
        const zone  = document.getElementById('tc-joy-zone')!;

        zone.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const t = e.changedTouches[0];
            this.joystickId = t.identifier;
            const r = base.getBoundingClientRect();
            this.joystickOrigin = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        }, { passive: false });

        zone.addEventListener('touchmove', (e) => {
            e.preventDefault();
            for (const t of Array.from(e.changedTouches)) {
                if (t.identifier !== this.joystickId) continue;
                const dx   = t.clientX - this.joystickOrigin.x;
                const dy   = t.clientY - this.joystickOrigin.y;
                const MAX  = 50;
                const dist = Math.min(MAX, Math.sqrt(dx * dx + dy * dy));
                const a    = Math.atan2(dy, dx);
                const nx   = Math.cos(a) * dist;
                const ny   = Math.sin(a) * dist;
                if (this.knobEl) this.knobEl.style.transform = `translate(${nx}px,${ny}px)`;
                this.moveX =  nx / MAX;
                this.moveY =  ny / MAX;
            }
        }, { passive: false });

        zone.addEventListener('touchend', (e) => {
            for (const t of Array.from(e.changedTouches)) {
                if (t.identifier === this.joystickId) {
                    this.joystickId = null;
                    this.moveX = 0;
                    this.moveY = 0;
                    if (this.knobEl) this.knobEl.style.transform = 'translate(0,0)';
                }
            }
        }, { passive: false });

        // ── Camera look (right zone) ──────────────────────────────────────────
        const lookZone = document.getElementById('tc-look-zone')!;
        lookZone.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const t = e.changedTouches[0];
            this.lookId   = t.identifier;
            this.lookLast = { x: t.clientX, y: t.clientY };
        }, { passive: false });

        lookZone.addEventListener('touchmove', (e) => {
            e.preventDefault();
            for (const t of Array.from(e.changedTouches)) {
                if (t.identifier !== this.lookId) continue;
                this.lookX    = (t.clientX - this.lookLast.x) * 0.45;
                this.lookY    = (t.clientY - this.lookLast.y) * 0.45;
                this.lookLast = { x: t.clientX, y: t.clientY };
            }
        }, { passive: false });

        lookZone.addEventListener('touchend', () => {
            this.lookId = null;
            this.lookX  = 0;
            this.lookY  = 0;
        }, { passive: false });

        // ── Helper: bind hold-button ──────────────────────────────────────────
        const hold = (id: string, setter: (v: boolean) => void) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('touchstart', (e) => { e.preventDefault(); setter(true);  el.classList.add('pressed');    }, { passive: false });
            el.addEventListener('touchend',   (e) => { e.preventDefault(); setter(false); el.classList.remove('pressed'); }, { passive: false });
            el.addEventListener('touchcancel',() => { setter(false); el.classList.remove('pressed'); });
        };

        // ── Helper: tap-button (momentary pulse) ─────────────────────────────
        const tap = (id: string, setter: (v: boolean) => void) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('touchstart', (e) => {
                e.preventDefault();
                setter(true);
                el.classList.add('pressed');
                setTimeout(() => { setter(false); el.classList.remove('pressed'); }, 120);
            }, { passive: false });
        };

        // ── Bind on-foot buttons ──────────────────────────────────────────────
        hold('tc-btn-fire',   (v) => { this.firePressed   = v; });
        hold('tc-btn-sprint', (v) => { this.sprintPressed = v; });
        hold('tc-btn-jump',   (v) => { this.jumpPressed   = v; });
        tap ('tc-btn-enter',  (v) => { this.enterPressed  = v; });

        // ── Bind vehicle buttons ──────────────────────────────────────────────
        hold('tc-btn-gas',       (v) => { this.gasPressed   = v; });
        hold('tc-btn-brake',     (v) => { this.brakePressed = v; });
        tap ('tc-btn-enter-veh', (v) => { this.enterPressed = v; });
    }

    // ── Show vehicle vs on-foot layout ────────────────────────────────────────
    public static showVehicleControls(show: boolean) {
        const veh  = document.getElementById('tc-veh-btns');
        const foot = document.getElementById('tc-foot-btns');
        if (veh)  veh.style.display  = show ? 'flex' : 'none';
        if (foot) foot.style.display = show ? 'none' : 'flex';
    }

    // ── Called at end of each frame to reset delta look values ────────────────
    public static clearFrame() {
        this.lookX = 0;
        this.lookY = 0;
    }
}
