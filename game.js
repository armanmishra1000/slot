// --- SYMBOLS ---
const SYMBOLS = [
    { name: "Ruby", color: "#ff225a", payout: 50, draw: drawRuby },
    { name: "Emerald", color: "#22df71", payout: 25, draw: drawEmerald },
    { name: "Sapphire", color: "#229aff", payout: 10, draw: drawSapphire },
    { name: "Amethyst", color: "#af4ee7", payout: 5, draw: drawAmethyst },
    { name: "Coin", color: "#ffe45c", payout: 2, draw: drawCoin }
  ];
  const REEL_SYMBOL_DISTRIBUTION = [0,1,2,3,4,4,4,3,3,2,1,0,4,4,2,3,1,2,0,2];
  
  // --- PAYLINES (10) ---
  const PAYLINES = [
    [[0,0],[1,0],[2,0],[3,0],[4,0]],
    [[0,1],[1,1],[2,1],[3,1],[4,1]],
    [[0,2],[1,2],[2,2],[3,2],[4,2]],
    [[0,0],[1,1],[2,2],[3,1],[4,0]],
    [[0,2],[1,1],[2,0],[3,1],[4,2]],
    [[0,0],[1,0],[2,1],[3,2],[4,2]],
    [[0,2],[1,2],[2,1],[3,0],[4,0]],
    [[0,1],[1,2],[2,2],[3,2],[4,1]],
    [[0,1],[1,0],[2,0],[3,0],[4,1]],
    [[0,2],[1,1],[2,1],[3,1],[4,0]],
  ];
  
  // --- GAME STATE (localStorage-backed) ---
  const STORAGE_KEY = "premiumSlotState";
  const bet = 10;
  let state = loadState();
  let balance = state.credits;
  let lastWin = state.lastWin || 0;
  let streak = state.streak || 0;
  let lastBonus = state.lastBonus || 0;
  const BONUS_INTERVAL = 24*60*60*1000; // 24h
  let bonusTimer = null;
  let canClaimBonus = false;
  
  // --- CANVAS ---
  const canvas = document.getElementById("slot-canvas");
  const ctx = canvas.getContext("2d");
  const REELS = 5, ROWS = 3;
  const REEL_W = 90, SYMBOL_H = 90;
  const SPIN_Y_OFFSET = 30;
  let reels = [];
  let animating = false;
  let winLines = [];
  let winningSymbols = [];
  let coinsToShower = 0;
  
  // --- UI ---
  const balanceEl = document.getElementById("balance");
  const lastWinEl = document.getElementById("last-win");
  const rewardMsgEl = document.getElementById("reward-message");
  const bonusTimerEl = document.getElementById("bonus-timer");
  const streakCounterEl = document.getElementById("streak-counter");
  const claimBonusBtn = document.getElementById("claim-bonus-btn");
  
  // --- INIT ---
  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        let parsed = JSON.parse(saved);
        // Reset if missing fields
        if (typeof parsed.credits !== "number" || parsed.credits < 0) parsed.credits = 500;
        if (!parsed.lastBonus) parsed.lastBonus = 0;
        if (!parsed.streak) parsed.streak = 0;
        return parsed;
      }
    } catch {}
    // First time
    return { credits: 500, lastWin: 0, streak: 0, lastBonus: 0 };
  }
  
  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      credits: balance,
      lastWin: lastWin,
      streak: streak,
      lastBonus: lastBonus
    }));
  }
  
  function initReels() {
    reels = [];
    for (let i = 0; i < REELS; i++) {
      const symbols = [];
      for (let j = 0; j < ROWS; j++) {
        symbols.push(randSymbol());
      }
      reels.push({
        symbols,
        animY: 0,
        spinning: false,
        targetSymbols: null,
        momentum: 0
      });
    }
  }
  
  initReels();
  renderReels();
  updatePanels();
  setupBonusPanel();
  displayRewardMessage(); // on reload, clear reward
  
  // --- SPIN LOGIC ---
  document.getElementById("spin-btn").addEventListener("click", spin);
  
  function spin() {
    if (animating || balance < bet) return;
    animating = true;
    winLines = [];
    winningSymbols = [];
    coinsToShower = 0;
    lastWin = 0;
    updatePanels();
  
    balance -= bet;
    updatePanels();
    saveState();
  
    // Target symbols for each reel (for fairness/random)
    const targets = [];
    for (let i = 0; i < REELS; i++) {
      const col = [];
      for (let j = 0; j < ROWS; j++) {
        col.push(randSymbol());
      }
      targets.push(col);
    }
  
    // Animate each reel with a delay (cascade)
    reels.forEach((reel, idx) => {
      setTimeout(() => {
        spinReel(reel, targets[idx], idx === REELS-1 ? onSpinEnd : null);
      }, idx * 150);
    });
  }
  
  // --- REEL SPIN ANIMATION ---
  function spinReel(reel, targetSymbols, cb) {
    reel.spinning = true;
    reel.targetSymbols = targetSymbols;
    reel.animY = 0;
    reel.momentum = 30 + Math.random()*6;
  
    // Fake random spin cycles before landing
    let spinSteps = 28 + Math.floor(Math.random()*7);
    let steps = 0;
    function animate() {
      if (steps < spinSteps) {
        reel.animY += reel.momentum;
        if (reel.animY >= SYMBOL_H) {
          reel.animY = 0;
          reel.symbols.pop();
          reel.symbols.unshift(randSymbol());
        }
        if (reel.momentum > 7) reel.momentum *= 0.98;
        steps++;
        renderReels();
        requestAnimationFrame(animate);
      } else {
        reel.symbols = [...targetSymbols];
        reel.animY = 0;
        reel.spinning = false;
        renderReels();
        if (cb) cb();
      }
    }
    animate();
  }
  
  function onSpinEnd() {
    setTimeout(() => {
      animating = false;
      checkWins();
    }, 250);
  }
  
  // --- RENDER ---
  function renderReels() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < REELS; i++) {
      const reel = reels[i];
      for (let j = 0; j < ROWS+1; j++) {
        const y = j*SYMBOL_H - reel.animY + SPIN_Y_OFFSET;
        const symbolIdx = reel.symbols[j%ROWS];
        const symbolObj = SYMBOLS[symbolIdx];
        ctx.save();
        ctx.translate(i*REEL_W + 18, y);
        symbolObj.draw(ctx);
        ctx.restore();
      }
    }
    if (winLines.length) drawWinHighlights();
  }
  
  // --- WIN LOGIC ---
  function checkWins() {
    let totalWin = 0;
    winLines = [];
    winningSymbols = [];
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
        if (SYMBOLS[firstIdx].payout >= 25) coinsToShower += 1;
        // Jackpot check: all 3 Rubies on one line
        if (SYMBOLS[firstIdx].name === "Ruby") isJackpot = true;
      }
    }
    lastWin = totalWin;
    balance += totalWin;
    updatePanels();
    saveState();
    renderReels();
  
    // Animate win effects
    if (winLines.length) animateWins();
    if (totalWin > 0 && coinsToShower) triggerCoinShower(coinsToShower * 9);
  
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
  
  function displayRewardMessage(msg) {
    // Clear existing, if any
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
  
  function drawWinHighlights() {
    winLines.forEach(line => {
      for (let pos of line) {
        const [col, row] = pos;
        ctx.save();
        ctx.strokeStyle = "#ffd700cc";
        ctx.shadowColor = "#ffec8a";
        ctx.shadowBlur = 20;
        ctx.lineWidth = 6;
        ctx.strokeRect(col*REEL_W+18, row*SYMBOL_H+SPIN_Y_OFFSET, 64, 64);
        ctx.restore();
      }
    });
  }
  
  function animateWins() {
    let flash = 0;
    function flashLoop() {
      flash++;
      if (flash > 10) return;
      ctx.globalAlpha = flash % 2 ? 1 : 0.45;
      renderReels();
      ctx.globalAlpha = 1;
      setTimeout(flashLoop, 70);
    }
    flashLoop();
  }
  
  // --- COIN SHOWER FX ---
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
  
  // --- DAILY BONUS SYSTEM ---
  function setupBonusPanel() {
    updateStreak();
    updateBonusTimer();
  
    claimBonusBtn.addEventListener("click", () => {
      if (!canClaimBonus) return;
      canClaimBonus = false;
      balance += 100;
      streak += 1;
      lastBonus = Date.now();
      updatePanels();
      saveState();
      updateStreak();
      updateBonusTimer();
      displayRewardMessage("You claimed your daily 100 credits!");
    });
  
    setInterval(updateBonusTimer, 1000);
  }
  
  function updateBonusTimer() {
    const now = Date.now();
    let nextBonusAt = lastBonus ? lastBonus + BONUS_INTERVAL : 0;
    let timeLeft = nextBonusAt - now;
    if (!lastBonus || timeLeft <= 0) {
      bonusTimerEl.textContent = "Ready!";
      claimBonusBtn.style.display = "inline-block";
      canClaimBonus = true;
    } else {
      claimBonusBtn.style.display = "none";
      canClaimBonus = false;
      let h = Math.floor(timeLeft/3600000);
      let m = Math.floor((timeLeft%3600000)/60000);
      let s = Math.floor((timeLeft%60000)/1000);
      bonusTimerEl.textContent = `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
    }
  }
  
  function updateStreak() {
    streakCounterEl.textContent = `${streak} days`;
    streakCounterEl.classList.remove('streak-pop');
    void streakCounterEl.offsetWidth; // reset animation
    streakCounterEl.classList.add('streak-pop');
  }
  
  // --- UTILS ---
  function randSymbol() {
    return REEL_SYMBOL_DISTRIBUTION[Math.floor(Math.random()*REEL_SYMBOL_DISTRIBUTION.length)];
  }
  
  // --- SYMBOL DRAWING (same as before) ---
  function drawRuby(ctx) {
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
  function drawEmerald(ctx) {
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
  function drawSapphire(ctx) {
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
  function drawAmethyst(ctx) {
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
  function drawCoin(ctx) {
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