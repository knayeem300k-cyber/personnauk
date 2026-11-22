/* App shell: builds the sidebar, routes between pages, header buttons, search filter, backup and events */

const App = {
  cur: null,
  init() {
    Store.load();
    Logic.sync();
    const nav = document.getElementById("nav");
    Pages.list.filter(p => p.nav !== false).forEach(p => {
      const a = document.createElement("a");
      a.href = "#" + p.id; a.textContent = p.title; a.dataset.id = p.id;
      nav.appendChild(a);
    });
    nav.querySelector(".brand").insertAdjacentHTML("afterend", `<label class="who"><span>Working as</span><select id="whoSel" data-act="setUser" aria-label="Working as"></select></label>`);
    nav.insertAdjacentHTML("beforeend", `<div class="foot"><button data-act="exportData">Export backup</button><button data-act="importData">Import backup</button><button data-act="resetData">Reset demo data</button><input type="file" id="importFile" data-act="importFile" accept=".json,application/json" hidden></div>`);
    this.wire();
    addEventListener("hashchange", () => this.render());
    this.render();
  },
  route() {
    const h = decodeURIComponent(location.hash.slice(1) || "dashboard"), k = h.indexOf("/");
    const id = k < 0 ? h : h.slice(0, k), param = k < 0 ? "" : h.slice(k + 1);
    return { p: Pages.get(id) || Pages.get("dashboard"), param };
  },
  render() {
    const { p, param } = this.route(), key = location.hash || "#dashboard";
    if (this.cur !== key) { this.cur = key; this.visit = (this.visit || 0) + 1; UI.q = ""; UI.sq = {}; UI.filter = false; window.scrollTo(0, 0); }
    const val = x => typeof x === "function" ? x(param) : x;
    const btns = (p.buttons ? p.buttons(param) : "")
      + (p.filter === false ? "" : `<button class="btn g" data-act="filterToggle" aria-pressed="${UI.filter}">Filter</button>`)
      + (p.export ? `<div class="xm"><button class="btn g" data-act="exportMenu" aria-haspopup="true" aria-expanded="false">Export ▾</button><div class="menu card" hidden><button data-act="exportXlsx"><b>Excel</b><small>.xlsx spreadsheet</small></button><button data-act="exportPdf"><b>PDF</b><small>Print or save as PDF</small></button></div></div>` : "")
      + (p.onNew ? `<button class="btn" data-act="newItem">${esc(p.newLabel || "New")}</button>` : "");
    let body;
    try { body = p.render(param); } catch (e) { console.error(e); body = Card("Something went wrong", `<p class="mute">This page could not load: ${esc(e.message)}</p>`); }
    document.getElementById("view").innerHTML = `<header class="top"><div><h1>${esc(val(p.title))}</h1><p>${esc(val(p.sub))}</p></div>${btns}</header>`
      + (UI.filter ? `<div class="card sb"><input type="search" id="q" data-act="search" placeholder="Search rows on this page…" value="${esc(UI.q)}" aria-label="Search"></div>` : "")
      + body;
    const who = document.getElementById("whoSel"), me = Team.me();
    if (who) who.innerHTML = Team.active().map(m => `<option value="${esc(m.id)}"${m.id === me ? " selected" : ""}>${esc(m.name)}</option>`).join("") || '<option value="">No team yet</option>';
    const navId = p.navId || p.id;
    document.querySelectorAll("#nav a").forEach(a => a.classList.toggle("on", a.dataset.id === navId));
    this.filter();
  },
  /* Scrolling tables show exactly 15 rows; the rest scroll inside the card */
  fit() {
    document.querySelectorAll("#view .tw15").forEach(tw => {
      tw.style.maxHeight = "none";
      const rows = [...tw.querySelectorAll("tbody tr")].filter(r => !r.hidden);
      if (rows.length <= 15) return;
      tw.style.maxHeight = Math.ceil(rows[14].getBoundingClientRect().bottom - tw.getBoundingClientRect().top) + 2 + "px";
    });
  },
  /* Hide table rows that do not contain the search text */
  filter() {
    const q = UI.q.trim().toLowerCase();
    document.querySelectorAll("#view tbody tr").forEach(tr => { tr.hidden = !!q && !tr.textContent.toLowerCase().includes(q); });
    /* A card with its own search box filters only its own table */
    document.querySelectorAll("#view .card").forEach(c => {
      const s = c.querySelector("input.sr"), v = s && s.value.trim().toLowerCase();
      if (v) c.querySelectorAll("tbody tr").forEach(tr => { if (!tr.textContent.toLowerCase().includes(v)) tr.hidden = true; });
    });
    this.fit();
  },
  wire() {
    document.addEventListener("click", e => {
      if (e.target.closest("a[href^='http'], a[href^='mailto:']")) return;
      const el = e.target.closest("[data-act]");
      if (!el || /^(SELECT|INPUT|TEXTAREA)$/.test(el.tagName)) return;
      const f = Actions[el.dataset.act];
      if (f) { e.preventDefault(); f(el, e); }
    });
    document.addEventListener("change", e => {
      const el = e.target;
      if (el.dataset && el.dataset.act && (el.tagName === "SELECT" || el.type === "file") && Actions[el.dataset.act]) Actions[el.dataset.act](el);
    });
    document.addEventListener("input", e => {
      const el = e.target;
      if (el.dataset && el.dataset.act && el.tagName === "INPUT" && el.type !== "file" && Actions[el.dataset.act]) Actions[el.dataset.act](el);
    });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && !document.getElementById("modal").hidden) return Form.close();
      if (e.target.id === "aiIn" && e.key === "Enter" && !e.shiftKey) { e.preventDefault(); return Actions.aiSend(); }
      if ((e.key === "Enter" || e.key === " ") && e.target.matches("tr.rw, .f.ck, .cd[data-act]")) { e.preventDefault(); e.target.click(); }
    });
  }
};

Actions.newItem = () => { const p = App.route().p; if (p.onNew) p.onNew(); };
Actions.filterToggle = () => { UI.filter = !UI.filter; if (!UI.filter) UI.q = ""; App.render(); const q = document.getElementById("q"); if (q) q.focus(); };
Actions.search = el => { UI.q = el.value; App.filter(); };

Actions.exportData = () => {
  const blob = new Blob([JSON.stringify(Store.d, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = `merchandiser-backup-${iso(TODAY)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast("Backup downloaded");
};
Actions.importData = () => document.getElementById("importFile").click();
Actions.importFile = el => {
  const f = el.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!confirm("Replace all current data with this backup?")) return;
      Store.replace(d); Logic.sync(); UI.pick = {}; App.render(); toast("Backup imported");
    } catch (e) { alert("This file is not a valid backup."); }
    el.value = "";
  };
  r.readAsText(f);
};
Actions.resetData = () => {
  if (!confirm("Delete all your data and load the demo data again?")) return;
  Store.reset(); Logic.sync(); UI.pick = {}; AI.msgs = []; App.render(); toast("Demo data loaded");
};

App.init();
