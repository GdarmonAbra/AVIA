/* ============================================================
   NeuroNova — persistence layer
   Everything lives in localStorage under a single namespaced key.
   ============================================================ */
(function (global) {
  "use strict";

  var KEY = "neuronova.v1";

  var DEFAULT = {
    bestScores: {},      // gameId -> best score
    history: [],         // [{gameId, score, accuracy, ts, level}]
    catScores: {},       // category -> rolling best (0..100 normalized)
    streak: 0,
    lastPlayedDay: null, // YYYY-MM-DD
    totalSessions: 0
  };

  function load() {
    try {
      var raw = global.localStorage.getItem(KEY);
      if (!raw) return clone(DEFAULT);
      var data = JSON.parse(raw);
      // shallow-merge defaults so new fields don't break old saves
      return Object.assign(clone(DEFAULT), data);
    } catch (e) {
      return clone(DEFAULT);
    }
  }

  function save(data) {
    try {
      global.localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) { /* storage may be unavailable / full — fail silently */ }
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }

  function daysBetween(a, b) {
    var da = new Date(a + "T00:00:00");
    var db = new Date(b + "T00:00:00");
    return Math.round((db - da) / 86400000);
  }

  var Store = {
    get: function () { return load(); },

    /**
     * Record a finished game.
     * result = { gameId, category, score, accuracy (0..100), level, normalized (0..100) }
     * Returns { isBest, prevBest, streak }.
     */
    record: function (result) {
      var data = load();
      var prevBest = data.bestScores[result.gameId] || 0;
      var isBest = result.score > prevBest;
      if (isBest) data.bestScores[result.gameId] = result.score;

      // category brain-index: keep the best normalized performance seen
      var cat = result.category;
      var norm = clamp(result.normalized != null ? result.normalized : result.score, 0, 100);
      data.catScores[cat] = Math.max(data.catScores[cat] || 0, Math.round(norm));

      data.history.unshift({
        gameId: result.gameId,
        category: cat,
        score: result.score,
        accuracy: Math.round(result.accuracy || 0),
        level: result.level || null,
        ts: Date.now()
      });
      if (data.history.length > 60) data.history.length = 60;

      // streak handling
      var today = todayStr();
      if (data.lastPlayedDay !== today) {
        if (data.lastPlayedDay && daysBetween(data.lastPlayedDay, today) === 1) {
          data.streak += 1;
        } else {
          data.streak = 1;
        }
        data.lastPlayedDay = today;
      } else if (data.streak === 0) {
        data.streak = 1;
      }

      data.totalSessions += 1;
      save(data);
      return { isBest: isBest, prevBest: prevBest, streak: data.streak };
    },

    best: function (gameId) { return load().bestScores[gameId] || 0; },

    /** Overall Brain Performance Index — average of category indices. */
    bpi: function () {
      var data = load();
      var cats = global.NeuroEngine ? global.NeuroEngine.categories : [];
      if (!cats.length) return 0;
      var sum = 0, n = 0;
      cats.forEach(function (c) {
        sum += data.catScores[c.id] || 0;
        n += 1;
      });
      return n ? Math.round(sum / n) : 0;
    },

    reset: function () { save(clone(DEFAULT)); }
  };

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  global.NeuroStore = Store;
})(window);
