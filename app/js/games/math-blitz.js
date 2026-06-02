/* Math Blitz — mental arithmetic under time pressure.
   Pick the correct answer. Difficulty scales with your streak. */
(function () {
  "use strict";
  var E = window.NeuroEngine;

  E.register({
    id: "math-blitz",
    name: "Math Blitz",
    category: "math",
    glyph: "➗",
    blurb: "Solve as many arithmetic problems as you can before time runs out.",
    howto: "Pick the correct answer to each problem. Right answers build a streak that raises difficulty and points; a wrong answer breaks the streak. You have 60 seconds.",

    play: function (ctx) {
      var DURATION = 60;
      var score = 0, correct = 0, wrong = 0, streak = 0, best = 0;
      var ended = false;
      var answer = 0;

      ctx.clear();
      var q = E.el("div", "math-q", "");
      var opts = E.el("div", "math-options");
      ctx.stage.appendChild(q);
      ctx.stage.appendChild(opts);

      function hud() {
        ctx.setHud([
          { k: "Score", v: String(score) },
          { k: "Streak", v: String(streak) }
        ]);
      }

      function tier() { return 1 + Math.floor(streak / 4); } // harder as streak grows

      function gen() {
        var t = tier();
        var ops = t >= 3 ? ["+", "-", "×", "÷"] : t === 2 ? ["+", "-", "×"] : ["+", "-"];
        var op = E.pick(ops);
        var a, b, text;
        var range = 9 + t * 6;
        if (op === "+") { a = E.rand(2, range); b = E.rand(2, range); answer = a + b; }
        else if (op === "-") { a = E.rand(2, range); b = E.rand(1, a); answer = a - b; }
        else if (op === "×") { a = E.rand(2, 4 + t * 2); b = E.rand(2, 6 + t); answer = a * b; }
        else { b = E.rand(2, 6 + t); answer = E.rand(2, 6 + t); a = b * answer; } // a ÷ b = answer (clean)
        text = a + " " + op + " " + b;
        q.textContent = text + " = ?";

        var choices = [answer];
        while (choices.length < 4) {
          var delta = E.rand(1, Math.max(3, Math.round(answer * 0.3) + 2));
          var cand = answer + (Math.random() < 0.5 ? -delta : delta);
          if (cand < 0 || choices.indexOf(cand) !== -1) continue;
          choices.push(cand);
        }
        choices = E.shuffle(choices);

        opts.innerHTML = "";
        choices.forEach(function (c) {
          var btn = E.el("button", "opt-btn", String(c));
          btn.onclick = function () { choose(c, btn); };
          opts.appendChild(btn);
        });
      }

      function choose(val, btn) {
        if (ended) return;
        if (val === answer) {
          correct++; streak++; best = Math.max(best, streak);
          score += 10 * tier();
          btn.classList.add("good");
        } else {
          wrong++; streak = 0;
          btn.classList.add("bad");
        }
        hud();
        setTimeout(gen, 160);
      }

      var keyH = function (e) {
        if (e.key >= "1" && e.key <= "4") {
          var i = parseInt(e.key, 10) - 1;
          var btns = opts.querySelectorAll(".opt-btn");
          if (btns[i]) btns[i].click();
        }
      };
      window.addEventListener("keydown", keyH);
      ctx.onCleanup(function () { window.removeEventListener("keydown", keyH); });

      hud();
      ctx.countIn(function () {
        gen();
        ctx.countdownClock(DURATION, end);
      });

      function end() {
        ended = true;
        var total = correct + wrong;
        var acc = total ? (correct / total) * 100 : 0;
        var normalized = Math.min(100, Math.round(score / 350 * 100));
        ctx.finish({
          score: score, accuracy: acc, level: best, normalized: normalized,
          detail: correct + " solved · best streak " + best + "."
        });
      }
    }
  });
})();
