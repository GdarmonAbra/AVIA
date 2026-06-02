/* Color Match (Stroop) — cognitive flexibility / inhibition.
   Pick the INK COLOR of the word, not what the word says. */
(function () {
  "use strict";
  var E = window.NeuroEngine;

  var COLORS = [
    { name: "RED", css: "#ff5d7d" },
    { name: "GREEN", css: "#3ddc84" },
    { name: "BLUE", css: "#5db8fc" },
    { name: "YELLOW", css: "#ffce47" }
  ];

  E.register({
    id: "color-match",
    name: "Color Match",
    category: "flex",
    glyph: "🎨",
    blurb: "Ignore what the word says — choose the color it's printed in. A true brain-bender.",
    howto: "A color word appears, printed in some ink color. Tap the button matching the INK COLOR, not the word itself. You have 45 seconds; wrong answers cost points.",

    play: function (ctx) {
      var DURATION = 45;
      var score = 0, correct = 0, wrong = 0, answered = 0;
      var ended = false;
      var inkColor = null;

      ctx.clear();
      var word = E.el("div", "stroop-word", "");
      var grid = E.el("div", "color-grid");
      ctx.stage.appendChild(word);
      ctx.stage.appendChild(E.el("div", "prompt-sub", "Tap the color the word is printed in."));
      ctx.stage.appendChild(grid);

      COLORS.forEach(function (c) {
        var b = E.el("button", "color-btn", c.name);
        b.style.background = c.css;
        b.style.color = (c.name === "YELLOW") ? "#2a1c00" : "#06121f";
        b.onclick = function () { choose(c, b); };
        grid.appendChild(b);
      });

      function hud() {
        ctx.setHud([
          { k: "Correct", v: String(correct) },
          { k: "Score", v: String(score) }
        ]);
      }
      hud();

      function gen() {
        var wordColor = E.pick(COLORS);   // the text
        // ink is usually different from the word for genuine Stroop conflict
        var ink = Math.random() < 0.75
          ? E.pick(COLORS.filter(function (c) { return c.name !== wordColor.name; }))
          : wordColor;
        inkColor = ink;
        word.textContent = wordColor.name;
        word.style.color = ink.css;
        word.style.animation = "none"; void word.offsetWidth; word.style.animation = "pop .18s ease";
      }

      function choose(c, btn) {
        if (ended) return;
        answered++;
        if (c.name === inkColor.name) {
          correct++; score += 15;
        } else {
          wrong++; score = Math.max(0, score - 10);
          btn.style.outline = "3px solid #fff";
          setTimeout(function () { btn.style.outline = ""; }, 120);
        }
        hud();
        gen();
      }

      ctx.countIn(function () {
        gen();
        ctx.countdownClock(DURATION, end);
      });

      function end() {
        ended = true;
        var acc = answered ? (correct / answered) * 100 : 0;
        var normalized = Math.min(100, Math.round(correct / 30 * 100));
        ctx.finish({
          score: score, accuracy: acc, normalized: normalized,
          detail: correct + " correct · " + wrong + " wrong in " + DURATION + "s."
        });
      }
    }
  });
})();
