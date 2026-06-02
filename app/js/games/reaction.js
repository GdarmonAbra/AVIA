/* Reaction Time — raw attention / response speed.
   Wait for green, then tap instantly. Five rounds, averaged. */
(function () {
  "use strict";
  var E = window.NeuroEngine;

  E.register({
    id: "reaction",
    name: "Reaction Time",
    category: "attention",
    glyph: "🎯",
    blurb: "Tap the moment the pad turns green. Tests pure reaction speed.",
    howto: "The pad turns red, then after a random delay turns green. Tap as fast as you can when it goes green — but don't jump early. Your average over 5 rounds becomes your score.",

    play: function (ctx) {
      var ROUNDS = 5;
      var round = 0;
      var times = [];
      var state = "idle"; // idle | waiting | go
      var goAt = 0;
      var timeoutId = null;

      ctx.clear();
      var pad = E.el("div", "react-pad ready", "Tap to begin");
      var info = E.el("div", "prompt-sub", "Round 1 of " + ROUNDS);
      ctx.stage.appendChild(pad);
      ctx.stage.appendChild(info);

      function hud() {
        var avg = times.length ? Math.round(times.reduce(function (a, b) { return a + b; }, 0) / times.length) : 0;
        ctx.setHud([
          { k: "Round", v: round + "/" + ROUNDS },
          { k: "Avg ms", v: avg ? String(avg) : "—" }
        ]);
      }
      hud();

      function arm() {
        state = "waiting";
        pad.className = "react-pad wait";
        pad.textContent = "Wait for green…";
        var delay = E.rand(900, 2600);
        timeoutId = setTimeout(function () {
          state = "go";
          pad.className = "react-pad go";
          pad.textContent = "TAP!";
          goAt = performance.now();
        }, delay);
        ctx.onCleanup(function () { clearTimeout(timeoutId); });
      }

      function tap() {
        if (state === "ready" || state === "idle") { round++; hud(); info.textContent = "Round " + round + " of " + ROUNDS; arm(); return; }
        if (state === "waiting") {
          clearTimeout(timeoutId);
          state = "early";
          pad.className = "react-pad early";
          pad.textContent = "Too early! Tap to retry";
          state = "ready"; round--; // retry same round
          return;
        }
        if (state === "go") {
          var rt = Math.round(performance.now() - goAt);
          times.push(rt);
          hud();
          if (round >= ROUNDS) { pad.className = "react-pad ready"; pad.textContent = rt + " ms — done!"; setTimeout(end, 600); return; }
          state = "ready";
          pad.className = "react-pad ready";
          pad.textContent = rt + " ms · tap for next";
        }
      }

      pad.onclick = tap;
      var keyH = function (e) { if (e.code === "Space") { e.preventDefault(); tap(); } };
      window.addEventListener("keydown", keyH);
      ctx.onCleanup(function () { window.removeEventListener("keydown", keyH); });

      function end() {
        var avg = Math.round(times.reduce(function (a, b) { return a + b; }, 0) / times.length);
        // score: faster = higher. 200ms->~800pts, 500ms->~200pts
        var score = Math.max(0, Math.round(1000 - (avg - 150) * 1.6));
        var normalized = Math.max(0, Math.min(100, Math.round((600 - avg) / 4)));
        ctx.finish({
          score: score, accuracy: null, level: null, normalized: normalized,
          detail: "Average reaction: " + avg + " ms over " + times.length + " rounds."
        });
      }
    }
  });
})();
