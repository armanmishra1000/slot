import {
    SYMBOLS, REELS, ROWS, reels, winLines, winningSymbols, clearWinLines, clearWinningSymbols,
    initReels, renderReels, spinReel, randSymbol,
    setAnimating, getAnimating, setCoinsToShower, getCoinsToShower
} from './game-core.js';
import {
    loadState, saveState, bet, BONUS_INTERVAL, canClaimBonus, formatTimer, getDiscountMessage
} from './game-economy.js';

// --- HISTORY CONSTANTS ---
const MAX_HISTORY_ENTRIES = 15;

// --- UI STATE ---
const canvas = document.getElementById("slot-canvas");
const ctx = canvas.getContext("2d");
const balanceEl = document.getElementById("balance");
const lastWinEl = document.getElementById("last-win");
const rewardMsgEl = document.getElementById("reward-message");
const bonusTimerEl = document.getElementById("bonus-timer");
const streakCounterEl = document.getElementById("streak-counter");
const claimBonusBtn = document.getElementById("claim-bonus-btn");
const spinHistoryListEl = document.getElementById("spin-history-list");

// --- STATE ---
let state = loadState();
let balance = state.credits;
let lastWin = state.lastWin;
let streak = state.streak;
let lastBonus = state.lastBonus;
state.combinedHistory = state.combinedHistory || [];
let bonusTimer = null, canBonus = false;

// --- INIT ---
initReels(randSymbol);
renderReels(ctx);
updatePanels();
setupBonusPanel();
displayRewardMessage();
updateSpinHistoryUI();

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
        // Prepare history details BEFORE checkWins (so we have raw symbols)
        const finalReelSymbols = [];
        for (let row = 0; row < ROWS; row++) {
            let rowArr = [];
            for (let col = 0; col < REELS; col++) {
                rowArr.push(SYMBOLS[reels[col].symbols[row]].name);
            }
            finalReelSymbols.push(rowArr);
        }
        // We checkWins() first (to get correct win state)
        setAnimating(false);
        const winResult = checkWins();

        // Add history
        addCombinedHistoryEntry({
            symbols: finalReelSymbols,
            winText: winResult.winText,
            creditsWon: winResult.creditsWon,
            timestamp: new Date().toLocaleTimeString(),
            bet: bet
        });
    }, 250);
}

// --- HORIZONTAL MATCH LOGIC + RETURN WIN INFO ---
function checkWins() {
    let totalWin = 0;
    clearWinLines(); clearWinningSymbols();
    setCoinsToShower(0);
    let bestDiscount = {service: null, percent: 0};
    let coinWin = 0;
    let winHighlights = [];

    // Only horizontal lines
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
        if (symbol.name === "Amethyst") return;
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

    if (winLines.length) animateWins(winHighlights);
    if (coinWin > 0 && getCoinsToShower()) triggerCoinShower(getCoinsToShower() * 6);

    let winEntryText = "";
    if (rewardMsg) winEntryText = rewardMsg;
    if (coinWin > 0) winEntryText += (winEntryText ? " & " : "") + `Won ${coinWin} credits`;

    if (rewardMsg) displayRewardMessage(rewardMsg);

    // Return info for combined history
    return {
        winText: winEntryText || "No win",
        creditsWon: totalWin
    };
}

// --- COMBINED SPIN/WIN HISTORY ---
function addCombinedHistoryEntry(entry) {
    state.combinedHistory = state.combinedHistory || [];
    state.combinedHistory.unshift(entry);
    if (state.combinedHistory.length > MAX_HISTORY_ENTRIES) state.combinedHistory.pop();
    updateSpinHistoryUI();
    save();
}
function updateSpinHistoryUI() {
    spinHistoryListEl.innerHTML = '';
    state.combinedHistory = state.combinedHistory || [];
    state.combinedHistory.forEach(entry => {
        const li = document.createElement('li');
        // Row 1: time + win/loss result
        const row1 = document.createElement('div');
        row1.style.fontWeight = "bold";
        row1.textContent = entry.timestamp + ' — ';
        const resSpan = document.createElement('span');
        resSpan.textContent = (entry.creditsWon > 0 ? "WIN: " : "LOSE");
        resSpan.style.color = entry.creditsWon > 0 ? "#98fc91" : "#e77070";
        row1.appendChild(resSpan);
        li.appendChild(row1);

        // Row 2: Win description if any
        if (entry.winText && entry.winText !== "No win") {
            const row2 = document.createElement('div');
            row2.textContent = entry.winText;
            row2.style.color = "#ffe45c";
            li.appendChild(row2);
        }

        // Row 3: symbols mini-grid
        const grid = document.createElement('div');
        grid.style.display = "flex";
        grid.style.flexDirection = "column";
        entry.symbols.forEach(rowArr => {
            const rowDiv = document.createElement('div');
            rowArr.forEach(symbolName => {
                const span = document.createElement('span');
                span.className = `symbol-hist-icon ${symbolName.toLowerCase()}-hist-icon`;
                span.title = symbolName;
                span.textContent = symbolName.charAt(0);
                rowDiv.appendChild(span);
            });
            grid.appendChild(rowDiv);
        });
        li.appendChild(grid);

        spinHistoryListEl.appendChild(li);
    });
}

// --- (Unchanged Below) ---
function animateWins(highlights) {
    let flash = 0;
    function flashLoop() {
        flash++;
        if (flash > 10) return;
        ctx.globalAlpha = flash % 2 ? 1 : 0.45;
        renderReels(ctx);
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
    saveState({
        credits: balance,
        lastWin,
        streak,
        lastBonus,
        combinedHistory: state.combinedHistory
    });
}

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