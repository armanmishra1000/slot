# Premium Vegas Slot Machine

This project is a browser-based slot machine game written in vanilla JavaScript. The latest version adds a lightweight [PixiJS](https://pixijs.com/) background layer for smooth graphics and a redesigned interface with a pop-up paytable. The sidebar now just offers buttons to open Top Players and Spin History in separate modals so the main game area stays uncluttered. On smaller screens the sidebar stacks above the game.
It now also features a spin result display box above the reels that highlights whether you won credits, discounts or nothing after each spin.

## Running Locally on macOS

1. **Install Node.js** (if you don't already have it). The easiest way on macOS is via [Homebrew](https://brew.sh/):
   ```bash
   brew install node
   ```

2. **Clone or download this repository** and open a terminal in the project folder.

3. **Start a local web server** so the ES modules load correctly. You can use any static server; the simplest is:
   ```bash
   npx http-server -c-1
   ```
   This serves the files at `http://localhost:8080/`. Leave the terminal running while you play.

4. **Open the game** by visiting `http://localhost:8080/premium-slot.html` in your browser.
   Use the small information button below the reels to view the paytable popup. The sidebar contains buttons for Top Players and Spin History which open modals with those details.

PixiJS is loaded from a CDN, so you just need an internet connection for the first load. All gameplay state is stored in your browser's localStorage.
