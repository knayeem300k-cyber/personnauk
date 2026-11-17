/* Buyer Management – buyer directory, commercial profile, contacts and buyer-specific working procedures */

const CURRENCIES = ["USD", "EUR", "GBP", "BDT", "CNY", "INR", "JPY"];
const BUYER_PAY = ["L/C at sight", "L/C 60 days", "L/C 90 days", "TT advance", "TT 30 days", "TT 45 days", "TT 60 days", "DP", "Open account"];
const INCOTERMS = ["FOB", "CIF", "CFR", "CPT", "FCA", "EXW", "DAP", "DDP"];
const BUYER_TECH = ["Tech pack format agreed", "Measurement tolerance standard", "Care label and labelling rules", "Packing and carton marking manual", "Lab testing standard (fabric and garment)", "Inspection rule (AQL / third party)"];

/* Contact persons of a buyer, and all departments they cover */
const bContacts = b => Array.isArray(b.contacts) ? b.contacts.filter(c => c && Object.values(c).some(Boolean)) : [];
const bDepts = b => [...new Set(bContacts(b).flatMap(c => String(c.department || "").split(",").map(s => s.trim()).filter(Boolean)))];

/* Logo, or initials when there is no logo */
const buyerLogo = (b, size = "sm") => `<span class="blogo ${size}">${b.logo && /^data:image\//.test(b.logo) ? `<img src="${esc(b.logo)}" alt="${esc(b.name)} logo">` : esc(String(b.name || "?").split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase())}</span>`;

function bContactsHtml(b) {
  const cs = bContacts(b);
  return cs.length ? `<div class="fl">${cs.map((c, i) => `<div class="f cp"><i class="${i ? "no" : "ok"}">${esc((c.name || "?").trim().charAt(0).toUpperCase())}</i><b>${esc(c.name)}${i === 0 ? ' <span class="chip c-ok">Main</span>' : ""}<small class="blk">${esc([c.role, c.department].filter(Boolean).join(" · ") || "No designation")}</small><small class="blk">${c.email ? `<a class="lk" href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : ""}${c.email && c.phone ? " · " : ""}${c.phone ? `<a class="lk" href="tel:${esc(c.phone.replace(/\s/g, ""))}">${esc(c.phone)}</a>` : ""}</small></b></div>`).join("")}</div>` : `<p class="empty">No contact persons yet.</p>`;
}

/* Popup with all buyer information */
function buyerView(id) {
  const b = Store.get("buyers", id);
  if (!b) return;
  const os = Store.all("orders").filter(o => o.buyer === b.name), open = os.filter(o => !Logic.info(o).closed);
  const prof = buyerProfile(b), tech = b.tech || [];
  const styles = [...new Set(os.map(o => o.style))];
  const kv = rows => `<div class="res bp">${rows.map(([k, v]) => `<span>${esc(k)}</span><b>${esc(v || "–")}</b>`).join("")}</div>`;
  View.open({
    title: b.name,
    head: `<div class="vh">${buyerLogo(b, "lg")}<div><h2>${esc(b.name)}</h2><p class="mute">${esc(b.country || "Country not set")} · ${esc(b.currency || "–")} <span class="chip c-${TONES[b.status || "Active"]}">${esc(b.status || "Active")}</span></p></div></div>`,
    body: `<div class="vg"><div>
        <h3 class="sub3">Commercial</h3>${kv([["Currency", b.currency], ["Payment terms", b.payment], ["Incoterms", b.incoterm], ["Departments", bDepts(b).join(", ")], ["Buyer portal", b.portal], ["Working calendar", b.calendar]])}
        <h3 class="sub3">Orders</h3>${kv([["Orders", `${os.length} (${open.length} open)`], ["Order quantity", num(sum(os, o => o.qty)) + " pcs"], ["Order value", money(sum(os, o => o.qty * o.price))], ["Styles", styles.join(", ")]])}
      </div><div>
        <h3 class="sub3">Contact persons <span class="chip c-p">${bContacts(b).length}</span></h3>${bContactsHtml(b)}
        <h3 class="sub3">Profile <span class="chip c-${prof.every(p => p.ok) ? "ok" : "w"}">${prof.filter(p => p.ok).length}/${prof.length}</span> · Technical <span class="chip c-${tech.every(isDone) ? "ok" : "w"}">${tech.filter(isDone).length}/${BUYER_TECH.length}</span></h3>
        <div class="fl">${[["Sample, inspection and packing", b.procedures], ["Portal access", b.portalAccess], ["Buyer manual / compliance", b.manual]].map(([t, v]) => `<div class="f"><i class="${v ? "ok" : "no"}">${v ? "✓" : "–"}</i><b>${esc(t)}<small class="blk">${esc(v || "Not recorded yet")}</small></b></div>`).join("")}</div>
      </div></div>`,
    buttons: [
      { l: "Close", a: { act: "formClose" }, g: 1 },
      { l: "Open full profile", a: { act: "buyerProfileOpen", id: b.id }, g: 1 },
      { l: "New order", a: { act: "newOrderFor", b: b.name }, g: 1 },
      { l: "Edit buyer", a: { act: "buyerEdit", id: b.id } }
    ]
  });
}
Actions.buyerView = el => buyerView(el.dataset.id);
Actions.buyerEdit = el => { const id = el.dataset.id; Crud.edit("buyers", id, () => buyerView(id)); };
Actions.buyerProfileOpen = el => {
  Form.close(); UI.pick.buyer = el.dataset.id; App.render();
  const c = document.querySelector('select[data-k="buyer"]'); if (c) c.closest(".card").scrollIntoView({ behavior: "smooth", block: "start" });
};

/* Profile completeness, worked out from what is filled in */
const buyerProfile = b => [
  { label: "Buyer identity and country", ok: !!(b.name && b.country) },
  { label: "Currency and commercial terms", ok: !!(b.currency && b.payment && b.incoterm) },
  { label: "Main contacts and departments", ok: bContacts(b).some(c => c.name && (c.email || c.phone)) && bDepts(b).length > 0 },
  { label: "Buyer manual and compliance requirements", ok: !!String(b.manual || "").trim() },
  { label: "Sample / inspection / packing procedures", ok: !!String(b.procedures || "").trim() },
  { label: "Buyer portal and access details", ok: !!(b.portal && String(b.portalAccess || "").trim()) }
];

/* Buyer names for dropdowns in other forms (keeps the current value even if inactive) */
function buyerOpts(cur, optional) {
  const names = Store.all("buyers").filter(b => b.status !== "Inactive").map(b => b.name);
  if (cur && !names.includes(cur)) names.unshift(cur);
  return optional ? ["", ...names] : names;
}
const buyerField = (r, l = "Buyer", req = 1) => Store.all("buyers").length
  ? { k: "buyer", l, t: "select", o: buyerOpts(r && r.buyer, !req), req }
  : { k: "buyer", l, req };

Schemas.buyers = {
  name: "Buyer", label: r => r.name,
  fields: () => [
    { k: "logo", l: "Buyer logo", t: "image", full: 1 },
    { k: "name", l: "Buyer / brand name", req: 1 }, { k: "country", l: "Country / market", req: 1 },
    { k: "currency", l: "Default currency", t: "select", o: CURRENCIES }, { k: "status", l: "Buyer status", t: "select", o: ["Active", "Inactive"] },
    { k: "contacts", l: "Contact persons", t: "list", item: "Contact", first: "main contact", add: "Add contact person",
      cols: [["name", "Name"], ["role", "Designation"], ["email", "Email", "email"], ["phone", "Phone", "tel"], ["department", "Department(s), e.g. Adult, Kids"]] },
    { k: "payment", l: "Payment terms", t: "select", o: BUYER_PAY }, { k: "incoterm", l: "Incoterms", t: "select", o: INCOTERMS },
    { k: "portal", l: "Buyer portal / platform (e.g. SmartMoov, Inspectorio)" }, { k: "calendar", l: "Working calendar / holidays" },
    { k: "manual", l: "Buyer manual / compliance notes", t: "textarea", full: 1 },
    { k: "procedures", l: "Sample, inspection and packing procedures", t: "textarea", full: 1 },
    { k: "portalAccess", l: "Portal access (login link, user ID, who in the team has access; do not save passwords)", t: "textarea", full: 1 }
  ],
  validate: (v, r) => {
    const badMail = v.contacts.find(c => c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email));
    if (badMail) return `Please enter a valid email for ${badMail.name || "the contact person"}.`;
    const noName = v.contacts.find(c => !c.name);
    if (noName) return "Every contact person needs a name.";
    const dup = Store.all("buyers").find(b => b.name.toLowerCase() === v.name.toLowerCase() && b !== r);
    if (dup) return "A buyer with this name already exists.";
    Schemas.buyers._old = r ? r.name : null;
    return "";
  },
  make: v => ({ ...v, tech: BUYER_TECH.map(() => "no"), created: iso(TODAY) }),
  /* Renaming a buyer renames it on every order, inquiry, tech pack and costing too */
  after: r => {
    const old = Schemas.buyers._old;
    if (old && old !== r.name) ["orders", "inquiries", "styles", "costings"].forEach(c => Store.all(c).forEach(x => { if (x.buyer === old) x.buyer = r.name; }));
    Schemas.buyers._old = null;
  }
};

Actions.btech = el => {
  const b = Store.get("buyers", el.dataset.id), j = +el.dataset.i;
  if (!Array.isArray(b.tech)) b.tech = BUYER_TECH.map(() => "no");
  b.tech[j] = NEXT[b.tech[j] || "no"]; Store.save(); App.render();
};
Actions.bsearch = el => { UI.sq[el.dataset.k] = el.value; App.filter(); };

Pages.add({
  id: "buyers", title: "Buyer Management", sub: "Buyer directory, commercial profile, contacts and buyer-specific working procedures",
  newLabel: "Add new buyer",
  export() {
    const st = UI.pick.bst || "all";
    const list = Store.all("buyers").filter(b => (st === "all" || (b.status || "Active") === st) && matchQ(b, UI.sq.dir));
    const rows = list.map(b => {
      const cs = bContacts(b), m = cs[0] || {}, os = Store.all("orders").filter(o => o.buyer === b.name);
      return [b.name, b.country, b.currency, b.status || "Active", m.name, m.role, m.email, m.phone,
        cs.slice(1).map(c => [c.name, c.role, c.email, c.phone].filter(Boolean).join(", ")).join("\n"),
        bDepts(b).join(", "), b.payment, b.incoterm, b.portal, b.portalAccess, b.calendar, b.manual, b.procedures,
        os.length, sum(os, o => o.qty), +sum(os, o => o.qty * o.price).toFixed(2)];
    });
    return {
      file: "buyer-list", title: "Buyer list", note: [st !== "all" ? st + " buyers" : "", UI.sq.dir ? `search “${UI.sq.dir}”` : ""].filter(Boolean).join(", "),
      sheets: [{ name: "Buyers", rows, cols: [
        { h: "Buyer", w: 22 }, { h: "Country", w: 12 }, { h: "Currency", w: 9 }, { h: "Status", w: 9 },
        { h: "Main contact", w: 18 }, { h: "Designation", w: 18 }, { h: "Email", w: 26 }, { h: "Phone", w: 16 },
        { h: "Other contacts", w: 40, pdf: false }, { h: "Departments", w: 20 }, { h: "Payment terms", w: 14 }, { h: "Incoterms", w: 10 },
        { h: "Portal", w: 14, pdf: false }, { h: "Portal access", w: 36, pdf: false }, { h: "Working calendar", w: 26, pdf: false },
        { h: "Buyer manual / compliance", w: 36, pdf: false }, { h: "Procedures", w: 36, pdf: false },
        { h: "Orders", w: 8, f: "int" }, { h: "Order qty", w: 12, f: "int" }, { h: "Order value ($)", w: 14, f: "money" }
      ] }]
    };
  },
  onNew: () => Crud.create("buyers", { status: "Active", currency: "USD", incoterm: "FOB", contacts: [{}] }),
  render() {
    const all = Store.all("buyers"), orders = Store.all("orders");
    const active = all.filter(b => b.status !== "Inactive");
    const known = new Set(all.map(b => b.name));
    const linked = orders.filter(o => known.has(o.buyer));
    const cur = [...new Set(all.map(b => b.currency).filter(Boolean))];

    const stf = Pick("bst", [["all", "All statuses"], ["Active", "Active"], ["Inactive", "Inactive"]]);
    const shown = all.filter(b => UI.pick.bst === "all" || (b.status || "Active") === UI.pick.bst);
    const tools = Pick("buyer", all.map(b => [b.id, b.name]), (active[0] || {}).id);
    const sel = Store.get("buyers", UI.pick.buyer);

    const summary = all.map(b => {
      const os = orders.filter(o => o.buyer === b.name), open = os.filter(o => !Logic.info(o).closed);
      const styles = [...new Set([...os.map(o => o.style), ...Store.all("styles").filter(s => s.buyer === b.name).map(s => s.id)])];
      return { b, n: os.length, open: open.length, qty: sum(os, o => o.qty), value: sum(os, o => o.qty * o.price), styles };
    }).sort((a, b) => b.qty - a.qty);

    const prof = sel ? buyerProfile(sel) : [];
    const profDone = prof.filter(p => p.ok).length;
    const tech = sel ? (sel.tech || BUYER_TECH.map(() => "no")) : [];
    const selSum = sel && summary.find(x => x.b === sel);

    const directory = TB("Buyer directory", ["Buyer", "Country", "Currency", "Contact", "Email / phone", "Department", "Payment", "Incoterm", "Status"],
      shown.map(b => { const cs = bContacts(b), m = cs[0] || {}; return { cells: [{ html: `<span class="bn">${buyerLogo(b)}${esc(b.name)}</span>` }, b.country, b.currency,
        { html: cs.length ? `${esc(m.name)}${m.role ? ", " + esc(m.role) : ""}${cs.length > 1 ? ` <span class="chip c-p" title="${esc(cs.slice(1).map(c => c.name).join(", "))}">+${cs.length - 1} more</span>` : ""}<span hidden>${esc(cs.slice(1).map(c => c.name + " " + (c.role || "")).join(" "))}</span>` : "–" },
        m.email || m.phone || "–", bDepts(b).join(", ") || "–", b.payment, b.incoterm, st(b.status || "Active")], act: { act: "buyerView", id: b.id } }; }),
      { tools: `<small class="mute">Click a buyer to see details</small><input class="pk sr" type="search" data-act="bsearch" data-k="dir" placeholder="Search buyer, country, contact…" value="${esc(UI.sq.dir || "")}" aria-label="Search buyers">${stf}`, empty: "No buyers match. Click New to register one." });

    const profile = sel ? Card(`Buyer profile`, `<div class="vh sm">${buyerLogo(sel, "md")}<div><b>${esc(sel.name)}</b><small class="mute blk">${esc(sel.country || "")} · ${esc(sel.status || "Active")}</small></div></div><div class="res bp"><span>Country</span><b>${esc(sel.country || "–")}</b><span>Currency</span><b>${esc(sel.currency || "–")}</b><span>Payment terms</span><b>${esc(sel.payment || "–")}</b><span>Incoterms</span><b>${esc(sel.incoterm || "–")}</b><span>Departments</span><b>${esc(bDepts(sel).join(", ") || "–")}</b><span>Portal</span><b>${esc(sel.portal || "–")}</b><span>Holidays</span><b>${esc(sel.calendar || "–")}</b><span>Orders</span><b>${selSum.n} (${selSum.open} open) · ${num(selSum.qty)} pcs · ${money(selSum.value)}</b></div>`
      + `<h3 class="sub3">Contact persons <span class="chip c-p">${bContacts(sel).length}</span></h3>`
      + bContactsHtml(sel)
      + `<h3 class="sub3">Profile checklist <span class="chip c-${profDone === prof.length ? "ok" : "w"}">${profDone}/${prof.length}</span></h3>`
      + CK("", prof.map(p => ({ label: p.label, note: p.ok ? "Done" : "Missing", s: p.ok ? "ok" : "no", act: { act: "edit", col: "buyers", id: sel.id } })), { bare: true })
      + (sel.manual ? `<p class="note"><b>Buyer manual:</b> ${esc(sel.manual)}</p>` : "")
      + `<div class="card-foot"><button class="btn sm" data-act="buyerEdit" data-id="${esc(sel.id)}">Edit buyer</button><button class="btn sm g" data-act="newOrderFor" data-b="${esc(sel.name)}">New order for ${esc(sel.name)}</button></div>`, tools)
      : CK("Buyer profile", [], { empty: "No buyers yet. Click New to register one." });

    return KP([
      ["Total buyers", all.length, "Registered buyer accounts"],
      ["Active buyers", active.length, `${all.length - active.length} inactive`, active.length ? "ok" : "wn"],
      ["Currencies used", cur.length, cur.join(" / ") || "None yet"],
      ["Linked orders", linked.length, `POs across ${new Set(linked.map(o => o.buyer)).size} buyers`]
    ]) + directory
      + `<div class="g2">${profile}${sel ? `<div class="stack">${
        CK(`Technical requirements, ${sel.name}`, BUYER_TECH.map((l, j) => ({ label: l, note: LABEL[tech[j] || "no"], s: tech[j] || "no", act: { act: "btech", id: sel.id, i: j } })),
          { foot: `<p class="mute note">Click an item to change it: missing → in progress → done → not needed.</p>` })
      }${
        Card("Buyer-specific procedures", `<div class="fl">${[["Sample, inspection and packing", sel.procedures], ["Portal access", sel.portalAccess], ["Compliance notes", sel.manual]].map(([t, v]) => `<div class="f"><i class="${v ? "ok" : "no"}">${v ? "✓" : "–"}</i><b>${esc(t)}<small class="blk">${esc(v || "Not recorded yet")}</small></b></div>`).join("")}</div>`)
      }</div>` : ""}</div>`;
  }
});
Actions.newOrderFor = el => Crud.create("orders", { buyer: el.dataset.b });
