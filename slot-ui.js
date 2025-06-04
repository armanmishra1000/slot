import {
    SYMBOLS, REELS, ROWS, reels, winLines, winningSymbols, clearWinLines, clearWinningSymbols,
    initReels, renderReels, spinReel, randSymbol,
    setAnimating, getAnimating,
    P, DIVIDER_W, REEL_W, SYMBOL_H, CANVAS_W, CANVAS_H
} from './game-core.js';
import {
    loadState, saveState, DEFAULT_BET, MIN_BET, BONUS_INTERVAL, canClaimBonus, formatTimer, getDiscountMessage
} from './game-economy.js';
import { addCombinedHistoryEntry, updateSpinHistoryUI, setHistoryState, getHistoryState } from './slot-history.js';

export let state;
export let balance, lastWin, streak, lastBonus, currentBet;
export let bonusTimer = null, canBonus = false;

export function setupSlotUI() {
    // --- UI elements ---
    const canvas = document.getElementById("slot-canvas");
    const canvasContainer = document.querySelector(".slot-canvas-container");
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const width = CANVAS_W;
    const height = CANVAS_H;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.scale(dpr, dpr);
    const balanceEl = document.getElementById("balance");
    const lastWinEl = document.getElementById("last-win");
    const rewardMsgEl = document.getElementById("reward-message");
    const spinResultBoxEl = document.getElementById("spin-result-box");
    const bonusTimerEl = document.getElementById("bonus-timer");
    const streakCounterEl = document.getElementById("streak-counter");
    const claimBonusBtn = document.getElementById("claim-bonus-btn");
    const betAmountInputEl = document.getElementById("bet-amount-input");
    const paytableBtn = document.getElementById("paytable-btn");
    const paytableModal = document.getElementById("paytable-modal");
    const closePaytable = document.getElementById("close-paytable");
    const openHistoryModalBtn = document.getElementById("open-history-modal-btn");
    const openTopPlayersModalBtn = document.getElementById("open-top-players-modal-btn");
    const spinHistoryModal = document.getElementById("spin-history-modal");
    const topPlayersModal = document.getElementById("top-players-modal");
    const closeHistoryModal = document.getElementById("close-history-modal");
    const closeTopPlayersModal = document.getElementById("close-top-players-modal");

    state = loadState();
    balance = state.credits;
    lastWin = state.lastWin;
    streak = state.streak;
    lastBonus = state.lastBonus;
    currentBet = state.currentBet;
    setHistoryState(state);

    // Set up initial bet input value and validation
    betAmountInputEl.value = currentBet;
    betAmountInputEl.min = MIN_BET;

    betAmountInputEl.addEventListener("change", function() {
        let val = parseInt(betAmountInputEl.value, 10);
        if (isNaN(val) || val < MIN_BET) val = MIN_BET;
        if (val > balance) val = balance > 0 ? balance : MIN_BET;
        currentBet = val;
        betAmountInputEl.value = currentBet;
        save();
    });

    // INIT
    initReels(randSymbol);
    renderReels(ctx);
    updatePanels();
    setupBonusPanel();
    displayRewardMessage();
    updateSpinHistoryUI();

    paytableBtn.addEventListener("click", () => {
        paytableModal.style.display = "flex";
    });
    closePaytable.addEventListener("click", () => {
        paytableModal.style.display = "none";
    });
    paytableModal.addEventListener("click", (e) => {
        if (e.target === paytableModal) paytableModal.style.display = "none";
    });

    openHistoryModalBtn.addEventListener("click", () => {
        spinHistoryModal.style.display = "flex";
    });
    openTopPlayersModalBtn.addEventListener("click", () => {
        topPlayersModal.style.display = "flex";
    });
    closeHistoryModal.addEventListener("click", () => {
        spinHistoryModal.style.display = "none";
    });
    closeTopPlayersModal.addEventListener("click", () => {
        topPlayersModal.style.display = "none";
    });
    spinHistoryModal.addEventListener("click", (e) => {
        if (e.target === spinHistoryModal) spinHistoryModal.style.display = "none";
    });
    topPlayersModal.addEventListener("click", (e) => {
        if (e.target === topPlayersModal) topPlayersModal.style.display = "none";
    });

    document.getElementById("spin-btn").addEventListener("click", spin);

    function spin() {
        if (getAnimating() || balance < currentBet) return;
        updateSpinResultDisplay({ status: 'spinning' });
        setAnimating(true);
        clearWinLines(); clearWinningSymbols();
        lastWin = 0; updatePanels();

        balance -= currentBet; updatePanels(); save();
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
        canvasContainer.classList.add("glow");
        setTimeout(() => canvasContainer.classList.remove("glow"), 600);
        setTimeout(() => {
            const finalReelSymbols = [];
            for (let row = 0; row < ROWS; row++) {
                let rowArr = [];
                for (let col = 0; col < REELS; col++) {
                    rowArr.push(SYMBOLS[reels[col].symbols[row]].name);
                }
                finalReelSymbols.push(rowArr);
            }
            setAnimating(false);
            const winResult = checkWins();
            updateSpinResultDisplay(winResult);
            addCombinedHistoryEntry({
                symbols: finalReelSymbols,
                winText: winResult.rawWinTextForHistory,
                creditsWon: winResult.creditsWon,
                timestamp: new Date().toLocaleTimeString(),
                bet: currentBet
            });
        }, 250);
    }

    function checkWins() {
        let totalWin = 0;
        clearWinLines(); clearWinningSymbols();
        let bestDiscount = {service: null, percent: 0};
        let coinWin = 0;
        let winHighlights = [];

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
                if (count === 3) credits = currentBet * 1;
                else if (count === 4) credits = currentBet * 3;
                else if (count >= 5) credits = currentBet * 10;
                coinWin += credits;
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

        let winEntryText = "";
        if (rewardMsg) winEntryText = rewardMsg;
        if (coinWin > 0) winEntryText += (winEntryText ? " & " : "") + `Won ${coinWin} credits`;

        return {
            creditsWon: totalWin,
            discountInfo: bestDiscount.service ? bestDiscount : null,
            rawWinTextForHistory: winEntryText || "No win"
        };
    }

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
                    const rect_x = P + col * (REEL_W + DIVIDER_W);
                    const rect_y = P + row * SYMBOL_H;
                    ctx.strokeRect(rect_x, rect_y, REEL_W, SYMBOL_H);
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
        if (betAmountInputEl.value > balance) {
            betAmountInputEl.value = balance > 0 ? balance : MIN_BET;
            currentBet = parseInt(betAmountInputEl.value, 10);
            save();
        }
    }
    function save() {
        saveState({
            credits: balance,
            lastWin,
            streak,
            lastBonus,
            currentBet: currentBet,
            combinedHistory: getHistoryState()
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


    function updateSpinResultDisplay(resultData) {
        spinResultBoxEl.className = 'spin-result-box';
        let message = '';
        let className = '';
        if (resultData.status === 'spinning') {
            message = 'SPINNING...';
            className = 'spinning';
        } else if (resultData.creditsWon === 0 && !resultData.discountInfo) {
            message = 'TRY AGAIN';
            className = 'lose';
        } else {
            if (resultData.creditsWon > 0 && resultData.discountInfo) {
                message = `MEGA WIN! ${resultData.creditsWon} CREDITS & ${resultData.discountInfo.service} ${resultData.discountInfo.percent}%`;
                className = 'win-jackpot';
            } else if (resultData.creditsWon > 0) {
                message = `YOU WIN! ${resultData.creditsWon} CREDITS`;
                className = 'win-credits';
            } else if (resultData.discountInfo) {
                message = `${resultData.discountInfo.service} ${resultData.discountInfo.percent}% DISCOUNT!`;
                className = 'win-discount';
            }
        }
        spinResultBoxEl.innerHTML = `<span>${message}</span>`;
        if (className) spinResultBoxEl.classList.add(className);
        void spinResultBoxEl.offsetWidth;
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
}