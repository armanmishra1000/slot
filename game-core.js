// --- SYMBOLS & CANVAS SETUP ---
export const SYMBOLS = [
    { name: "Ruby", color: "#ff225a", service: "Netflix", draw: drawRuby },
    { name: "Emerald", color: "#22df71", service: "Spotify", draw: drawEmerald },
    { name: "Sapphire", color: "#229aff", service: "YouTube Premium", draw: drawSapphire },
    { name: "Amethyst", color: "#af4ee7", service: null, draw: drawAmethyst },
    { name: "Coin", color: "#ffe45c", service: "Credits", draw: drawCoin }
];
export const SERVICE_MAPPING = {
    Ruby: "Netflix",
    Emerald: "Spotify",
    Sapphire: "YouTube Premium",
    Coin: "Credits",
    Amethyst: null
};
export const REEL_SYMBOL_DISTRIBUTION = [0,1,2,3,4,4,4,3,3,2,1,0,4,4,2,3,1,2,0,2];
export const PAYLINES = [
    [[0,0],[1,0],[2,0],[3,0],[4,0]], [[0,1],[1,1],[2,1],[3,1],[4,1]], [[0,2],[1,2],[2,2],[3,2],[4,2]],
    [[0,0],[1,1],[2,2],[3,1],[4,0]], [[0,2],[1,1],[2,0],[3,1],[4,2]],
    [[0,0],[1,0],[2,1],[3,2],[4,2]], [[0,2],[1,2],[2,1],[3,0],[4,0]],
    [[0,1],[1,2],[2,2],[3,2],[4,1]], [[0,1],[1,0],[2,0],[3,0],[4,1]], [[0,2],[1,1],[2,1],[3,1],[4,0]],
];
export const REELS = 5, ROWS = 3;
export const CANVAS_W = 600, CANVAS_H = 360;
export const P = 15, DIVIDER_W = 2;
export const REEL_W = (CANVAS_W - 2 * P - (REELS - 1) * DIVIDER_W) / REELS;
export const SYMBOL_H = (CANVAS_H - 2 * P) / ROWS;
export const SPIN_Y_OFFSET = P;

export let reels = [];
export let winLines = [];
export let winningSymbols = [];
export function clearWinLines() { winLines.length = 0; }
export function clearWinningSymbols() { winningSymbols.length = 0; }

// --- STATE THAT NEEDS GETTER/SETTER ---
let animating = false;
export function setAnimating(val) { animating = val; }
export function getAnimating() { return animating; }

// --- SYMBOL DRAWING ---
export function drawRuby(ctx) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(32, 4); ctx.lineTo(60,22); ctx.lineTo(52,56); ctx.lineTo(12,56); ctx.lineTo(4,22); ctx.closePath();
    ctx.fillStyle = "#ff2969";
    ctx.shadowColor = "#ff8abc"; ctx.shadowBlur = 16;
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(32, 8); ctx.lineTo(56,22); ctx.lineTo(48,52); ctx.lineTo(16,52); ctx.lineTo(8,22); ctx.closePath();
    ctx.fillStyle = "#f44";
    ctx.globalAlpha = 0.7;
    ctx.fill();
    ctx.restore();
}
export function drawEmerald(ctx) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(32,4); ctx.lineTo(60,32); ctx.lineTo(32,60); ctx.lineTo(4,32); ctx.closePath();
    ctx.fillStyle = "#27ff89";
    ctx.shadowColor = "#9fffcd"; ctx.shadowBlur = 16;
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(32,8); ctx.lineTo(56,32); ctx.lineTo(32,56); ctx.lineTo(8,32); ctx.closePath();
    ctx.fillStyle = "#158f49";
    ctx.globalAlpha = 0.7;
    ctx.fill();
    ctx.restore();
}
export function drawSapphire(ctx) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(32, 32, 28, 0, Math.PI * 2);
    ctx.fillStyle = "#25a1ef";
    ctx.shadowColor = "#a0e3ff"; ctx.shadowBlur = 15;
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.arc(32, 32, 19, 0, Math.PI * 2);
    ctx.fillStyle = "#174ca6";
    ctx.globalAlpha = 0.45;
    ctx.fill();
    ctx.restore();
}
export function drawAmethyst(ctx) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(32, 6); ctx.lineTo(52, 32); ctx.lineTo(32, 58); ctx.lineTo(12, 32); ctx.closePath();
    ctx.fillStyle = "#af4ee7";
    ctx.shadowColor = "#c497ff"; ctx.shadowBlur = 12;
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(32, 14); ctx.lineTo(46, 32); ctx.lineTo(32, 50); ctx.lineTo(18, 32); ctx.closePath();
    ctx.fillStyle = "#4d1859";
    ctx.globalAlpha = 0.6;
    ctx.fill();
    ctx.restore();
}
export function drawCoin(ctx) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(32,32,28,0,2*Math.PI);
    ctx.fillStyle = "#ffe45c";
    ctx.shadowColor = "#fff5c0"; ctx.shadowBlur = 12;
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.arc(32,32,19,0,2*Math.PI);
    ctx.fillStyle = "#c7ad23";
    ctx.globalAlpha = 0.75;
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.arc(41,25,7,Math.PI*0.5,Math.PI*1.5);
    ctx.strokeStyle = "#fff";
    ctx.globalAlpha = 0.16;
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.restore();
}

// --- REEL AND RENDER LOGIC ---
export function initReels(randSymbol) {
    reels = [];
    for (let i = 0; i < REELS; i++) {
        const symbols = [];
        for (let j = 0; j < ROWS; j++) symbols.push(randSymbol());
        reels.push({ symbols, animY: 0, spinning: false, targetSymbols: null, momentum: 0 });
    }
}

export function renderReels(ctx) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    for (let i = 0; i < REELS; i++) {
        const reel = reels[i];
        for (let j = 0; j < ROWS + 1; j++) {
            const cell_base_x = P + i * (REEL_W + DIVIDER_W);
            const cell_base_y = P + (j * SYMBOL_H) - reel.animY;
            const symbolIdx = reel.symbols[j % ROWS];
            const symbolObj = SYMBOLS[symbolIdx];
            ctx.save();
            ctx.translate(cell_base_x, cell_base_y);
            const s = Math.min(REEL_W / 64, SYMBOL_H / 64) * 0.9;
            ctx.translate((REEL_W - (64 * s)) / 2, (SYMBOL_H - (64 * s)) / 2);
            ctx.scale(s, s);
            symbolObj.draw(ctx);
            ctx.restore();
        }
        if (i < REELS - 1) {
            const divider_x = P + (i * (REEL_W + DIVIDER_W)) + REEL_W + (DIVIDER_W / 2);
            ctx.save();
            ctx.strokeStyle = '#8A652D';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(divider_x, P);
            ctx.lineTo(divider_x, CANVAS_H - P);
            ctx.stroke();
            ctx.restore();
        }
    }
}

// --- SPIN LOGIC ---
export function spinReel(reel, targetSymbols, cb, randSymbol, renderReels) {
    reel.spinning = true;
    reel.targetSymbols = targetSymbols;
    reel.animY = 0;
    reel.momentum = 30 + Math.random()*6;
    let spinSteps = 28 + Math.floor(Math.random()*7), steps = 0;
    function animate() {
        if (steps < spinSteps) {
            reel.animY += reel.momentum;
            if (reel.animY >= SYMBOL_H) {
                reel.animY = 0; reel.symbols.pop(); reel.symbols.unshift(randSymbol());
            }
            if (reel.momentum > 7) reel.momentum *= 0.98;
            steps++; renderReels();
            requestAnimationFrame(animate);
        } else {
            reel.symbols = [...targetSymbols];
            reel.animY = 0; reel.spinning = false;
            renderReels();
            if (cb) cb();
        }
    }
    animate();
}

export function randSymbol() {
    return REEL_SYMBOL_DISTRIBUTION[Math.floor(Math.random()*REEL_SYMBOL_DISTRIBUTION.length)];
}