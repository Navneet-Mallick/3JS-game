export class TouchControls {
    public static moveX = 0;
    public static moveY = 0;
    public static lookX = 0;
    public static lookY = 0;
    public static jumpPressed  = false;
    public static enterPressed = false;
    public static firePressed  = false;
    public static sprintPressed = false;
    public static gasPressed   = false;
    public static brakePressed = false;
    public static active = false;

    private static knobEl: HTMLElement | null = null;
    private static joystickId: number | null = null;
    private static joystickOrigin = { x: 0, y: 0 };
    private static lookId: number | null = null;
    private static lookLast = { x: 0, y: 0 };

    public static init() {
        if (!('ontouchstart' in window)) return;
        this.active = true;

        const ui = document.createElement('div');
        ui.id = 'touch-ui';
        ui.innerHTML = `
            <div id="joystick-zone">
                <div id="joystick-base"><div id="joystick-knob"></div></div>
            </div>
            <div id="touch-buttons">
                <button id="btn-fire">FIRE</button>
                <button id="btn-sprint">SPRINT</button>
                <button id="btn-jump">JUMP</button>
                <button id="btn-enter">F</button>
            </div>
            <div id="vehicle-buttons" style="display:none;">
                <button id="btn-gas">GAS</button>
                <button id="btn-brake">BRAKE</button>
            </div>`;
        document.body.appendChild(ui);

        this.knobEl = document.getElementById('joystick-knob');
        const base  = document.getElementById('joystick-base')!;
        const zone  = document.getElementById('joystick-zone')!;

        zone.addEventListener('touchstart',  (e) => { e.preventDefault(); const t = e.changedTouches[0]; this.joystickId = t.identifier; const r = base.getBoundingClientRect(); this.joystickOrigin = { x: r.left + r.width/2, y: r.top + r.height/2 }; }, { passive: false });
        zone.addEventListener('touchmove',   (e) => { e.preventDefault(); for (const t of Array.from(e.changedTouches)) { if (t.identifier !== this.joystickId) continue; const dx = t.clientX - this.joystickOrigin.x; const dy = t.clientY - this.joystickOrigin.y; const dist = Math.min(40, Math.sqrt(dx*dx+dy*dy)); const a = Math.atan2(dy,dx); const nx = Math.cos(a)*dist; const ny = Math.sin(a)*dist; if (this.knobEl) this.knobEl.style.transform = `translate(${nx}px,${ny}px)`; this.moveX = nx/40; this.moveY = ny/40; } }, { passive: false });
        zone.addEventListener('touchend',    (e) => { for (const t of Array.from(e.changedTouches)) { if (t.identifier === this.joystickId) { this.joystickId = null; this.moveX = 0; this.moveY = 0; if (this.knobEl) this.knobEl.style.transform = 'translate(0,0)'; } } }, { passive: false });

        const rightZone = document.createElement('div');
        rightZone.id = 'look-zone';
        document.body.appendChild(rightZone);
        rightZone.addEventListener('touchstart',  (e) => { e.preventDefault(); const t = e.changedTouches[0]; this.lookId = t.identifier; this.lookLast = { x: t.clientX, y: t.clientY }; }, { passive: false });
        rightZone.addEventListener('touchmove',   (e) => { e.preventDefault(); for (const t of Array.from(e.changedTouches)) { if (t.identifier !== this.lookId) continue; this.lookX = (t.clientX - this.lookLast.x) * 0.4; this.lookY = (t.clientY - this.lookLast.y) * 0.4; this.lookLast = { x: t.clientX, y: t.clientY }; } }, { passive: false });
        rightZone.addEventListener('touchend',    () => { this.lookId = null; this.lookX = 0; this.lookY = 0; }, { passive: false });

        document.getElementById('btn-jump')!.addEventListener('touchstart',  () => { this.jumpPressed  = true;  }, { passive: true });
        document.getElementById('btn-jump')!.addEventListener('touchend',    () => { this.jumpPressed  = false; }, { passive: true });
        document.getElementById('btn-enter')!.addEventListener('touchstart', () => { this.enterPressed = true;  }, { passive: true });
        document.getElementById('btn-enter')!.addEventListener('touchend',   () => { this.enterPressed = false; }, { passive: true });
        document.getElementById('btn-fire')!.addEventListener('touchstart',  () => { this.firePressed  = true;  }, { passive: true });
        document.getElementById('btn-fire')!.addEventListener('touchend',    () => { this.firePressed  = false; }, { passive: true });
        document.getElementById('btn-sprint')!.addEventListener('touchstart', () => { this.sprintPressed = true;  }, { passive: true });
        document.getElementById('btn-sprint')!.addEventListener('touchend',   () => { this.sprintPressed = false; }, { passive: true });
        document.getElementById('btn-gas')!.addEventListener('touchstart',   () => { this.gasPressed   = true;  }, { passive: true });
        document.getElementById('btn-gas')!.addEventListener('touchend',     () => { this.gasPressed   = false; }, { passive: true });
        document.getElementById('btn-brake')!.addEventListener('touchstart', () => { this.brakePressed = true;  }, { passive: true });
        document.getElementById('btn-brake')!.addEventListener('touchend',   () => { this.brakePressed = false; }, { passive: true });
    }

    public static showVehicleControls(show: boolean) {
        const vehicleButtons = document.getElementById('vehicle-buttons');
        const footButtons = document.getElementById('touch-buttons');
        if (vehicleButtons) vehicleButtons.style.display = show ? 'flex' : 'none';
        if (footButtons) footButtons.style.display = show ? 'none' : 'flex';
    }

    public static clearFrame() {
        this.lookX = 0;
        this.lookY = 0;
    }
}
