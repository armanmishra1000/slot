import {
    SYMBOLS, REELS, ROWS, PAYLINES, reels, winLines, winningSymbols, clearWinLines, clearWinningSymbols,
    initReels, renderReels, spinReel, randSymbol,
    setAnimating, getAnimating, setCoinsToShower, getCoinsToShower
} from './game-core.js';
import {
    loadState, saveState, bet, BONUS_INTERVAL, canClaimBonus, formatTimer
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

function checkWins() {
    let totalWin = 0;
    clearWinLines(); clearWinningSymbols();
    setCoinsToShower(0);
    let isJackpot = false;
    for (let p = 0; p < PAYLINES.length; p++) {
        const line = PAYLINES[p];
        const firstIdx = reels[line[0][0]].symbols[line[0][1]];
        let match = true;
        for (let k = 1; k < 3; k++) {
            const idx = reels[line[k][0]].symbols[line[k][1]];
            if (idx !== firstIdx) { match = false; break; }
        }
        if (match) {
            winLines.push(line.slice(0,3));
            winningSymbols.push({symbol: firstIdx, positions: line.slice(0,3)});
            totalWin += SYMBOLS[firstIdx].payout * bet;
            if (SYMBOLS[firstIdx].payout >= 25) setCoinsToShower(getCoinsToShower() + 1);
            if (SYMBOLS[firstIdx].name === "Ruby") isJackpot = true;
        }
    }
    lastWin = totalWin; balance += totalWin; updatePanels(); save(); renderReels(ctx);
    // Animate win effects, coin shower, reward
    if (winLines.length) animateWins();
    if (totalWin > 0 && getCoinsToShower()) triggerCoinShower(getCoinsToShower() * 9);

    // --- Reward Message Display ---
    let reward = "";
    if (isJackpot && totalWin >= 150) {
        reward = "JACKPOT! Claim FREE premium account!";
    } else if (totalWin >= 501) {
        reward = "50% OFF your next purchase!";
    } else if (totalWin >= 201) {
        reward = "20% discount unlocked!";
    } else if (totalWin >= 50) {
        reward = "You won 10% discount on premium accounts!";
    }
    if (reward) displayRewardMessage(reward);
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

function animateWins() {
    let flash = 0;
    function flashLoop() {
        flash++;
        if (flash > 10) return;
        ctx.globalAlpha = flash % 2 ? 1 : 0.45;
        renderReels(ctx);
        ctx.globalAlpha = 1;
        setTimeout(flashLoop, 70);
    }
    flashLoop();
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