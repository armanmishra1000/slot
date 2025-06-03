export const STORAGE_KEY = "premiumSlotState";
export const bet = 10;
export const BONUS_INTERVAL = 24*60*60*1000; // 24h

export function loadState() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            let parsed = JSON.parse(saved);
            if (typeof parsed.credits !== "number" || parsed.credits < 0) parsed.credits = 500;
            if (!parsed.lastBonus) parsed.lastBonus = 0;
            if (!parsed.streak) parsed.streak = 0;
            return parsed;
        }
    } catch {}
    return { credits: 500, lastWin: 0, streak: 0, lastBonus: 0 };
}
export function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
export function canClaimBonus(lastBonus) {
    return (!lastBonus || (Date.now() - lastBonus >= BONUS_INTERVAL));
}
export function formatTimer(ms) {
    let h = Math.floor(ms/3600000);
    let m = Math.floor((ms%3600000)/60000);
    let s = Math.floor((ms%60000)/1000);
    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

// ---- New helper function ----
export function getDiscountMessage(service, percent) {
    if (!service) return "";
    if (percent === 100) return `${service} FREE account unlocked!`;
    return `${service} ${percent}% discount won!`;
}