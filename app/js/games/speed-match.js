/* Speed Match — processing speed.
   Does the current symbol match the PREVIOUS one? Answer fast, beat the clock. */
(function () {
  "use strict";
  var E = window.NeuroEngine;
  var SYMBOLS = ["🔺", "⬛", "🔵", "⭐", "❤️", "⬡"];

  E.register({
    id: "speed-match",
    name: "Speed Match",
    category: "speed",
    glyph: "⚡",
    blurb: "Does this symbol match the one before it? Decide as fast as you can.",
    howto: "A symbol appears. Hit YES if it matches the symbol shown immediately before it, otherwise NO. You have 45 seconds — answer as many as possible. Wrong answers cost points.",

    play: function (ctx) {
      var DURATION = 45;
      var prev = null, current = null;
      var correct = 0, wrong = 0, answered = 0;
      var score = 0;
      var ended = false;

      ctx.clear();
      var stage = ctx.stage;
      var card = E.el("div", "symbol-card", "");
      var row = E.el("div", "yn-row");
      var noBtn = E.el("button", "yn-btn no", "NO");
      var yesBtn = E.el("button", "yn-btn yes", "YES");
      row.appendChild(noBtn); row.appendChild(yesBtn);
      stage.appendChild(card);
      stage.appendChild(E.el("div", "prompt-sub", "Does it match the symbol before it?"));
      stage.appendChild(row);

      function hud() {
        ctx.setHud([
          { k: "Correct", v: String(correct) },
          { k: "Score", v: String(score) }
        ]);
      }

      function next() {
        prev = current;
        // ~45% chance of a match (only possible after first symbol)
        if (prev && Math.random() < 0.45) current = prev;
        else current = E.pick(SYMBOLS);
        card.textContent = current;
        card.style.animation = "none"; void card.offsetWidth; card.style.animation = "pop .18s ease";
      }

      function answer(saidYes) {
        if (ended || prev === null) { // first symbol: just advance, no scoring
          if (prev === null) { next(); return; }
          return;
        }
        answered++;
        var isMatch = current === prev;
        if (saidYes === isMatch) {
          correct++; score += 15;
          flash(saidYes ? yesBtn : noBtn, true);
        } else {
          wrong++; score = Math.max(0, score - 10);
          flash(saidYes ? yesBtn : noBtn, false);
        }
        hud();
        next();
      }

      function flash(btn, good) {
        btn.style.filter = good ? "brightness(1.4)" : "grayscale(.5)";
        setTimeout(function () { btn.style.filter = ""; }, 120);
      }

      yesBtn.onclick = function () { answer(true); };
      noBtn.onclick = function () { answer(false); };
      var keyH = function (e) {
        if (e.key === "ArrowRight" || e.key.toLowerCase() === "f") answer(true);
        if (e.key === "ArrowLeft" || e.key.toLowerCase() === "j") answer(false);
      };
      window.addEventListener("keydown", keyH);
      ctx.onCleanup(function () { window.removeEventListener("keydown", keyH); });

      hud();

      ctx.countIn(function () {
        next(); // shows first symbol (no scoring on it)
        ctx.countdownClock(DURATION, end);
      });

      function end() {
        ended = true;
        var acc = answered ? (correct / answered) * 100 : 0;
        var normalized = Math.min(100, Math.round(correct / 40 * 100));
        ctx.finish({
          score: score, accuracy: acc, normalized: normalized,
          detail: correct + " correct · " + wrong + " wrong in " + DURATION + "s."
        });
      }
    }
  });
})();
