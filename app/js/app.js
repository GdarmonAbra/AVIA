/* ============================================================
   NeuroNova — app shell / router
   Renders the home dashboard and the progress page, wires nav.
   ============================================================ */
(function (global) {
  "use strict";
  var E = global.NeuroEngine;
  var Store = global.NeuroStore;
  var el = E.el;

  var GAME_NAMES = {};
  E.games.forEach(function (g) { GAME_NAMES[g.id] = g.name; });

  function setActiveNav(route) {
    document.querySelectorAll(".navlink").forEach(function (n) {
      n.classList.toggle("active", n.getAttribute("data-nav") === route);
    });
  }

  // ---------- HOME ----------
  function renderHome() {
    var view = document.getElementById("view");
    view.innerHTML = "";
    var bpi = Store.bpi();

    // hero
    var hero = el("div", "hero");
    var left = el("div");
    left.appendChild(el("h1", null, "Train your brain, every day."));
    left.appendChild(el("p", null, "Six science-inspired games across memory, speed, math, attention and flexibility. A few minutes a day keeps your streak — and your Brain Index — climbing."));
    var cta = el("button", "hero-cta", bpi ? "Continue training" : "Start your first session");
    cta.onclick = function () { startDaily(); };
    left.appendChild(el("div", null, "")); // spacer
    var ctaWrap = el("div"); ctaWrap.style.marginTop = "16px"; ctaWrap.appendChild(cta);
    left.appendChild(ctaWrap);

    var ring = el("div", "bpi-ring");
    var r = el("div", "ring");
    r.style.setProperty("--val", bpi);
    r.style.position = "relative";
    var span = el("span", null, String(bpi));
    var small = el("small", null, "BRAIN INDEX");
    var inner = el("div"); inner.style.position = "relative"; inner.style.zIndex = "1"; inner.style.textAlign = "center";
    inner.appendChild(span); inner.appendChild(small);
    r.appendChild(inner);
    ring.appendChild(r);
    hero.appendChild(left);
    hero.appendChild(ring);
    view.appendChild(hero);

    // categories legend
    var cats = el("div", "cats");
    E.categories.forEach(function (c) {
      var pill = el("div", "cat-pill");
      var dot = el("span", "cat-dot"); dot.style.background = c.color;
      pill.appendChild(dot);
      pill.appendChild(document.createTextNode(c.name));
      cats.appendChild(pill);
    });
    view.appendChild(cats);

    // games section
    var head = el("div", "section-head");
    head.appendChild(el("h2", null, "Games"));
    head.appendChild(el("span", "hint", E.games.length + " exercises"));
    view.appendChild(head);

    var grid = el("div", "grid");
    E.games.forEach(function (g) {
      var cat = E.catById[g.category];
      var card = el("button", "card");
      var bar = el("div", "accent-bar"); bar.style.background = cat.color; card.appendChild(bar);

      var best = Store.best(g.id);
      if (best) { var badge = el("div", "badge", "Best " + best); card.appendChild(badge); }

      var glyph = el("div", "glyph", g.glyph); glyph.style.color = cat.color;
      card.appendChild(glyph);
      var ct = el("div", "cat", cat.name); ct.style.color = cat.color; card.appendChild(ct);
      card.appendChild(el("h3", null, g.name));
      card.appendChild(el("div", "desc", g.blurb));

      var meta = el("div", "meta");
      meta.appendChild(el("span", null, "Tap to play"));
      meta.appendChild(el("span", "best", best ? ("★ " + best) : "—"));
      card.appendChild(meta);

      card.onclick = function () { E.launch(g.id); };
      grid.appendChild(card);
    });
    view.appendChild(grid);
  }

  // Daily session: launch a random game (could be expanded into a playlist)
  function startDaily() {
    var g = E.pick(E.games);
    E.launch(g.id);
  }

  // ---------- STATS ----------
  function renderStats() {
    var view = document.getElementById("view");
    view.innerHTML = "";
    var data = Store.get();

    var head = el("div", "section-head");
    head.appendChild(el("h2", null, "Your progress"));
    head.appendChild(el("span", "hint", "Saved on this device"));
    view.appendChild(head);

    // top stat boxes
    var boxes = el("div", "stat-cards");
    boxes.appendChild(statBox("Brain Index", String(Store.bpi())));
    boxes.appendChild(statBox("Day streak", data.streak + " 🔥"));
    boxes.appendChild(statBox("Sessions", String(data.totalSessions)));
    var played = Object.keys(data.bestScores).length;
    boxes.appendChild(statBox("Games tried", played + " / " + E.games.length));
    view.appendChild(boxes);

    // category bars
    var ch = el("div", "section-head"); ch.appendChild(el("h2", null, "Skills")); view.appendChild(ch);
    var bars = el("div", "cat-bars");
    E.categories.forEach(function (c) {
      var pct = data.catScores[c.id] || 0;
      var row = el("div", "cat-bar-row");
      row.appendChild(el("div", "name", c.name));
      var track = el("div", "cat-track");
      var fill = el("i"); fill.style.width = pct + "%"; fill.style.background = c.color;
      track.appendChild(fill);
      row.appendChild(track);
      row.appendChild(el("div", "pct", pct + "%"));
      bars.appendChild(row);
    });
    view.appendChild(bars);

    // history
    var hh = el("div", "section-head"); hh.style.marginTop = "26px";
    hh.appendChild(el("h2", null, "Recent sessions"));
    if (data.history.length) {
      var resetBtn = el("button", "back-btn", "Reset all data");
      resetBtn.onclick = function () {
        if (global.confirm("Erase all scores, streak and history on this device?")) {
          Store.reset(); renderStats(); E.toast("Progress reset");
        }
      };
      hh.appendChild(resetBtn);
    }
    view.appendChild(hh);

    if (!data.history.length) {
      view.appendChild(el("div", "empty", "No sessions yet — head to Train and play a game!"));
      return;
    }
    var list = el("div", "history-list");
    data.history.forEach(function (h) {
      var cat = E.catById[h.category];
      var row = el("div", "hist-row");
      var dot = el("span", "dot"); dot.style.background = cat ? cat.color : "#888"; row.appendChild(dot);
      row.appendChild(el("span", "g", GAME_NAMES[h.gameId] || h.gameId));
      var acc = (h.accuracy != null && h.accuracy > 0) ? (" · " + h.accuracy + "%") : "";
      row.appendChild(el("span", null, "<span style='color:var(--muted);font-size:13px'>" + (cat ? cat.name : "") + acc + "</span>"));
      row.appendChild(el("span", "when", relTime(h.ts)));
      row.appendChild(el("span", "sc", "+" + h.score));
      list.appendChild(row);
    });
    view.appendChild(list);
  }

  function statBox(k, v) {
    var b = el("div", "stat-box");
    b.appendChild(el("div", "k", k));
    b.appendChild(el("div", "v", v));
    return b;
  }

  function relTime(ts) {
    var s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return "just now";
    var m = Math.floor(s / 60); if (m < 60) return m + "m ago";
    var h = Math.floor(m / 60); if (h < 24) return h + "h ago";
    var d = Math.floor(h / 24); return d + "d ago";
  }

  // ---------- ROUTER ----------
  function go(route) {
    setActiveNav(route);
    if (route === "stats") renderStats();
    else renderHome();
    document.getElementById("view").scrollTop = 0;
    global.scrollTo(0, 0);
  }

  function refreshStreakChip() {
    var data = Store.get();
    document.getElementById("streakCount").textContent = data.streak;
  }

  global.NeuroApp = { go: go, refreshStreak: refreshStreakChip };

  // boot
  document.addEventListener("click", function (e) {
    var nav = e.target.closest("[data-nav]");
    if (nav) { go(nav.getAttribute("data-nav")); }
  });

  // keep streak chip fresh after each game
  var _record = Store.record;
  Store.record = function (r) { var out = _record.call(Store, r); refreshStreakChip(); return out; };

  refreshStreakChip();
  go("home");
})(window);
