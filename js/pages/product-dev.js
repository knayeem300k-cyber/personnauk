/* Product Development – register styles and track them from buyer brief to approval */

const DEV_FLOW = ["Brief received", "Design", "Pattern", "Proto sample", "Fit sample", "Costing", "Approved"];
const DEV_ST = [...DEV_FLOW, "On hold", "Dropped"];
const DEV_CAT = ["Woven", "Knit", "Denim", "Sweater", "Outerwear", "Lingerie", "Accessories"];
Object.assign(TONES, { "Brief received": "p", Design: "p", Pattern: "p", "Proto sample": "w", "Fit sample": "w", "On hold": "w", Dropped: "b" });

/* Seasons from last year to two years ahead, e.g. SS26, AW26, SS27 ... */
function seasonOpts(cur) {
  const y = TODAY.getFullYear() % 100, a = [];
  for (let i = -1; i <= 2; i++) a.push("SS" + (y + i), "AW" + (y + i));
  if (cur && !a.includes(cur)) a.unshift(cur);
  return a;
}
const nextSeason = () => { const y = TODAY.getFullYear() % 100; return TODAY.getMonth() < 5 ? "AW" + y : "SS" + (y + 1); };
const devOpen = d => !["Approved", "Dropped"].includes(d.status);
const devLate = d => devOpen(d) && d.status !== "On hold" && daysFrom(d.due) < 0;
const devStep = d => DEV_FLOW.indexOf(d.status);
const devThumb = (d, size = "sm") => `<span class="blogo ${size} sk">${d.sketch && /^data:image\//.test(d.sketch) ? `<img src="${esc(d.sketch)}" alt="${esc(d.id)} sketch">` : esc(String(d.category || "?").slice(0, 2).toUpperCase())}</span>`;

Schemas.devs = {
  name: "Style", label: r => r.id,
  fields: r => [
    { k: "sketch", l: "Sketch / reference image", t: "image", noun: "sketch", max: 480, full: 1 },
    { k: "id", l: "Style number", req: 1, ro: !!r }, buyerField(r),
    { k: "season", l: "Season", t: "select", o: seasonOpts(r && r.season), d: nextSeason() },
    { k: "category", l: "Garment category", t: "select", o: DEV_CAT },
    { k: "product", l: "Product description", req: 1 }, { k: "factory", l: "Factory" },
    { k: "status", l: "Development status", t: "select", o: DEV_ST },
    { k: "due", l: "Target approval date", t: "date", d: addDays(iso(TODAY), 45) },
    { k: "merch", l: "Merchandiser", t: "select", o: Team.opts(r && r.merch) },
    { k: "colours", l: "Colourways (e.g. Navy, Black)" }, { k: "targetPrice", l: "Target FOB ($)", t: "number" },
    { k: "targetQty", l: "Projected quantity (pcs)", t: "number" },
    { k: "notes", l: "Development notes / buyer comments", t: "textarea", full: 1 },
    { k: "tpVersion", l: "Tech pack version", d: "v1" }, { k: "tpStatus", l: "Tech pack status", t: "select", o: ["Draft", "Review", "Final"] },
    ...SECTIONS.map(([k, l]) => ({ k: "s_" + k, l: "Tech pack: " + l }))
  ],
  validate: (v, r) => !r && Store.get("devs", v.id.trim().toUpperCase()) ? "This style number already exists." : "",
  make: v => ({ ...v, id: v.id.trim().toUpperCase(), created: iso(TODAY), hist: {} }),
  after: r => { if (!r.hist) r.hist = {}; if (!r.hist[r.status]) r.hist[r.status] = iso(TODAY); devToTechPack(r); },
  removed: r => { Store.remove("styles", r.id); }
};

/* The tech pack is part of the style. Keep a copy in "styles", which orders, AI and Claude read. */
function devToTechPack(d) {
  let t = Store.get("styles", d.id);
  if (!t) { t = { id: d.id }; Store.d.styles.push(t); }
  Object.assign(t, { name: d.product, buyer: d.buyer, version: d.tpVersion || "v1", status: d.tpStatus || "Draft", updated: iso(TODAY) });
  SECTIONS.forEach(([k]) => { t["s_" + k] = d["s_" + k] || ""; });
  d.fabric = d.s_fabric || "";
}

/* Popup with everything about one style */
function devView(id) {
  const d = Store.get("devs", id);
  if (!d) return;
  const step = devStep(d), tp = Store.get("styles", d.id), cs = Store.all("costings").find(c => c.style === d.id);
  const samples = Store.all("samples").filter(s => s.style === d.id), orders = Store.all("orders").filter(o => o.style === d.id);
  const dd = daysFrom(d.due), secReady = SECTIONS.filter(([k]) => d["s_" + k]).length;
  const kv = rows => `<div class="res bp">${rows.map(([k, v]) => `<span>${esc(k)}</span><b>${esc(v || "–")}</b>`).join("")}</div>`;
  const link = (label, val, btn) => `<div class="f"><i class="${btn ? "no" : "ok"}">${btn ? "–" : "✓"}</i><b>${esc(label)}<small class="blk">${esc(val)}</small></b>${btn || ""}</div>`;
  View.open({
    title: d.id,
    head: `<div class="vh">${devThumb(d, "lg")}<div><h2>${esc(d.id)}</h2><p class="mute">${esc(d.product)} · ${esc(d.buyer || "No buyer")} · ${esc(d.season || "")} <span class="chip c-${TONES[d.status] || "p"}">${esc(d.status)}</span></p></div></div>`,
    body: `<div class="steps">${DEV_FLOW.map((s, i) => `<div class="stp${step > i || d.status === "Approved" ? " done" : step === i ? " cur" : ""}"><i>${step > i || d.status === "Approved" ? "✓" : i + 1}</i><span>${esc(s)}</span><small>${d.hist && d.hist[s] ? fmtD(d.hist[s]) : ""}</small></div>`).join("")}</div>
      ${["On hold", "Dropped"].includes(d.status) ? `<p class="note wn">This style is ${esc(d.status.toLowerCase())}.</p>` : ""}
      <div class="vg"><div>
        <h3 class="sub3">Style details</h3>${kv([["Buyer", d.buyer], ["Season", d.season], ["Category", d.category], ["Factory", d.factory], ["Merchandiser", Team.name(d.merch) || d.merch], ["Main fabric", d.fabric], ["Colourways", d.colours], ["Target FOB", d.targetPrice ? price(d.targetPrice) : ""], ["Projected quantity", d.targetQty ? num(d.targetQty) + " pcs" : ""], ["Target approval", d.due ? `${fmtD(d.due)} (${relDays(dd)})` : ""]])}
        <h3 class="sub3">Tech pack <span class="chip c-${tp && tp.status === "Final" ? "ok" : "w"}">${esc(d.tpVersion || "v1")} · ${esc(d.tpStatus || "Draft")}</span> <span class="chip c-${secReady === SECTIONS.length ? "ok" : "w"}">${secReady}/${SECTIONS.length}</span></h3>
        ${CK("", SECTIONS.map(([k, l]) => ({ label: l, note: d["s_" + k] || "Missing", s: d["s_" + k] ? "ok" : "no", act: { act: "devEdit", id: d.id } })), { bare: true })}
        ${d.sketch ? `<h3 class="sub3">Sketch</h3><div class="skl"><img src="${esc(d.sketch)}" alt="${esc(d.id)} sketch"></div>` : ""}
      </div><div>
        <h3 class="sub3">Linked records</h3><div class="fl">
          ${d.inquiry ? link("Inquiry", `${d.inquiry}${(Store.get("inquiries", d.inquiry) || {}).status ? ", " + Store.get("inquiries", d.inquiry).status : ""}`, "") : ""}
          ${link("Costing sheet", cs ? `FOB ${price(Logic.fob(cs))}, ${cs.status}${d.targetPrice ? `, target ${price(d.targetPrice)}` : ""}` : "Not created yet", cs ? "" : `<button type="button" class="btn sm g" data-act="devCost" data-id="${esc(d.id)}">Create</button>`)}
          ${link("Samples", samples.length ? samples.map(s => `${s.type} (${Logic.sampleStatus(s)})`).join(", ") : "No samples yet", samples.length ? "" : " ")}
          ${link("Orders", orders.length ? orders.map(o => `${o.id}, ${num(o.qty)} pcs`).join("; ") : "No orders yet", orders.length ? "" : " ")}
        </div>
        ${cs && d.targetPrice && Logic.fob(cs) > +d.targetPrice ? `<p class="note wn">Costing is ${price(Logic.fob(cs) - d.targetPrice)} above the buyer's target price.</p>` : ""}
        <h3 class="sub3">Notes</h3><p class="note pre">${esc(d.notes || "No notes yet.")}</p>
      </div></div>`,
    buttons: [
      { l: "Close", a: { act: "formClose" }, g: 1 },
      { l: "Edit style", a: { act: "devEdit", id: d.id }, g: devOpen(d) && step >= 0 && step < DEV_FLOW.length - 1 ? 1 : 0 },
      ...(devOpen(d) && step >= 0 && step < DEV_FLOW.length - 1 ? [{ l: `Move to ${DEV_FLOW[step + 1]}`, a: { act: "devNext", id: d.id } }] : [])
    ]
  });
}
Actions.devView = el => devView(el.dataset.id);
Actions.devEdit = el => { const id = el.dataset.id; Crud.edit("devs", id, () => devView(id)); };
Actions.devNext = el => {
  const d = Store.get("devs", el.dataset.id), i = devStep(d);
  if (i < 0 || i >= DEV_FLOW.length - 1) return;
  d.status = DEV_FLOW[i + 1]; d.hist = d.hist || {}; d.hist[d.status] = iso(TODAY);
  logWork(`Moved style ${d.id} to ${d.status}`);
  Store.save(); App.render(); devView(d.id); toast(`${d.id} moved to ${d.status}`);
};
Actions.devCost = el => { const d = Store.get("devs", el.dataset.id); Crud.create("costings", { style: d.id, buyer: d.buyer, status: "Draft" }); };
Actions.devStage = el => { UI.dvst = el.dataset.v; App.render(); };

Pages.add({
  id: "pd", title: "Product Development", sub: "Register styles and track garment development from buyer brief to approval", filter: false,
  newLabel: "Add new style",
  export() {
    const stf = UI.dvst || "all";
    const list = Store.all("devs").filter(d => (UI.pick.dvb === "all" || !UI.pick.dvb || d.buyer === UI.pick.dvb) && (UI.pick.dvs === "all" || !UI.pick.dvs || d.season === UI.pick.dvs)
      && (stf === "all" || (stf === "late" ? devLate(d) : d.status === stf)) && matchQ(d, UI.sq.pd));
    const n = v => v === "" || v == null ? "" : +v;
    const rows = list.map(d => {
      const si = devStep(d), cs = Store.all("costings").find(c => c.style === d.id);
      return [d.id, d.buyer, d.season, d.category, d.product, d.factory, d.status, d.status === "Approved" ? 100 : si < 0 ? 0 : pct(si, DEV_FLOW.length - 1),
        d.due ? fmtL(d.due) : "", devLate(d) ? "Yes" : "", Team.name(d.merch) || d.merch, d.fabric, d.colours,
        n(d.targetPrice), cs ? +Logic.fob(cs).toFixed(2) : "", n(d.targetQty), d.notes];
    });
    const note = [UI.pick.dvb && UI.pick.dvb !== "all" ? UI.pick.dvb : "", UI.pick.dvs && UI.pick.dvs !== "all" ? UI.pick.dvs : "", stf !== "all" ? (stf === "late" ? "Overdue" : stf) : "", UI.sq.pd ? `search “${UI.sq.pd}”` : ""].filter(Boolean).join(", ");
    return {
      file: "style-register", title: "Product development: style register", note,
      sheets: [{ name: "Styles", rows, cols: [
        { h: "Style", w: 18 }, { h: "Buyer", w: 18 }, { h: "Season", w: 8 }, { h: "Category", w: 11 }, { h: "Product", w: 22 },
        { h: "Factory", w: 20 }, { h: "Status", w: 14 }, { h: "Progress", w: 9, f: "pct" }, { h: "Target approval", w: 14 }, { h: "Overdue", w: 8 },
        { h: "Merchandiser", w: 18, pdf: false }, { h: "Main fabric", w: 22 }, { h: "Colourways", w: 18, pdf: false },
        { h: "Target FOB ($)", w: 12, f: "money" }, { h: "Costing FOB ($)", w: 12, f: "money" }, { h: "Projected qty", w: 12, f: "int" }, { h: "Notes", w: 40, pdf: false }
      ] }]
    };
  },
  onNew: () => Crud.create("devs", { status: "Brief received", buyer: UI.pick.dvb && UI.pick.dvb !== "all" ? UI.pick.dvb : undefined }),
  render() {
    const all = Store.all("devs"), stf = UI.dvst || "all";
    const active = all.filter(devOpen), late = all.filter(devLate);
    const seasons = [...new Set(all.map(d => d.season).filter(Boolean))].sort();
    const fb = Pick("dvb", [["all", "All buyers"], ...[...new Set(all.map(d => d.buyer).filter(Boolean))].sort().map(b => [b, b])]);
    const fs = Pick("dvs", [["all", "All seasons"], ...seasons.map(s => [s, s])]);
    const base = all.filter(d => (UI.pick.dvb === "all" || d.buyer === UI.pick.dvb) && (UI.pick.dvs === "all" || d.season === UI.pick.dvs));
    const shown = base.filter(d => stf === "all" || (stf === "late" ? devLate(d) : d.status === stf))
      .sort((a, b) => devOpen(b) - devOpen(a) || String(a.due || "9").localeCompare(String(b.due || "9")));
    const ns = nextSeason(), approvedNs = all.filter(d => d.status === "Approved" && d.season === ns).length;
    const upcoming = all.filter(d => devOpen(d) && d.status !== "On hold" && d.due).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 6);
    const cats = DEV_CAT.map(c => [c, active.filter(d => d.category === c).length]).filter(x => x[1]);

    const pipe = `<section><h2>Development pipeline${UI.pick.dvb !== "all" || UI.pick.dvs !== "all" ? ` <small class="mute">(filtered)</small>` : ""}</h2><div class="pipe">${
      [["all", "All styles", base.length], ...DEV_ST.map(s => [s, s, base.filter(d => d.status === s).length]), ["late", "Overdue", base.filter(devLate).length]]
        .map(([v, l, n], i) => `<a class="st${stf === v ? " on" : ""}${v === "late" && n ? " bad" : ""}" href="#pd" data-act="devStage" data-v="${esc(v)}"><i>${i === 0 ? "Show" : v === "late" ? "Alert" : i <= DEV_FLOW.length ? "Step " + i : "Status"}</i><strong>${n}</strong><span>${esc(l)}</span></a>`).join("")
    }</div></section>`;

    const rows = shown.map(d => {
      const si = devStep(d), p = d.status === "Approved" ? 100 : si < 0 ? 0 : pct(si, DEV_FLOW.length - 1), dd = daysFrom(d.due);
      return {
        cells: [{ html: `<span class="bn">${devThumb(d)}${esc(d.id)}</span>` }, d.buyer || "–", d.season || "–", d.category || "–", d.product, d.factory || "–",
          { html: d.due ? `<span class="${devLate(d) ? "bd" : dd <= 7 && devOpen(d) ? "wn" : ""}">${esc(fmtD(d.due))}</span>` : "–" },
          { html: `<span class="mbar" title="${p}%"><i style="width:${p}%"></i></span>` }, st(d.status)],
        act: { act: "devView", id: d.id }
      };
    });

    return KP([
      ["Styles in register", all.length, `${seasons.length} seasons`],
      ["In development", active.filter(d => d.status !== "On hold").length, `${all.filter(d => d.status === "On hold").length} on hold`, "ok"],
      [`Approved for ${ns}`, approvedNs, `${all.filter(d => d.status === "Approved").length} approved in total`],
      ["Overdue", late.length, late.length ? "Past target approval date" : "All on schedule", late.length ? "bd" : "ok"]
    ]) + pipe + `${
      TB("Style register", ["Style", "Buyer", "Season", "Category", "Product", "Factory", "Target", "Progress", "Status"], rows, {
        scroll: 1, empty: all.length ? "No styles match these filters." : "No styles yet. Click New to register one.",
        tools: `<input class="pk sr" type="search" data-act="bsearch" data-k="pd" placeholder="Search style, product, factory…" value="${esc(UI.sq.pd || "")}" aria-label="Search styles">${fb}${fs}`
      })
    }<div class="g2 even">${
      CK("Upcoming approvals", upcoming.map(d => { const n = daysFrom(d.due); return { label: `${d.id} · ${d.product}`, note: n < 0 ? `${-n} days late` : `due ${relDays(n)}`, s: n < 0 ? "no" : n <= 7 ? "wt" : "ok", act: { act: "devView", id: d.id } }; }), { empty: "No open styles with a target date." })
    }${
      BR("Category mix (in development)", cats.map(([c, n]) => [c, pct(n, active.length), `${n}`]), { empty: "No styles in development." })
    }</div>`;
  }
});
