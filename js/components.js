/* Reusable UI: page registry, cards, tables, checklists, bars, pickers, the form popup and toasts */

const UI = { pick: {}, q: "", sq: {}, filter: false };   // screen state (selected items, search text)
const Actions = {};                              // click / change handlers, looked up by data-act
const Schemas = {};                              // form definitions per collection
const Pages = {
  list: [],
  add(p) { this.list.push(p); },
  get(id) { return this.list.find(p => p.id === id); }
};

const chip = (t, tone) => ({ html: `<span class="chip c-${tone}">${esc(t)}</span>` });
const st = s => chip(s, TONES[s] || "p");
const cell = v => v && typeof v === "object" && "html" in v ? v.html : esc(v);
const attrs = a => a ? Object.entries(a).map(([k, v]) => ` data-${k}="${esc(v)}"`).join("") : "";
const orderOpts = () => Store.all("orders").map(o => [o.id, `${o.id} · ${o.buyer}`]);
const nextId = (col, prefix, start) => prefix + (Math.max(start, ...Store.all(col).map(r => parseInt(String(r.id).slice(prefix.length), 10) || 0)) + 1);

function Card(title, body, tools = "", cls = "") {
  return `<section class="card${cls ? " " + cls : ""}">${title || tools ? `<div class="hd"><h2>${esc(title)}</h2>${tools}</div>` : ""}${body}</section>`;
}

/* KPI tiles: [label, value, note, tone] */
function KP(a) {
  return `<section class="kp">${a.map(k => `<div class="card"><small>${esc(k[0])}</small><b>${esc(k[1])}</b><span class="${k[3] || "ok"}">${esc(k[2])}</span></div>`).join("")}</section>`;
}

/* Table. rows: arrays of cells, or { cells, act } to make the row clickable */
function TB(title, head, rows, o = {}) {
  const body = rows.length ? rows.map(r => {
    const cells = Array.isArray(r) ? r : r.cells, a = Array.isArray(r) ? null : r.act;
    return `<tr${a ? ` class="rw" tabindex="0"${attrs(a)}` : ""}>${cells.map(c => `<td>${cell(c)}</td>`).join("")}</tr>`;
  }).join("") : `<tr><td colspan="${head.length}" class="empty">${esc(o.empty || "Nothing here yet. Click New to add one.")}</td></tr>`;
  return Card(title, `<div class="tw${o.scroll ? " tw15" : ""}"><table><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></div>`, o.tools, o.cls);
}

/* Checklist. items: { label, note, s: ok|wt|no|na, act } */
const ICON = { ok: "✓", wt: "!", no: "–", na: "○" };
function CK(title, items, o = {}) {
  const body = items.length ? `<div class="fl">${items.map(x => `<div class="f${x.act ? " ck" : ""}"${x.act ? ` role="button" tabindex="0"${attrs(x.act)}` : ""}><i class="${x.s}">${ICON[x.s]}</i><b>${esc(x.label)}</b><small>${esc(x.note || "")}</small></div>`).join("")}</div>`
    : `<p class="empty">${esc(o.empty || "Nothing to show.")}</p>`;
  return o.bare ? body : Card(title, body + (o.foot || ""), o.tools);
}

/* Bars: [label, percent, right-hand text] */
function BR(title, a, o = {}) {
  const body = a.length ? a.map(x => `<div class="br">${esc(x[0])}<div class="bar"><i style="width:${Math.min(100, Math.max(0, x[1]))}%"></i></div><em>${esc(x[2] ?? x[1] + "%")}</em></div>`).join("")
    : `<p class="empty">${esc(o.empty || "No data yet.")}</p>`;
  return Card(title, body, o.tools);
}

/* Dropdown that remembers its choice in UI.pick[key]. Call it before reading UI.pick[key]. */
function Pick(key, options, def) {
  if (!options.length) { UI.pick[key] = undefined; return ""; }
  let v = UI.pick[key];
  if (!options.some(o => o[0] === v)) v = UI.pick[key] = options.some(o => o[0] === def) ? def : options[0][0];
  return `<select class="pk" data-act="pick" data-k="${esc(key)}" aria-label="Choose">${options.map(o => `<option value="${esc(o[0])}"${o[0] === v ? " selected" : ""}>${esc(o[1])}</option>`).join("")}</select>`;
}
Actions.pick = el => { UI.pick[el.dataset.k] = el.value; App.render(); };

/* Order pipeline on the dashboard: live count of orders per stage */
function Pipe() {
  const c = STAGES.map(() => 0);
  Logic.active().forEach(o => { c[Logic.info(o).stage]++; });
  c[0] += Store.all("inquiries").filter(i => !["Won", "Lost"].includes(i.status)).length;
  return `<section><h2>Order pipeline</h2><div class="pipe">${STAGES.map((s, i) => `<a class="st" href="#${s.module}"><i>Stage ${i + 1}</i><strong>${c[i]}</strong><span>${esc(s.name)}</span></a>`).join("")}</div></section>`;
}

/* Popup form. fields: { k, l, t: text|number|date|select|textarea, o: options, req, ro, d: default, full } */
const Form = {
  cfg: null,
  open(cfg) {
    this.cfg = cfg;
    const v = cfg.values || {};
    const fields = cfg.fields.map(x => {
      const val = v[x.k] ?? x.d ?? "", id = "f_" + x.k;
      let input;
      if (x.t === "select") input = `<select id="${id}">${(x.o || []).map(o => { const [ov, ol] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(ov)}"${String(ov) === String(val) ? " selected" : ""}>${esc(ol)}</option>`; }).join("")}</select>`;
      else if (x.t === "textarea") input = `<textarea id="${id}" rows="3">${esc(val)}</textarea>`;
      else if (x.t === "image") {
        return `<div class="fd${x.full ? " full" : ""}"><span>${esc(x.l)}</span><div class="imgf" id="${id}" data-v="${esc(val)}" data-n="${esc(x.noun || "logo")}"><div class="imgp">${val ? `<img src="${esc(val)}" alt="">` : `<em>No ${esc(x.noun || "logo")}</em>`}</div><div class="imgb"><div><button type="button" class="btn g sm" data-act="imgOpen" data-k="${esc(x.k)}">${val ? "Change" : "Upload"} ${esc(x.noun || "logo")}</button> <button type="button" class="btn g sm del" data-act="imgDel" data-k="${esc(x.k)}"${val ? "" : " hidden"}>Remove</button></div><small class="mute">PNG, JPG, SVG or WebP, up to 5 MB. It is resized to keep the app fast.</small></div><input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif" data-act="imgPick" data-k="${esc(x.k)}" data-max="${x.max || 200}" hidden></div></div>`;
      }
      else if (x.t === "list") {
        const rows = Array.isArray(val) && val.length ? val : [{}];
        return `<div class="fd full"><span>${esc(x.l)}</span><div class="ls" id="${id}">${rows.map((r, i) => lsRow(x, r, i)).join("")}</div><button type="button" class="btn g sm ls-add" data-act="lsAdd" data-k="${esc(x.k)}">+ ${esc(x.add || "Add row")}</button></div>`;
      }
      else input = `<input id="${id}" type="${x.t || "text"}" value="${esc(val)}"${x.t === "number" ? ' step="any" min="0"' : ""}${x.ro ? " readonly" : ""}>`;
      return `<label class="fd${x.full ? " full" : ""}"><span>${esc(x.l)}${x.req ? " *" : ""}</span>${input}</label>`;
    }).join("");
    const root = document.getElementById("modal");
    root.innerHTML = `<div class="ov" data-act="formClose"></div><form class="card md" novalidate aria-label="${esc(cfg.title)}">
      <div class="hd"><h2>${esc(cfg.title)}</h2><button type="button" class="x" data-act="formClose" aria-label="Close">×</button></div>
      <div class="fg">${fields}</div><p class="err" hidden></p>
      <div class="fa">${cfg.onDelete ? '<button type="button" class="btn g del" data-act="formDelete">Delete</button>' : ""}${(cfg.extra || []).map((e, i) => `<button type="button" class="btn g" data-act="formExtra" data-i="${i}">${esc(e.label)}</button>`).join("")}<span></span><button type="button" class="btn g" data-act="formClose">Cancel</button><button class="btn">Save</button></div></form>`;
    root.hidden = false;
    root.querySelector("form").onsubmit = e => { e.preventDefault(); this.save(); };
    const first = root.querySelector(".fg input:not([readonly]), .fg select, .fg textarea");
    if (first) first.focus();
  },
  read() {
    const out = {};
    this.cfg.fields.forEach(x => {
      if (x.t === "image") { out[x.k] = document.getElementById("f_" + x.k).dataset.v || ""; return; }
      if (x.t === "list") {
        out[x.k] = [...document.querySelectorAll(`#f_${x.k} .lr`)].map(r => {
          const o = {};
          r.querySelectorAll("[data-c]").forEach(inp => { o[inp.dataset.c] = inp.value.trim(); });
          return o;
        }).filter(o => Object.values(o).some(Boolean));
        return;
      }
      let v = document.getElementById("f_" + x.k).value.trim();
      if (x.t === "number") v = v === "" ? "" : +v;
      out[x.k] = v;
    });
    return out;
  },
  save() {
    const v = this.read();
    const miss = this.cfg.fields.find(x => x.req && v[x.k] === "");
    if (miss) return this.err(`${miss.l} is required.`);
    const bad = this.cfg.fields.find(x => x.t === "number" && v[x.k] !== "" && (isNaN(v[x.k]) || v[x.k] < 0));
    if (bad) return this.err(`${bad.l} must be a positive number.`);
    const cfg = this.cfg, r = cfg.onSave(v);
    if (typeof r === "string" && r) return this.err(r);
    this.close(); App.render(); toast(cfg.saved || "Saved");
    if (cfg.done) cfg.done();
  },
  err(m) { const e = document.querySelector("#modal .err"); e.textContent = m; e.hidden = false; },
  close() { const r = document.getElementById("modal"); r.hidden = true; r.innerHTML = ""; this.cfg = null; }
};
/* One row of a repeatable list field (e.g. several contact persons) */
function lsRow(x, r, i) {
  return `<div class="lr"><div class="lr-h"><b>${esc(x.item || "Item")} ${i + 1}${i === 0 && x.first ? ` <small>(${esc(x.first)})</small>` : ""}</b><button type="button" class="x" data-act="lsDel" aria-label="Remove">×</button></div><div class="lr-g">${x.cols.map(([c, l, t]) => `<label><span>${esc(l)}</span><input data-c="${esc(c)}" type="${t || "text"}" value="${esc(r[c] || "")}"></label>`).join("")}</div></div>`;
}
const lsRenumber = box => box.querySelectorAll(".lr").forEach((r, i) => {
  const x = Form.cfg.fields.find(f => "f_" + f.k === box.id);
  r.querySelector(".lr-h b").innerHTML = `${esc(x.item || "Item")} ${i + 1}${i === 0 && x.first ? ` <small>(${esc(x.first)})</small>` : ""}`;
});
Actions.lsAdd = el => {
  const x = Form.cfg.fields.find(f => f.k === el.dataset.k), box = document.getElementById("f_" + x.k);
  box.insertAdjacentHTML("beforeend", lsRow(x, {}, box.children.length));
  box.lastElementChild.querySelector("input").focus();
};
Actions.lsDel = el => {
  const box = el.closest(".ls");
  if (box.children.length === 1) { el.closest(".lr").querySelectorAll("input").forEach(i => { i.value = ""; }); return; }
  el.closest(".lr").remove(); lsRenumber(box);
};
/* Image upload: read the file, shrink it to 200 px and keep it as a data URL */
function setImg(k, url) {
  const box = document.getElementById("f_" + k);
  if (!box) return;
  box.dataset.v = url;
  const n = box.dataset.n || "logo";
  box.querySelector(".imgp").innerHTML = url ? `<img src="${esc(url)}" alt="">` : `<em>No ${esc(n)}</em>`;
  box.querySelector('[data-act="imgDel"]').hidden = !url;
  box.querySelector('[data-act="imgOpen"]').textContent = (url ? "Change " : "Upload ") + n;
}
Actions.imgOpen = el => document.querySelector(`#f_${el.dataset.k} input[type=file]`).click();
Actions.imgDel = el => setImg(el.dataset.k, "");
Actions.imgPick = el => {
  const f = el.files[0], k = el.dataset.k;
  el.value = "";
  if (!f) return;
  if (!/^image\//.test(f.type)) return Form.err("Please choose an image file.");
  if (f.size > 5 * 1024 * 1024) return Form.err("The image is larger than 5 MB.");
  const rd = new FileReader();
  rd.onload = () => {
    const img = new Image();
    img.onload = () => {
      const mx = +el.dataset.max || 200, w = img.naturalWidth || mx, h = img.naturalHeight || mx, s = Math.min(1, mx / Math.max(w, h));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      setImg(k, c.toDataURL(f.type === "image/jpeg" ? "image/jpeg" : "image/png", 0.9));
      const e = document.querySelector("#modal .err"); if (e) e.hidden = true;
    };
    img.onerror = () => Form.err("This image could not be read. Try another file.");
    img.src = rd.result;
  };
  rd.readAsDataURL(f);
};

/* Read-only popup with action buttons. buttons: { l, a: data attributes, g: secondary } */
const View = {
  open({ title, head, body, buttons = [] }) {
    const root = document.getElementById("modal");
    root.innerHTML = `<div class="ov" data-act="formClose"></div><div class="card md vw" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="hd">${head || `<h2>${esc(title)}</h2>`}<button type="button" class="x" data-act="formClose" aria-label="Close">×</button></div>${body}<div class="fa"><span></span>${buttons.map(b => `<button type="button" class="btn${b.g ? " g" : ""}"${attrs(b.a)}>${esc(b.l)}</button>`).join("")}</div></div>`;
    root.hidden = false;
    root.querySelector(".x").focus();
  }
};

Actions.formClose = () => Form.close();
Actions.formDelete = () => {
  if (!confirm("Delete this record? This cannot be undone.")) return;
  Form.cfg.onDelete(); Form.close(); App.render(); toast("Deleted");
};
Actions.formExtra = el => { const e = Form.cfg.extra[+el.dataset.i]; Form.close(); e.run(); App.render(); };

/* Create / edit / delete any record using its schema */
const Crud = {
  create(col, defaults = {}, then) {
    const S = Schemas[col];
    Form.open({
      title: "New " + S.name.toLowerCase(), fields: S.fields(null), values: defaults, saved: S.name + " added",
      onSave: v => {
        const e = S.validate && S.validate(v, null); if (e) return e;
        const r = Store.add(col, S.make ? S.make(v) : v);
        if (then) then(r);
        if (S.after) S.after(r, true);
        logWork(`Added ${S.name.toLowerCase()} ${S.label ? S.label(r) : ""}`.trim(), col === "orders" ? r.id : r.order, col === "devs" || col === "buyers" ? r.merch : "");
        Logic.sync();
      }
    });
  },
  edit(col, id, done) {
    const S = Schemas[col], r = Store.get(col, id);
    if (!S || !r) return;
    Form.open({ done,
      title: `${S.name} ${S.label ? S.label(r) : ""}`, fields: S.fields(r), values: r,
      onSave: v => {
        const e = S.validate && S.validate(v, r); if (e) return e;
        Store.update(col, id, v);
        if (S.after) S.after(r, false);
        logWork(`Updated ${S.name.toLowerCase()} ${S.label ? S.label(r) : ""}`.trim(), col === "orders" ? r.id : r.order, col === "devs" || col === "buyers" ? r.merch : "");
        Logic.sync();
      },
      onDelete: () => { Store.remove(col, id); if (S.removed) S.removed(r); logWork(`Deleted ${S.name.toLowerCase()} ${S.label ? S.label(r) : ""}`.trim(), col === "orders" ? "" : r.order, col === "orders" || col === "devs" || col === "buyers" ? r.merch : ""); Logic.sync(); },
      extra: S.extra ? S.extra(r) : []
    });
  }
};
Actions.edit = el => Crud.edit(el.dataset.col, el.dataset.id);
Actions.open = el => {
  if (el.dataset.k) UI.pick[el.dataset.k] = el.dataset.v;
  const h = el.dataset.href;
  if (location.hash === h) App.render(); else location.hash = h;
};
/* Cycle a file on an order: missing → in progress → done → not needed */
Actions.doc = el => {
  const o = Store.get("orders", el.dataset.o), s = +el.dataset.s, i = +el.dataset.i;
  if (!o) return;
  o.docs[s][i] = NEXT[o.docs[s][i]];
  logWork(`${STAGES[s].docs[i]}: ${LABEL[o.docs[s][i]].toLowerCase()}`, o.id);
  Logic.stamp(o); Store.save(); App.render();
};
const docItems = (o, s) => STAGES[s].docs.map((d, j) => ({ label: d, note: LABEL[o.docs[s][j]], s: o.docs[s][j], act: { act: "doc", o: o.id, s, i: j } }));

function toast(m) {
  const t = document.getElementById("toast");
  t.textContent = m; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 2400);
}
