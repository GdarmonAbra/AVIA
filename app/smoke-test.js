/* Headless smoke test for NeuroNova — no browser needed.
   Stubs a minimal DOM + localStorage, loads every script, and exercises boot,
   game registration, and a scored session end-to-end. Run: node app/smoke-test.js */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function makeEl(tag) {
  const node = {
    tagName: tag, className: "", _html: "", textContent: "",
    children: [], style: new Proxy({}, {
      get: (t, k) => {
        if (k === "setProperty") return (p, v) => { t[p] = v; };
        if (k === "getPropertyValue") return (p) => t[p] || "";
        return t[k] || "";
      },
      set: (t, k, v) => (t[k] = v, true)
    }),
    offsetWidth: 100, onclick: null,
    classList: {
      _s: new Set(),
      add(...c) { c.forEach(x => this._s.add(x)); },
      remove(...c) { c.forEach(x => this._s.delete(x)); },
      toggle(c, on) { on ? this._s.add(c) : this._s.delete(c); },
      contains(c) { return this._s.has(c); }
    },
    _attrs: {},
    setAttribute(k, v) { this._attrs[k] = v; },
    getAttribute(k) { return this._attrs[k] ?? null; },
    appendChild(c) { this.children.push(c); c.parentNode = this; return c; },
    removeChild(c) { this.children = this.children.filter(x => x !== c); },
    get firstChild() { return this.children[0] || null; },
    remove() { if (this.parentNode) this.parentNode.removeChild(this); },
    querySelector() { return makeEl("div"); },
    querySelectorAll() { return []; },
    closest() { return null; },
    addEventListener() {}, removeEventListener() {}
  };
  Object.defineProperty(node, "innerHTML", {
    get() { return node._html; },
    set(v) { node._html = v; if (v === "") node.children = []; }
  });
  return node;
}

const byId = {};
["view", "streakCount", "nn-hud", "nn-stage", "nn-toast"].forEach(id => (byId[id] = makeEl("div")));

const store = {};
const localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => (store[k] = String(v)),
  removeItem: k => delete store[k]
};

const document = {
  createElement: makeEl,
  createTextNode: (t) => { const n = makeEl("#text"); n.textContent = t; return n; },
  getElementById: id => byId[id] || (byId[id] = makeEl("div")),
  querySelectorAll: () => [],
  addEventListener: () => {},
  body: makeEl("body")
};

const sandbox = {
  window: null, document, localStorage,
  performance: { now: () => Date.now() },
  setTimeout, clearTimeout, setInterval, clearInterval,
  confirm: () => true, scrollTo: () => {}, console, Math, Date, JSON, Object, Array, parseInt, parseFloat
};
sandbox.window = sandbox;
vm.createContext(sandbox);

const files = [
  "js/storage.js", "js/engine.js",
  "js/games/memory-matrix.js", "js/games/speed-match.js", "js/games/math-blitz.js",
  "js/games/reaction.js", "js/games/n-back.js", "js/games/color-match.js",
  "js/app.js"
];
for (const f of files) {
  const code = fs.readFileSync(path.join(__dirname, f), "utf8");
  vm.runInContext(code, sandbox, { filename: f });
}

let pass = 0, fail = 0;
function check(name, cond) { cond ? (pass++, console.log("  ✓ " + name)) : (fail++, console.error("  ✗ " + name)); }

console.log("NeuroNova smoke test");
check("6 games registered", sandbox.NeuroEngine.games.length === 6);
check("5 categories", sandbox.NeuroEngine.categories.length === 5);
check("every game has play()", sandbox.NeuroEngine.games.every(g => typeof g.play === "function"));
check("every game maps to a real category", sandbox.NeuroEngine.games.every(g => !!sandbox.NeuroEngine.catById[g.category]));
check("store starts empty", sandbox.NeuroStore.get().totalSessions === 0);

// simulate finishing a game
const out = sandbox.NeuroStore.record({ gameId: "math-blitz", category: "math", score: 320, accuracy: 88, level: 5, normalized: 91 });
check("record returns isBest", out.isBest === true);
check("best persisted", sandbox.NeuroStore.best("math-blitz") === 320);
check("streak started at 1", sandbox.NeuroStore.get().streak === 1);
check("bpi reflects category", sandbox.NeuroStore.bpi() > 0);
check("history recorded", sandbox.NeuroStore.get().history.length === 1);

// router renders without throwing
let routerOk = true;
try { sandbox.NeuroApp.go("home"); sandbox.NeuroApp.go("stats"); sandbox.NeuroApp.go("home"); }
catch (e) { routerOk = false; console.error(e); }
check("router renders home + stats", routerOk);

// reset
sandbox.NeuroStore.reset();
check("reset clears sessions", sandbox.NeuroStore.get().totalSessions === 0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
