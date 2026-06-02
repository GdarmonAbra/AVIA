/* Memory Matrix — spatial working memory.
   A pattern of tiles flashes; reproduce it. Grid + pattern grow as you advance. */
(function () {
  "use strict";
  var E = window.NeuroEngine;

  E.register({
    id: "memory-matrix",
    name: "Memory Matrix",
    category: "memory",
    glyph: "▦",
    blurb: "Memorize the lit tiles, then recreate the pattern. The grid keeps growing.",
    howto: "A pattern of tiles lights up for a moment. When it fades, tap the tiles that were lit. Each cleared level adds more tiles — three mistakes ends the run.",

    play: function (ctx) {
      var level = 1;
      var lives = 3;
      var score = 0;
      var correctTiles = 0, totalTiles = 0;

      function gridSize() { return Math.min(3 + Math.floor((level - 1) / 2), 7); } // 3x3 up to 7x7
      function patternCount(n) { return Math.min(3 + level, Math.floor(n * n * 0.5)); }

      function hud() {
        ctx.setHud([
          { k: "Level", v: String(level) },
          { k: "Score", v: String(score) },
          { k: "Lives", v: "♥".repeat(lives) || "—" }
        ]);
      }

      function round() {
        hud();
        ctx.clear();
        var n = gridSize();
        var count = patternCount(n);

        var wrap = ctx.el("div");
        var sub = ctx.el("div", "prompt-sub", "Memorize the pattern…");
        var matrix = ctx.el("div", "matrix");
        matrix.style.gridTemplateColumns = "repeat(" + n + ", 1fr)";
        matrix.style.width = Math.min(72 * n, 460) + "px";

        var tiles = [];
        for (var i = 0; i < n * n; i++) {
          var t = ctx.el("button", "tile locked");
          tiles.push(t); matrix.appendChild(t);
        }
        wrap.appendChild(sub);
        wrap.appendChild(matrix);
        ctx.stage.appendChild(wrap);

        // choose pattern
        var idx = [];
        for (var k = 0; k < n * n; k++) idx.push(k);
        var pattern = E.shuffle(idx).slice(0, count);
        var patSet = {};
        pattern.forEach(function (p) { patSet[p] = true; tiles[p].classList.add("lit"); });

        // hide after a beat, then accept input
        var flashMs = 700 + count * 180;
        var to = setTimeout(function () {
          pattern.forEach(function (p) { tiles[p].classList.remove("lit"); });
          tiles.forEach(function (t) { t.classList.remove("locked"); });
          sub.textContent = "Recreate the pattern (" + count + " tiles)";
          enableInput();
        }, flashMs);
        ctx.onCleanup(function () { clearTimeout(to); });

        var found = 0, mistakes = 0;
        function enableInput() {
          tiles.forEach(function (t, i) {
            t.onclick = function () {
              if (t.classList.contains("correct") || t.classList.contains("wrong")) return;
              totalTiles++;
              if (patSet[i]) {
                t.classList.add("correct"); found++; correctTiles++;
                if (found === count) { setTimeout(levelUp, 350); }
              } else {
                t.classList.add("wrong"); mistakes++;
                loseLife();
              }
            };
          });
        }

        function freeze() { tiles.forEach(function (t) { t.classList.add("locked"); }); }

        function levelUp() {
          score += count * 10 * level;
          level += 1;
          round();
        }

        function loseLife() {
          lives -= 1; hud(); freeze();
          // reveal remaining
          pattern.forEach(function (p) { if (!tiles[p].classList.contains("correct")) tiles[p].classList.add("lit"); });
          if (lives <= 0) { setTimeout(end, 900); }
          else { ctx.toast("Miss! " + lives + " left"); setTimeout(round, 1100); }
        }
      }

      function end() {
        var acc = totalTiles ? (correctTiles / totalTiles) * 100 : 0;
        // normalized: reaching level ~12 with a 7x7 board is strong
        var normalized = Math.min(100, Math.round((level - 1) / 12 * 100));
        ctx.finish({
          score: score, accuracy: acc, level: level - 1, normalized: normalized,
          detail: "You cleared level " + (level - 1) + "."
        });
      }

      ctx.countIn(round);
    }
  });
})();
