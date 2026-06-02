/* ============================================================
   NeuroNova — engine
   - Category metadata
   - Game registry
   - Game lifecycle: intro -> countdown -> play -> results
   - ctx API handed to each game
   ============================================================ */
(function (global) {
  "use strict";

  var categories = [
    { id: "memory",    name: "Memory",        color: "var(--cat-memory)" },
    { id: "speed",     name: "Speed",         color: "var(--cat-speed)" },
    { id: "math",      name: "Math",          color: "var(--cat-math)" },
    { id: "attention", name: "Attention",     color: "var(--cat-attention)" },
    { id: "flex",      name: "Flexibility",   color: "var(--cat-flex)" }
  ];
  var catById = {};
  categories.forEach(function (c) { catById[c.id] = c; });

  var games = [];
  var gameById = {};

  function register(g) {
    games.push(g);
    gameById[g.id] = g;
  }

  // ---- small DOM helpers ----
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  var toastTimer = null;
  function toast(msg) {
    var t = document.getElementById("nn-toast");
    if (!t) {
      t = el("div", "toast"); t.id = "nn-toast";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 1600);
  }

  // ---- lifecycle ----
  // Builds the game shell and shows the intro overlay.
  function launch(gameId, mountFn) {
    var game = gameById[gameId];
    if (!game) return;
    var cat = catById[game.category];

    var view = document.getElementById("view");
    clear(view);

    var shell = el("section", "game-shell");
    var top = el("div", "game-top");
    var back = el("button", "back-btn", "‹ Back");
    back.onclick = function () { cleanup(); global.NeuroApp.go("home"); };
    var title = el("div", "game-title", game.name);
    var hud = el("div", "game-hud"); hud.id = "nn-hud";
    top.appendChild(back); top.appendChild(title); top.appendChild(hud);

    var timebar = el("div", "timebar", "<i></i>"); timebar.style.display = "none";
    var stage = el("div", "game-stage"); stage.id = "nn-stage";

    shell.appendChild(top);
    shell.appendChild(timebar);
    shell.appendChild(stage);
    view.appendChild(shell);

    var cleanups = [];
    function cleanup() { cleanups.forEach(function (fn) { try { fn(); } catch (e) {} }); cleanups = []; }

    // ctx given to the game
    var timeFill = timebar.querySelector("i");
    var activeTimer = null;

    var ctx = {
      stage: stage,
      cat: cat,
      el: el,
      clear: function () { clear(stage); },
      toast: toast,
      onCleanup: function (fn) { cleanups.push(fn); },

      setHud: function (items) {
        clear(hud);
        items.forEach(function (it) {
          var box = el("div", "hud-item");
          box.appendChild(el("div", "k", it.k));
          box.appendChild(el("div", "v", it.v));
          hud.appendChild(box);
        });
      },

      showTimebar: function (show) { timebar.style.display = show ? "block" : "none"; },
      setTime: function (frac) { timeFill.style.width = Math.max(0, Math.min(1, frac)) * 100 + "%"; },

      // A clock that ticks every 100ms for `seconds`. Drives the timebar.
      countdownClock: function (seconds, onDone, onTick) {
        ctx.showTimebar(true);
        var total = seconds * 1000;
        var start = Date.now();
        ctx.setTime(1);
        activeTimer = setInterval(function () {
          var elapsed = Date.now() - start;
          var frac = 1 - elapsed / total;
          ctx.setTime(frac);
          if (onTick) onTick(Math.max(0, Math.ceil((total - elapsed) / 1000)));
          if (elapsed >= total) {
            clearInterval(activeTimer); activeTimer = null;
            onDone();
          }
        }, 100);
        cleanups.push(function () { if (activeTimer) clearInterval(activeTimer); });
        return { stop: function () { if (activeTimer) { clearInterval(activeTimer); activeTimer = null; } } };
      },

      // 3-2-1 overlay then run cb
      countIn: function (cb) {
        var n = 3;
        var ov = el("div", "count-overlay", "3");
        stage.appendChild(ov);
        var iv = setInterval(function () {
          n -= 1;
          if (n === 0) { ov.textContent = "GO"; }
          else if (n < 0) { clearInterval(iv); ov.remove(); cb(); return; }
          else { ov.textContent = String(n); }
          ov.style.animation = "none"; void ov.offsetWidth; ov.style.animation = "pop .25s ease";
        }, 700);
        cleanups.push(function () { clearInterval(iv); });
      },

      finish: function (result) {
        if (activeTimer) { clearInterval(activeTimer); activeTimer = null; }
        cleanup();
        result.gameId = game.id;
        result.category = game.category;
        var outcome = global.NeuroStore.record(result);
        showResults(game, cat, result, outcome, mountFn);
      }
    };

    showIntro(game, cat, stage, ctx);
  }

  function showIntro(game, cat, stage, ctx) {
    clear(stage);
    var ov = el("div", "overlay");
    ov.appendChild(el("div", null, "<div class='glyph' style='margin:0 auto 14px;width:64px;height:64px;font-size:32px;background:rgba(255,255,255,.06);border-radius:18px;display:grid;place-items:center'>" + game.glyph + "</div>"));
    ov.appendChild(el("h3", null, game.name));
    ov.appendChild(el("p", null, game.howto));
    var best = global.NeuroStore.best(game.id);
    if (best) ov.appendChild(el("p", null, "<strong style='color:var(--accent)'>Personal best: " + best + "</strong>"));
    var btn = el("button", "btn-primary", "Start");
    btn.onclick = function () { game.play(ctx); };
    ov.appendChild(btn);
    stage.appendChild(ov);
  }

  function showResults(game, cat, result, outcome, mountFn) {
    var view = document.getElementById("view");
    var shell = view.querySelector(".game-shell");
    var stage = document.getElementById("nn-stage");
    var hud = document.getElementById("nn-hud");
    if (hud) clear(hud);
    var tb = shell.querySelector(".timebar"); if (tb) tb.style.display = "none";
    clear(stage);

    var r = el("div", "result");
    if (outcome.isBest) r.appendChild(el("div", "pb", "★ New personal best!"));
    r.appendChild(el("div", "label", "Score"));
    r.appendChild(el("div", "big-score", String(result.score)));

    var row = el("div", "stat-row");
    function stat(k, v) {
      var b = el("div");
      b.appendChild(el("div", "v", v));
      b.appendChild(el("div", "label", k));
      return b;
    }
    if (result.accuracy != null) row.appendChild(stat("Accuracy", Math.round(result.accuracy) + "%"));
    if (result.level != null) row.appendChild(stat("Level", String(result.level)));
    row.appendChild(stat("Best", String(global.NeuroStore.best(game.id))));
    r.appendChild(row);

    if (result.detail) r.appendChild(el("p", null, "<span style='color:var(--muted)'>" + result.detail + "</span>"));

    var btns = el("div", "btn-row");
    var again = el("button", "btn-primary", "Play again");
    again.onclick = function () { launch(game.id, mountFn); };
    var home = el("button", "btn-ghost", "Back to training");
    home.onclick = function () { global.NeuroApp.go("home"); };
    btns.appendChild(again); btns.appendChild(home);
    r.appendChild(btns);

    stage.appendChild(r);
  }

  global.NeuroEngine = {
    categories: categories,
    catById: catById,
    games: games,
    gameById: gameById,
    register: register,
    launch: launch,
    el: el,
    toast: toast,
    // utility: pick random int [min,max]
    rand: function (min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; },
    pick: function (arr) { return arr[Math.floor(Math.random() * arr.length)]; },
    shuffle: function (arr) {
      var a = arr.slice();
      for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
    }
  };
})(window);
