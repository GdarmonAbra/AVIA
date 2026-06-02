/* N-Back — working memory.
   A letter appears each beat. Hit MATCH when it equals the one N steps back. */
(function () {
  "use strict";
  var E = window.NeuroEngine;
  var LETTERS = ["A", "B", "C", "D", "E", "F", "H", "K", "L", "P", "R", "T"];

  E.register({
    id: "n-back",
    name: "N-Back",
    category: "memory",
    glyph: "🧠",
    blurb: "The classic working-memory drill. Spot when a letter repeats N steps back.",
    howto: "Letters flash one at a time. Press MATCH (or Space) whenever the current letter is the same as the one shown N steps earlier. This is a 2-back round of 25 letters.",

    play: function (ctx) {
      var N = 2;
      var TRIALS = 25;
      var seq = [];
      var i = -1;
      var responded = false;
      var hits = 0, misses = 0, falseAlarms = 0, targets = 0;
      var ended = false;
      var iv = null;

      ctx.clear();
      var nb = E.el("div", "nb-cell", "");
      var btn = E.el("button", "btn-primary", "MATCH (space)");
      btn.style.minWidth = "200px";
      var sub = E.el("div", "prompt-sub", "Press MATCH when the letter equals the one " + N + " back.");
      ctx.stage.appendChild(sub);
      ctx.stage.appendChild(nb);
      ctx.stage.appendChild(btn);

      function hud() {
        ctx.setHud([
          { k: "N", v: String(N) },
          { k: "Trial", v: Math.max(0, i + 1) + "/" + TRIALS },
          { k: "Hits", v: String(hits) }
        ]);
      }
      hud();

      // pre-generate sequence with ~30% targets
      function buildSeq() {
        for (var k = 0; k < TRIALS; k++) {
          if (k >= N && Math.random() < 0.32) {
            seq.push(seq[k - N]); // force a target
          } else {
            var c;
            do { c = E.pick(LETTERS); } while (k >= N && c === seq[k - N]);
            seq.push(c);
          }
        }
        for (var t = N; t < TRIALS; t++) if (seq[t] === seq[t - N]) targets++;
      }

      function isTarget() { return i >= N && seq[i] === seq[i - N]; }

      function step() {
        i++;
        hud();
        if (i >= TRIALS) { finishUp(); return; }
        responded = false;
        nb.textContent = seq[i];
        nb.className = "nb-cell flash";
        void nb.offsetWidth; nb.classList.add("flash");
      }

      function isTargetAt(idx) { return idx >= N && seq[idx] === seq[idx - N]; }

      function gradePending() {
        // when we leave a trial without a response, score the miss/correct-rejection
        if (i < 0) return;
        if (!responded) {
          if (isTargetAt(i)) misses++;
        }
      }

      function respond() {
        if (ended || i < 0 || responded) return;
        responded = true;
        if (isTargetAt(i)) { hits++; nb.style.borderColor = "var(--good)"; }
        else { falseAlarms++; nb.style.borderColor = "var(--danger)"; }
        hud();
        setTimeout(function () { nb.style.borderColor = ""; }, 250);
      }

      btn.onclick = respond;
      var keyH = function (e) { if (e.code === "Space") { e.preventDefault(); respond(); } };
      window.addEventListener("keydown", keyH);
      ctx.onCleanup(function () { window.removeEventListener("keydown", keyH); });

      buildSeq();

      ctx.countIn(function () {
        ctx.showTimebar(true);
        var stepMs = 2200;
        // first step immediately
        step();
        iv = setInterval(function () {
          gradePending();
          step();
        }, stepMs);
        ctx.onCleanup(function () { clearInterval(iv); });
        // simple progress on timebar over whole run
        var startT = Date.now();
        var totalT = stepMs * TRIALS;
        var pv = setInterval(function () {
          ctx.setTime(1 - (Date.now() - startT) / totalT);
        }, 100);
        ctx.onCleanup(function () { clearInterval(pv); });
      });

      function finishUp() {
        if (ended) return;
        ended = true;
        clearInterval(iv);
        var correctRejections = (TRIALS - N) - targets - falseAlarms;
        var totalDecisions = (TRIALS - N);
        var correct = hits + Math.max(0, correctRejections);
        var acc = totalDecisions ? (correct / totalDecisions) * 100 : 0;
        var score = Math.max(0, hits * 50 - falseAlarms * 25 - misses * 15);
        var normalized = Math.min(100, Math.round(acc));
        ctx.finish({
          score: score, accuracy: acc, level: N, normalized: normalized,
          detail: hits + " hits · " + misses + " misses · " + falseAlarms + " false alarms (of " + targets + " targets)."
        });
      }
    }
  });
})();
