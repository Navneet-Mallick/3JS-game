import * as THREE from 'three';

const BLOCK  = 60;
const ROAD   = 18;
const STEP   = BLOCK + ROAD;
const EXTENT = 3;

export class Minimap {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private readonly SIZE = 160;
    private readonly SCALE = 0.6; // world units per pixel

    constructor(canvasId: string) {
        this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        this.canvas.width  = this.SIZE;
        this.canvas.height = this.SIZE;
        this.ctx = this.canvas.getContext('2d')!;
    }

    public update(playerPos: THREE.Vector3) {
        const { ctx, SIZE, SCALE } = this;
        ctx.clearRect(0, 0, SIZE, SIZE);

        // Background
        ctx.fillStyle = 'rgba(5,5,15,0.85)';
        ctx.fillRect(0, 0, SIZE, SIZE);

        const cx = SIZE / 2;
        const cy = SIZE / 2;

        const toScreen = (wx: number, wz: number) => ({
            x: cx + (wx - playerPos.x) * SCALE,
            y: cy + (wz - playerPos.z) * SCALE,
        });

        // Draw roads
        ctx.fillStyle = '#1a1a1a';
        for (let i = -EXTENT; i <= EXTENT + 1; i++) {
            const z = i * STEP - STEP / 2;
            const half = ((EXTENT * 2 + 1) * STEP) / 2 + ROAD;

            // Horizontal
            const h0 = toScreen(-half, z - ROAD / 2);
            ctx.fillRect(h0.x, h0.y, half * 2 * SCALE, ROAD * SCALE);

            // Vertical
            const v0 = toScreen(z - ROAD / 2, -half);
            ctx.fillRect(v0.x, v0.y, ROAD * SCALE, half * 2 * SCALE);
        }

        // Road center lines
        ctx.strokeStyle = 'rgba(255,200,0,0.5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4 * SCALE, 4 * SCALE]);
        for (let i = -EXTENT; i <= EXTENT + 1; i++) {
            const pos = i * STEP - STEP / 2;
            const half = ((EXTENT * 2 + 1) * STEP) / 2 + ROAD;

            ctx.beginPath();
            const h = toScreen(-half, pos);
            ctx.moveTo(h.x, h.y);
            ctx.lineTo(h.x + half * 2 * SCALE, h.y);
            ctx.stroke();

            ctx.beginPath();
            const v = toScreen(pos, -half);
            ctx.moveTo(v.x, v.y);
            ctx.lineTo(v.x, v.y + half * 2 * SCALE);
            ctx.stroke();
        }
        ctx.setLineDash([]);

        // Player arrow
        ctx.save();
        ctx.translate(cx, cy);
        ctx.fillStyle = '#ff0055';
        ctx.beginPath();
        ctx.moveTo(0, -7);
        ctx.lineTo(5, 5);
        ctx.lineTo(0, 2);
        ctx.lineTo(-5, 5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
}
