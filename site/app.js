/* Camp Wild Heart — selective exposure study.
 *
 * Flow: ID page -> Set 1 (4 episodes, one per condition, random order,
 *       shown one at a time) -> Set 2 (the other 4, random order) -> finish.
 *
 * Per episode we record:
 *   title_view_ms    time that episode's title card was on screen (tab in focus)
 *   title_views      how many times the participant landed on that card
 *   readmore_clicks  number of times "Read More" was opened (clicked = clicks > 0)
 *   readmore_ms      total time spent on the Read More page
 * All timers pause while the browser tab is hidden.
 */

// ---------------------------------------------------------------- config ---
const CONFIG = {
  // TEST_MODE pre-fills a test ID so you can click straight through.
  // Set to false before launching on Prolific / CloudResearch.
  TEST_MODE: true,

  // URL parameters checked (in order) for a participant ID to pre-fill.
  // Prolific: PROLIFIC_PID. CloudResearch Connect: participantId. MTurk Toolkit: workerId.
  ID_PARAMS: ["PROLIFIC_PID", "participantId", "workerId", "pid"],

  // Google Apps Script web-app URL that receives the data (see README.md).
  // Leave "" to skip sending (e.g. while testing).
  DATA_ENDPOINT: "",

  // Where to send the participant afterwards; {pid} is replaced with their ID.
  // Prolific example: "https://app.prolific.com/submissions/complete?cc=XXXXXXX"
  // Leave "" to show a thank-you page.
  REDIRECT_URL: "",

  // Minimum seconds on each episode card before "Next" is enabled (0 = none).
  MIN_SECONDS_PER_EPISODE: 0,

  // Shown on a standalone page before each part. HTML is allowed.
  INSTRUCTIONS: {
    set1: `<p class="placeholder">[INSTRUCTION: needs to be updated]</p>
      <p>You’ll see four episodes from the Camp Wild Heart podcast, one at a time. Browse them as you normally would, and click “Read More” on any episode you’d like to learn more about.</p>`,
    set2: `<p class="placeholder">[INSTRUCTION: needs to be updated]</p>
      <p>Here are four more episodes from Camp Wild Heart. Again, browse them as you normally would, and click “Read More” on any episode you’d like to learn more about.</p>`,
  },
};

const CONDITIONS = ["growth", "neutral", "rejection", "unwavering"];
const SETS = ["set1", "set2"];
const STORAGE_KEY = "cwh_state_v3";
const params = new URLSearchParams(location.search);
const DEBUG = params.has("debug");
const byId = Object.fromEntries(window.EPISODES.map((e) => [e.id, e]));
const urlId = CONFIG.ID_PARAMS.map((p) => params.get(p)).find(Boolean) || "";

// ----------------------------------------------------------------- state ---
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function newState() {
  // For each condition, randomly pick which of its two episodes goes to set 1.
  const set1 = [], set2 = [];
  for (const cond of CONDITIONS) {
    const pair = shuffle(window.EPISODES.filter((e) => e.condition === cond).map((e) => e.id));
    set1.push(pair[0]);
    set2.push(pair[1]);
  }
  const metrics = {};
  for (const [set, ids] of [["set1", set1], ["set2", set2]]) {
    metrics[set] = {};
    for (const id of ids) {
      metrics[set][id] = { title_view_ms: 0, title_views: 0, readmore_clicks: 0, readmore_ms: 0, readmore_visits: [] };
    }
  }
  return {
    pid: "",
    url_id: urlId,
    started_at: new Date().toISOString(),
    order: { set1: shuffle(set1), set2: shuffle(set2) },
    current: "id",
    pos: { set1: 0, set2: 0 },
    set_ms: { set1: 0, set2: 0 },
    intro_ms: { set1: 0, set2: 0 },
    intro_done: { set1: false, set2: false },
    metrics,
    events: [],
  };
}

function loadState() {
  try {
    const s = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
    // Start fresh if a different participant ID arrives in this tab.
    if (s && (!urlId || s.url_id === urlId)) return s;
  } catch (e) {}
  return newState();
}

let state = loadState();
const t0 = Date.parse(state.started_at);

function save() {
  timers.forEach((t) => t.flush());
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
}

function logEvent(type, extra = {}) {
  state.events.push({ t_ms: Date.now() - t0, type, set: state.current, ...extra });
}

// ---------------------------------------------------------------- timers ---
// A Timer accumulates milliseconds into obj[field] while it is "wanted"
// and the tab is visible.
const timers = new Set();

class Timer {
  constructor(obj, field) {
    this.obj = obj; this.field = field;
    this.want = false; this.since = null;
    timers.add(this);
  }
  set(want) { this.want = want; this.sync(); }
  sync() {
    const run = this.want && document.visibilityState === "visible";
    if (run && this.since === null) this.since = performance.now();
    else if (!run && this.since !== null) this.flush(), (this.since = null);
  }
  flush() {
    if (this.since === null) return;
    const now = performance.now();
    this.obj[this.field] += now - this.since;
    this.since = now;
  }
  dispose() { this.set(false); timers.delete(this); }
}

document.addEventListener("visibilitychange", () => {
  timers.forEach((t) => t.sync());
  logEvent("tab_" + document.visibilityState);
  save();
});
window.addEventListener("pagehide", save);
setInterval(save, 2000);

// ----------------------------------------------------------------- views ---
const app = document.getElementById("app");
let teardown = () => {};

function h(tag, attrs = {}, html = "") {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.innerHTML = html;
  return el;
}

function route() {
  teardown();
  teardown = () => {};
  window.scrollTo(0, 0);
  if (state.current === "id") return renderId();
  if (state.current === "done") return renderDone();
  if (!state.intro_done[state.current]) return renderIntro(state.current);
  const m = location.hash.match(/^#\/ep\/(\w+)$/);
  if (m && state.metrics[state.current][m[1]]) return renderReadMore(m[1]);
  if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  renderEpisode();
}
window.addEventListener("hashchange", route);

function go(next) {
  state.current = next;
  save();
  route();
}

function renderId() {
  const prefill = urlId || (CONFIG.TEST_MODE ? "test-" + Math.random().toString(36).slice(2, 7) : "");
  app.innerHTML = `
    <section class="panel intro">
      <p class="eyebrow">Before we begin</p>
      <h1>Confirm your participant ID</h1>
      <p class="muted">Please enter your Prolific or CloudResearch ID below. This is only used to match your responses and give you credit.</p>
      <form id="id-form" novalidate>
        <label for="pid">Participant ID</label>
        <input id="pid" name="pid" autocomplete="off" spellcheck="false" value="${prefill}">
        <p class="error" id="pid-error" hidden>Please enter your participant ID.</p>
        <button class="btn" type="submit">Start</button>
      </form>
      ${CONFIG.TEST_MODE ? `<p class="test-note">Test mode is on, so a test ID is pre-filled.</p>` : ""}
    </section>`;
  const input = app.querySelector("#pid");
  app.querySelector("#id-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const v = input.value.trim();
    if (!v) return (app.querySelector("#pid-error").hidden = false), input.focus();
    state.pid = v;
    logEvent("id_confirmed", { id_matches_url: urlId ? v === urlId : null });
    go("set1");
  });
}

function renderIntro(set) {
  const n = SETS.indexOf(set) + 1;
  app.innerHTML = `
    <section class="panel intro">
      <p class="eyebrow">Part ${n} of 2</p>
      <h1>Instructions</h1>
      <div class="intro-text">${CONFIG.INSTRUCTIONS[set]}</div>
      <button class="btn" id="begin" type="button">Begin</button>
    </section>`;
  logEvent("view_instructions");
  const timer = new Timer(state.intro_ms, set);
  timer.set(true);
  app.querySelector("#begin").addEventListener("click", () => {
    state.intro_done[set] = true;
    logEvent("begin_set");
    save();
    route();
  });
  teardown = () => { timer.dispose(); save(); };
}

function renderEpisode() {
  const set = state.current;
  const order = state.order[set];
  const i = state.pos[set];
  const id = order[i];
  const ep = byId[id];
  const mm = state.metrics[set][id];
  const last = i === order.length - 1;

  mm.title_views += 1;
  logEvent("view_title", { episode: id, condition: ep.condition, position: i + 1 });

  const dots = order.map((_, k) => `<span class="dot${k === i ? " on" : k < i ? " seen" : ""}"></span>`).join("");
  app.innerHTML = `
    <div class="progress">
      <span>Part ${SETS.indexOf(set) + 1} of 2 · Episode ${i + 1} of ${order.length}</span>
      <span class="dots">${dots}</span>
    </div>
    <article class="panel episode" data-episode="${id}">
      <img class="cover" src="assets/logo.jpg" alt="Camp Wild Heart podcast cover art">
      <div class="episode-text">
        <p class="eyebrow">Camp Wild Heart · Podcast</p>
        <h2 class="episode-title">${ep.title}</h2>
        <p class="episode-summary">${ep.summary}</p>
        <a class="read-more" href="#/ep/${id}">Read More <span aria-hidden="true">→</span></a>
      </div>
    </article>
    <nav class="nav">
      <button class="btn ghost" id="prev" type="button" ${i === 0 ? "disabled" : ""}>← Previous</button>
      <button class="btn" id="next" type="button">${last ? (set === "set1" ? "Continue to Part 2" : "Finish") : "Next episode →"}</button>
    </nav>`;

  const titleTimer = new Timer(mm, "title_view_ms");
  const setTimer = new Timer(state.set_ms, set);
  titleTimer.set(true);
  setTimer.set(true);
  let wait = null;

  const next = app.querySelector("#next");
  if (CONFIG.MIN_SECONDS_PER_EPISODE > 0) {
    next.disabled = true;
    wait = setInterval(() => {
      if (mm.title_view_ms >= CONFIG.MIN_SECONDS_PER_EPISODE * 1000) next.disabled = false, clearInterval(wait);
    }, 200);
  }

  // Read More stays in this tab so its reading time can be measured.
  const link = app.querySelector(".read-more");
  const open = (e) => {
    e.preventDefault();
    mm.readmore_clicks += 1;
    logEvent("readmore_open", { episode: id, condition: ep.condition });
    location.hash = `#/ep/${id}`;
  };
  link.addEventListener("click", open);
  link.addEventListener("auxclick", open);

  app.querySelector("#prev").addEventListener("click", () => {
    state.pos[set] = i - 1;
    save();
    route();
  });
  next.addEventListener("click", () => {
    if (!last) {
      state.pos[set] = i + 1;
      save();
      return route();
    }
    logEvent("continue");
    go(set === "set1" ? "set2" : "done");
  });

  teardown = () => {
    titleTimer.dispose();
    setTimer.dispose();
    clearInterval(wait);
    save();
  };
}

function renderReadMore(id) {
  const set = state.current;
  const ep = byId[id];
  const mm = state.metrics[set][id];
  const visit = { opened_at: new Date().toISOString(), ms: 0, max_scroll_pct: 0 };
  mm.readmore_visits.push(visit);

  app.innerHTML = `
    <a class="back-link" href="#/">← Back to episode</a>
    <article class="panel readmore">
      <div class="readmore-head">
        <img class="cover small" src="assets/logo.jpg" alt="Camp Wild Heart podcast cover art">
        <div>
          <p class="eyebrow">Camp Wild Heart · Episode details</p>
          <h1 class="episode-title">${ep.title}</h1>
        </div>
      </div>
      <div class="episode-body">${ep.body.map((p) => `<p>${p}</p>`).join("")}</div>
    </article>
    <a class="back-link bottom" href="#/">← Back to episode</a>`;

  const total = new Timer(mm, "readmore_ms");
  const thisVisit = new Timer(visit, "ms");
  const setTimer = new Timer(state.set_ms, set);
  [total, thisVisit, setTimer].forEach((t) => t.set(true));

  const body = app.querySelector(".episode-body");
  const onScroll = () => {
    const r = body.getBoundingClientRect();
    const seen = Math.min(r.height, Math.max(0, window.innerHeight - r.top));
    visit.max_scroll_pct = Math.max(visit.max_scroll_pct, Math.round((100 * seen) / r.height));
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  teardown = () => {
    [total, thisVisit, setTimer].forEach((t) => t.dispose());
    window.removeEventListener("scroll", onScroll);
    logEvent("readmore_close", { episode: id, visit_ms: Math.round(visit.ms) });
    save();
  };
}

// ---------------------------------------------------------------- output ---
function flatRecord() {
  const r = {
    pid: state.pid,
    url_id: state.url_id,
    started_at: state.started_at,
    finished_at: state.finished_at || "",
    total_ms: state.finished_at ? Date.parse(state.finished_at) - t0 : "",
    user_agent: navigator.userAgent,
    viewport_w: window.innerWidth,
    viewport_h: window.innerHeight,
    touch_device: matchMedia("(hover: none)").matches ? 1 : 0,
    set1_ms: Math.round(state.set_ms.set1),
    set2_ms: Math.round(state.set_ms.set2),
    set1_instructions_ms: Math.round(state.intro_ms.set1),
    set2_instructions_ms: Math.round(state.intro_ms.set2),
  };
  for (const set of SETS) {
    // Fixed column order (growth, neutral, rejection, unwavering) regardless of display order.
    CONDITIONS.forEach((cond) => {
      const id = state.order[set].find((x) => byId[x].condition === cond);
      const m = state.metrics[set][id];
      const p = `${set}_${cond}_`;
      r[p + "episode"] = id;
      r[p + "position"] = state.order[set].indexOf(id) + 1;
      r[p + "title_view_ms"] = Math.round(m.title_view_ms);
      r[p + "title_views"] = m.title_views;
      r[p + "readmore_clicked"] = m.readmore_clicks > 0 ? 1 : 0;
      r[p + "readmore_clicks"] = m.readmore_clicks;
      r[p + "readmore_ms"] = Math.round(m.readmore_ms);
      r[p + "readmore_max_scroll_pct"] = Math.max(0, ...m.readmore_visits.map((v) => v.max_scroll_pct));
    });
  }
  r.detail_json = JSON.stringify({ order: state.order, metrics: state.metrics, events: state.events });
  return r;
}

function toCsv(rec) {
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  return Object.keys(rec).map(esc).join(",") + "\n" + Object.values(rec).map(esc).join(",") + "\n";
}

async function submit(record) {
  if (window.parent !== window) window.parent.postMessage({ type: "cwh-data", record }, "*");
  if (!CONFIG.DATA_ENDPOINT) return;
  try {
    await fetch(CONFIG.DATA_ENDPOINT, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(record),
      keepalive: true,
    });
  } catch (e) {
    console.error("Data submission failed", e);
  }
}

async function renderDone() {
  app.innerHTML = `<section class="panel done"><p class="muted">Saving your responses…</p></section>`;
  if (!state.finished_at) {
    state.finished_at = new Date().toISOString();
    logEvent("finish");
    save();
  }
  const record = flatRecord();
  if (!state.submitted) {
    await submit(record);
    state.submitted = true;
    save();
  }
  if (CONFIG.REDIRECT_URL) {
    location.href = CONFIG.REDIRECT_URL.replace("{pid}", encodeURIComponent(state.pid));
    return;
  }
  app.innerHTML = `
    <section class="panel done">
      <h1>Thank you!</h1>
      <p class="muted">Your responses have been recorded. You may now close this window.</p>
    </section>`;
  if (CONFIG.TEST_MODE || DEBUG) {
    const tools = h("div", { class: "test-tools" });
    const dl = h("button", { class: "btn", type: "button" }, "Download data (CSV)");
    dl.onclick = () => {
      const a = h("a", {
        href: URL.createObjectURL(new Blob([toCsv(record)], { type: "text/csv" })),
        download: `cwh_${state.pid}.csv`,
      });
      a.click();
    };
    const reset = h("button", { class: "btn ghost", type: "button" }, "Start over");
    reset.onclick = () => { sessionStorage.removeItem(STORAGE_KEY); location.hash = ""; location.reload(); };
    tools.append(dl, reset);
    app.querySelector(".done").append(tools);
  }
}

// ----------------------------------------------------------------- debug ---
if (DEBUG) {
  const panel = h("div", { id: "debug" });
  document.body.append(panel);
  setInterval(() => {
    timers.forEach((t) => t.flush());
    const set = state.current === "set2" || state.current === "done" ? "set2" : "set1";
    const s = (x) => (x / 1000).toFixed(1).padStart(6);
    const rows = state.order[set].map((id) => {
      const m = state.metrics[set][id];
      return `${id.padEnd(13)} title${s(m.title_view_ms)}s  RM×${m.readmore_clicks} ${s(m.readmore_ms)}s`;
    });
    panel.textContent = `pid=${state.pid || "-"}  ${state.current}  ${set} ${s(state.set_ms[set])}s\n` + rows.join("\n");
  }, 300);
}

route();
