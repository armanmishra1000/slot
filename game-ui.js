import {
    SYMBOLS, REELS, ROWS, reels, winLines, winningSymbols, clearWinLines, clearWinningSymbols,
    initReels, renderReels, spinReel, randSymbol,
    setAnimating, getAnimating, setCoinsToShower, getCoinsToShower
} from './game-core.js';
import {
    loadState, saveState, bet, BONUS_INTERVAL, canClaimBonus, formatTimer, getDiscountMessage
} from './game-economy.js';

// --- UI STATE ---
const canvas = document.getElementById("slot-canvas");
const ctx = canvas.getContext("2d");
const balanceEl = document.getElementById("balance");
const lastWinEl = document.getElementById("last-win");
const rewardMsgEl = document.getElementById("reward-message");
const bonusTimerEl = document.getElementById("bonus-timer");
const streakCounterEl = document.getElementById("streak-counter");
const claimBonusBtn = document.getElementById("claim-bonus-btn");

let state = loadState();
let balance = state.credits;
let lastWin = state.lastWin;
let streak = state.streak;
let lastBonus = state.lastBonus;
let bonusTimer = null, canBonus = false;

// --- INIT ---
initReels(randSymbol);
renderReels(ctx);
updatePanels();
setupBonusPanel();
displayRewardMessage();

// --- SPIN HANDLER ---
document.getElementById("spin-btn").addEventListener("click", spin);

function spin() {
    if (getAnimating() || balance < bet) return;
    setAnimating(true);
    clearWinLines(); clearWinningSymbols(); setCoinsToShower(0);
    lastWin = 0; updatePanels();

    balance -= bet; updatePanels(); save();
    const targets = [];
    for (let i = 0; i < REELS; i++) {
        const col = [];
        for (let j = 0; j < ROWS; j++) col.push(randSymbol());
        targets.push(col);
    }
    reels.forEach((reel, idx) => {
        setTimeout(() => {
            spinReel(reel, targets[idx], idx === REELS-1 ? onSpinEnd : null, randSymbol, ()=>renderReels(ctx));
        }, idx * 150);
    });
}

function onSpinEnd() {
    setTimeout(() => {
        setAnimating(false);
        checkWins();
    }, 250);
}

// --- FIXED: ONLY HORIZONTAL MATCHES ---
function checkWins() {
    let totalWin = 0;
    clearWinLines(); clearWinningSymbols();
    setCoinsToShower(0);
    let bestDiscount = {service: null, percent: 0}; // Only show highest discount per spin
    let coinWin = 0;
    let winHighlights = [];

    // Check each row for horizontal streaks
    for (let row = 0; row < ROWS; row++) {
        let col = 0;
        while (col < REELS) {
            const symbolIdx = reels[col].symbols[row];
            if (symbolIdx === undefined) { col++; continue; }
            let count = 1;
            for (let nextCol = col + 1; nextCol < REELS; nextCol++) {
                if (reels[nextCol].symbols[row] === symbolIdx) count++;
                else break;
            }
            if (count >= 3) {
                handleMatch(symbolIdx, count, Array.from({length: count}, (_, i) => [col + i, row]), winHighlights);
                col += count;
            } else {
                col++;
            }
        }
    }

    function handleMatch(symbolIdx, count, positions, winHighlightsArr) {
        const symbol = SYMBOLS[symbolIdx];
        if (symbol.name === "Amethyst") return; // No reward

        // Premium accounts
        if (["Ruby", "Emerald", "Sapphire"].includes(symbol.name)) {
            let percent = 0;
            if (count === 3) percent = 30;
            else if (count === 4) percent = 80;
            else if (count >= 5) percent = 100;
            if (percent > bestDiscount.percent) {
                bestDiscount = {service: symbol.service, percent};
            }
            winLines.push(positions);
            winHighlightsArr.push(...positions);
        }
        // Coin reward
        if (symbol.name === "Coin") {
            let credits = 0;
            if (count === 3) credits = bet * 1;
            else if (count === 4) credits = bet * 3;
            else if (count >= 5) credits = bet * 10;
            coinWin += credits;
            setCoinsToShower(getCoinsToShower() + (count >= 5 ? 6 : count >= 4 ? 3 : 1));
            winLines.push(positions);
            winHighlightsArr.push(...positions);
        }
    }

    // Apply wins and reward messages
    let rewardMsg = "";
    if (bestDiscount.percent > 0) {
        rewardMsg = getDiscountMessage(bestDiscount.service, bestDiscount.percent);
    }
    if (coinWin > 0) {
        totalWin += coinWin;
        lastWin = coinWin;
    } else {
        lastWin = 0;
    }
    if (totalWin > 0) balance += totalWin;
    updatePanels();
    save();
    renderReels(ctx);

    // Animate highlights
    if (winLines.length) animateWins(winHighlights);
    if (coinWin > 0 && getCoinsToShower()) triggerCoinShower(getCoinsToShower() * 6);

    if (rewardMsg) displayRewardMessage(rewardMsg);
}

function animateWins(highlights) {
    let flash = 0;
    function flashLoop() {
        flash++;
        if (flash > 10) return;
        ctx.globalAlpha = flash % 2 ? 1 : 0.45;
        renderReels(ctx);
        // Highlight winning positions
        if (highlights) {
            highlights.forEach(pos => {
                const [col, row] = pos;
                ctx.save();
                ctx.strokeStyle = "#ffd700cc";
                ctx.shadowColor = "#ffec8a";
                ctx.shadowBlur = 20;
                ctx.lineWidth = 6;
                ctx.strokeRect(col*90+18, row*90+30, 64, 64);
                ctx.restore();
            });
        }
        ctx.globalAlpha = 1;
        setTimeout(flashLoop, 70);
    }
    flashLoop();
}

function updatePanels() {
    balanceEl.textContent = `Credits: ${balance}`;
    lastWinEl.textContent = `Last Win: ${lastWin} credits`;
}
function save() {
    saveState({ credits: balance, lastWin, streak, lastBonus });
}

// --- Reward Message ---
function displayRewardMessage(msg) {
    rewardMsgEl.innerHTML = "";
    rewardMsgEl.className = "reward-animate";
    if (!msg) return;
    let div = document.createElement("div");
    div.className = "reward-msg";
    div.textContent = msg;
    rewardMsgEl.appendChild(div);
    setTimeout(() => rewardMsgEl.classList.add("reward-visible"), 80);
    setTimeout(() => {
        rewardMsgEl.classList.remove("reward-visible");
        setTimeout(() => { rewardMsgEl.innerHTML = ""; }, 350);
    }, 5000);
}

// --- Coin Shower ---
function triggerCoinShower(n) {
    const shower = document.getElementById('coin-shower');
    for (let i=0; i<n; i++) {
        setTimeout(() => {
            const coin = document.createElement("div");
            coin.className = "coin-fx";
            coin.style.left = (240 + Math.random()*140 - 70) + "px";
            coin.style.top = (90 + Math.random()*50) + "px";
            coin.textContent = "🪙";
            shower.appendChild(coin);
            setTimeout(()=>{ coin.remove(); }, 1700);
        }, i*55 + Math.random()*60);
    }
}

// --- Daily Bonus ---
function setupBonusPanel() {
    updateStreak();
    updateBonusTimer();
    claimBonusBtn.addEventListener("click", () => {
        if (!canBonus) return;
        canBonus = false;
        balance += 100; streak += 1; lastBonus = Date.now();
        updatePanels(); save(); updateStreak(); updateBonusTimer();
        displayRewardMessage("You claimed your daily 100 credits!");
    });
    setInterval(updateBonusTimer, 1000);
}
function updateBonusTimer() {
    const now = Date.now(), nextBonusAt = lastBonus ? lastBonus + BONUS_INTERVAL : 0, timeLeft = nextBonusAt - now;
    if (!lastBonus || timeLeft <= 0) {
        bonusTimerEl.textContent = "Ready!";
        claimBonusBtn.style.display = "inline-block"; canBonus = true;
    } else {
        claimBonusBtn.style.display = "none"; canBonus = false;
        bonusTimerEl.textContent = formatTimer(timeLeft);
    }
}
function updateStreak() {
    streakCounterEl.textContent = `${streak} days`;
    streakCounterEl.classList.remove('streak-pop');
    void streakCounterEl.offsetWidth;
    streakCounterEl.classList.add('streak-pop');
}