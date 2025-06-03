// This module manages the spin+win history state and UI
let combinedHistory = [];
const MAX_HISTORY_ENTRIES = 15;

export function setHistoryState(state) {
    combinedHistory = state.combinedHistory || [];
}
export function getHistoryState() {
    return combinedHistory;
}

// Call this from slot-ui.js after each spin
export function addCombinedHistoryEntry(entry) {
    combinedHistory.unshift(entry);
    if (combinedHistory.length > MAX_HISTORY_ENTRIES) combinedHistory.pop();
    updateSpinHistoryUI();
}
export function updateSpinHistoryUI() {
    const spinHistoryListEl = document.getElementById("spin-history-list");
    spinHistoryListEl.innerHTML = '';
    combinedHistory.forEach(entry => {
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

        // Row 1.5: Bet amount for this spin
        const betDiv = document.createElement('div');
        betDiv.textContent = `Bet: ${entry.bet} credits`;
        betDiv.style.fontSize = "0.97em";
        betDiv.style.color = "#ffe68a";
        betDiv.style.fontWeight = "600";
        li.appendChild(betDiv);

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