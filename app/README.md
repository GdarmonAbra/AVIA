# NeuroNova — Brain Training App

A lightweight, dependency-free brain-training web app in the spirit of
**Lumosity, BrainHQ and Brilliant**. Six science-inspired cognitive games, a
daily streak, per-skill progress tracking and an overall **Brain Index** —
all running in the browser with scores saved locally on the device.

No build step, no frameworks, no network calls. Just open `index.html`.

## Run it

```bash
# easiest — just open the file
open app/index.html            # macOS
xdg-open app/index.html        # Linux

# or serve it (recommended, avoids any file:// quirks)
cd app && python3 -m http.server 8000
# then visit http://localhost:8000
```

## The games

| Game | Skill | What it trains |
|------|-------|----------------|
| **Memory Matrix** | Memory | Memorize a flashed grid pattern and recreate it; the board grows each level. |
| **N-Back** | Memory | Working-memory classic — flag when a letter repeats N steps back. |
| **Speed Match** | Speed | Snap-judge whether each symbol matches the one before it, against the clock. |
| **Math Blitz** | Math | Rapid mental arithmetic with difficulty that scales to your streak. |
| **Reaction Time** | Attention | Tap the instant the pad turns green — pure response speed over 5 rounds. |
| **Color Match** | Flexibility | A Stroop test: choose the *ink color* of a word, not what it says. |

## How it works

- **Home / Train** — game cards grouped by skill, your best score on each, and a
  Brain Index ring summarizing overall performance.
- **Progress** — day streak, total sessions, per-skill mastery bars and a recent
  session history. Includes a reset button.
- **Scoring** — every game reports a raw score plus a *normalized* 0–100 value;
  the best normalized value per skill feeds the Brain Index.
- **Persistence** — everything lives in `localStorage` under `neuronova.v1`.

## Code layout

```
app/
├── index.html              # shell: top bar, view container, script tags
├── css/styles.css          # all styling (CSS custom properties, no framework)
├── js/
│   ├── storage.js          # localStorage layer: scores, streak, history, BPI
│   ├── engine.js           # categories, game registry, lifecycle + ctx API
│   ├── app.js              # router, home dashboard, progress page
│   └── games/              # one self-contained module per game
│       ├── memory-matrix.js
│       ├── speed-match.js
│       ├── math-blitz.js
│       ├── reaction.js
│       ├── n-back.js
│       └── color-match.js
└── smoke-test.js           # headless DOM stub test — `node app/smoke-test.js`
```

### Adding a game

Register it from its own file — the engine handles the intro screen, countdown,
HUD, timer and results automatically:

```js
NeuroEngine.register({
  id: "my-game",
  name: "My Game",
  category: "speed",          // memory | speed | math | attention | flex
  glyph: "✨",
  blurb: "Short card description.",
  howto: "Instructions shown on the start screen.",
  play: function (ctx) {
    // ctx.stage, ctx.el, ctx.setHud, ctx.countdownClock, ctx.countIn, ctx.finish ...
    ctx.finish({ score: 100, accuracy: 90, normalized: 80 });
  }
});
```

Then add a `<script>` tag for it in `index.html`.

## Tests

```bash
node app/smoke-test.js
```

Stubs a minimal DOM + `localStorage`, loads every script, and verifies game
registration, the scoring/streak/Brain-Index store, and that the router renders
without errors.
