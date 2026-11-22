/* AI Assistant – an offline helper that answers from the data saved in this app.
   It understands English and common Banglish words (deri, taka, baki, kagoj, nomuna, chithi...). */

const AI = { msgs: [], n: 0 };
const AI_P = {
  s: "M12 3l2.2 6.3L21 12l-6.8 2.7L12 21l-2.2-6.3L3 12l6.8-2.7z", c: "M20 11l-8 8a5 5 0 01-7-7l9-9a3.5 3.5 0 015 5l-9 9a2 2 0 01-3-3l8-8",
  l: "M4 8h10M18 8h2M4 16h2M10 16h10M16 6v4M8 14v4", g: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  m: "M9 3h6v12H9zM5 11a7 7 0 0014 0M12 18v3", u: "M12 19V5M6 11l6-6 6 6", d: "M6 3h8l4 4v14H6zM14 3v4h4M9 13h6M9 17h6",
  k: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM8.5 12l2.5 2.5L16 9.5", e: "M3 5h18v14H3zM3 7l9 6 9-6"
};
const aiI = k => `<svg class="ic" viewBox="0 0 24 24"><path d="${AI_P[k]}"/></svg>`;

/* The answer engine */
const AIE = {
  kv: r => `<div class="kv">${r.map(([k, v]) => `<span>${esc(k)}</span><b>${esc(v)}</b>`).join("")}</div>`,
  ul: a => a.length ? `<ul>${a.map(x => `<li>${x}</li>`).join("")}</ul>` : "",
  btn: b => `<div class="ac">${b.map((x, i) => `<button${i ? ' class="g"' : ""}${attrs(x.a)}>${esc(x.l)}</button>`).join("")}</div>`,

  reply(q, file) {
    if (file) return this.file(file);
    const t = " " + q.toLowerCase() + " ", has = (...w) => w.some(x => t.includes(x));
    const ids = q.match(/\b\d{5}\b/g) || [];
    const oid = ids.find(x => Store.get("orders", x)), missing = ids.find(x => !Store.get("orders", x));
    const sm = q.match(/\b[a-z]{2}-?\d{4}\b/i), sty = sm && sm[0].toUpperCase().replace(/^([A-Z]{2})-?/, "$1-");
    if (has("help", "what can you", "ki ki", "ki korte paro")) return this.help();
    const bn = Store.all("buyers").find(b => t.includes(b.name.toLowerCase()));
    if (bn && !oid && !has("email", "mail", "draft")) return this.buyer(bn);
    if (has("buyer", "kreta") && !oid) return this.buyers();
    if (has("aql")) return this.aql(q);
    if (has("email", "mail", "draft", "chithi", "likh")) return this.email(oid);
    if (has("compare", "review", "contract", "milao", "check po", "check a po", "open po", " pos ") || (has(" po ") && has("check"))) return oid ? this.review(oid) : this.poList();
    if (sty || has("tech pack", "techpack", "measurement")) return this.style(sty || (oid && Store.get("orders", oid).style));
    if (has("sample", "nomuna")) return this.samples(oid);
    if (has("ship", "document", " doc", "kagoj", "packing list", "invoice", "b/l")) return this.ship(oid);
    if (has("payment", " pay ", "paid", "taka", "baki", "outstanding", "money")) return this.pay(oid);
    if (has("production", " line", "output", "dhu", "efficiency", "sewing")) return this.prod();
    if (has("inspection", "quality", "fail", " cap ")) return this.quality();
    if (has("late", "overdue", "delay", "deri", "today", " aj ", "brief", "urgent", "priority", "ki korbo", "problem", "issue", "attention")) return this.alerts();
    if (oid) return this.order(oid);
    if (missing) return `<p>I could not find order <b>${esc(missing)}</b>. Check the PO number on the Orders page.</p>`;
    return this.search(q);
  },

  help() {
    return `<p>I work offline with the data saved in this app. Try asking:</p>` + this.ul([
      "<b>88217</b>: status of an order", "<b>Check PO 88217</b>: compare the PO with the contract and costing",
      "<b>Draft email for 88162</b>: a ready-to-send buyer email", "<b>Tech pack LX-2041</b>: style details and missing sections",
      "<b>What is late today?</b>: everything that needs attention", "<b>Samples</b>, <b>shipments</b>, <b>payments</b>, <b>production</b>, <b>quality</b>",
      "<b>AQL 12000</b>: sample size and accept/reject numbers"
    ]) + `<p>Attach a file whose name contains the style code (for example LX-2041-techpack.pdf) and I will open that style.</p>`;
  },

  buyer(b) {
    const os = Store.all("orders").filter(o => o.buyer === b.name), open = os.filter(o => !Logic.info(o).closed);
    const miss = buyerProfile(b).filter(p => !p.ok);
    return `<p><b>${esc(b.name)}</b> (${esc(b.country || "country not set")}) is <b>${esc((b.status || "Active").toLowerCase())}</b>.</p>`
      + this.kv([["Currency", b.currency || "–"], ["Payment / Incoterm", `${b.payment || "–"} / ${b.incoterm || "–"}`], ["Contacts", bContacts(b).map(c => `${c.name}${c.role ? " (" + c.role + ")" : ""}${c.email ? ", " + c.email : ""}`).join("; ") || "–"], ["Departments", bDepts(b).join(", ") || "–"], ["Portal", b.portal || "–"], ["Orders", `${os.length} (${open.length} open), ${num(sum(os, o => o.qty))} pcs`], ["Styles", [...new Set(os.map(o => o.style))].join(", ") || "–"]])
      + (miss.length ? `<p class="wn">Profile is missing: ${miss.map(m => esc(m.label.toLowerCase())).join("; ")}.</p>` : `<p class="gd">The buyer profile is complete.</p>`)
      + this.btn([{ l: "Open buyer profile", a: { act: "open", href: "#buyers", k: "buyer", v: b.id } }, { l: "Edit buyer", a: { act: "edit", col: "buyers", id: b.id } }]);
  },

  buyers() {
    const all = Store.all("buyers");
    if (!all.length) return `<p>No buyers are registered yet.</p>`;
    return `<p>${all.length} buyers are registered:</p>` + this.ul(all.map(b => {
      const os = Store.all("orders").filter(o => o.buyer === b.name);
      return `<b>${esc(b.name)}</b>, ${esc(b.country || "–")}, ${esc(b.currency || "–")}: ${os.length} orders, ${num(sum(os, o => o.qty))} pcs <span class="${b.status === "Inactive" ? "wn" : "gd"}">(${esc((b.status || "Active").toLowerCase())})</span>`;
    })) + this.btn([{ l: "Open buyer management", a: { act: "open", href: "#buyers" } }]);
  },

  order(id) {
    const o = Store.get("orders", id), i = Logic.info(o), late = Logic.tna(o).filter(x => x.late), rv = Logic.review(o);
    const s = STAGES[i.stage], open = s.docs.filter((_, j) => !isDone(o.docs[i.stage][j]));
    return `<p>Order <b>${esc(id)}</b> for ${esc(o.buyer)} (${esc(o.style)}, ${num(o.qty)} pcs) ${i.closed ? "is <b>closed</b>" : `is at stage <b>${i.stage + 1}. ${esc(s.name)}</b>`}. ${i.pct}% of its files are done.</p>`
      + this.kv([["Delivery", `${fmtD(o.delivery)} (${relDays(daysFrom(o.delivery))})`], ["Value", money(o.qty * o.price)], ["PO review", rv.chip]])
      + (!i.closed && open.length ? `<p>Still open in this stage:</p>` + this.ul(open.map(esc)) : "")
      + (late.length ? `<p class="wn">Overdue: ${late.map(x => esc(x.name)).join(", ")}.</p>` : `<p class="gd">No overdue T&A tasks.</p>`)
      + this.btn([{ l: "Open order file", a: { act: "open", href: "#order/" + id } }, { l: "Draft email to buyer", a: { act: "aiAsk", q: "Draft email for " + id } }]);
  },

  review(id) {
    const o = Store.get("orders", id), r = Logic.review(o);
    const good = r.checks.filter(c => c.s === "ok"), bad = r.checks.filter(c => c.s !== "ok");
    return `<p>I checked PO <b>${esc(id)}</b> against the sales contract and the costing sheet.</p>`
      + (good.length ? `<p class="gd">Matches: ${good.map(c => esc(c.label.toLowerCase())).join("; ")}.</p>` : "")
      + (bad.length ? `<p><span class="wn">Needs attention:</span></p>` + this.ul(bad.map(c => `<b>${esc(c.label)}</b>: ${esc(c.note)}`)) : `<p>Everything matches. You can go ahead with booking.</p>`)
      + (r.date ? `<p>Confirm the delivery date with the buyer before booking fabric.</p>` : "")
      + this.btn([{ l: "Draft email to buyer", a: { act: "aiAsk", q: "Draft email for " + id } }, { l: "Open PO review", a: { act: "open", href: "#orders", k: "ord", v: id } }]);
  },

  poList() {
    const act = Logic.active(), rows = act.map(o => [o, Logic.review(o)]).filter(x => !x[1].ok);
    if (!rows.length) return `<p class="gd">I checked ${act.length} open POs. All of them match their contracts and costing.</p>`;
    return `<p>I checked ${act.length} open POs. ${rows.length} need attention:</p>`
      + this.ul(rows.map(([o, r]) => `<b>${esc(o.id)}</b> (${esc(o.buyer)}): ${r.checks.filter(c => c.s === "wt").map(c => esc(c.note)).join("; ")}`))
      + this.btn([{ l: `Check ${rows[0][0].id} in detail`, a: { act: "aiAsk", q: "Check PO " + rows[0][0].id } }, { l: "Open orders", a: { act: "open", href: "#orders" } }]);
  },

  email(id) {
    const act = Logic.active();
    const o = id ? Store.get("orders", id) : (act.find(x => !Logic.review(x).ok) || act[0]);
    if (!o) return `<p>There are no open orders to write about.</p>`;
    const r = Logic.review(o), info = Logic.info(o);
    const waiting = Store.all("samples").filter(s => s.order === o.id && s.status === "Waiting");
    const p = [];
    if (r.date) p.push(`PO ${o.id} shows a delivery date of ${fmtL(o.delivery)}, but the sales contract says ${fmtL(o.contractDelivery)}. Could you please confirm which date is correct? We will book fabric as soon as we hear from you.`);
    if (r.cp) p.push(`The unit price on the PO is ${price(o.price)}, but the contract price is ${price(o.contractPrice)}. Please confirm the correct price.`);
    if (r.priceLow) p.push(`Our final costing for style ${o.style} comes to ${price(r.fob)} per piece, which is above the PO price of ${price(o.price)}. Could we discuss a price revision?`);
    if (r.lc) p.push(`We have not received the L/C for this order yet. Please let us know when it will be opened so that we can keep the delivery date.`);
    waiting.forEach(s => p.push(`We sent the ${s.type.toLowerCase()} sample on ${fmtL(s.sent)}${s.awb ? ` (${s.courier} ${s.awb})` : ""}. We would appreciate your comments by ${fmtL(s.due)}.`));
    if (!p.length) p.push(`Here is a quick update on PO ${o.id} (${o.style}). The order is now at the ${STAGES[info.stage].name.toLowerCase()} stage and is on track for delivery on ${fmtL(o.delivery)}.`);
    const subj = `PO ${o.id}, style ${o.style}: ${r.date ? "delivery date confirmation" : r.cp || r.priceLow ? "price confirmation" : r.lc ? "L/C status" : waiting.length ? "sample comments" : "order update"}`;
    const body = `Dear ${o.buyer} team,\n\n${p.join("\n\n")}\n\nThank you,\n[Your name]\nMerchandising team`;
    const n = ++AI.n;
    return `<p>Here is a draft for ${esc(o.buyer)} about PO ${esc(o.id)}. Change the name at the end before sending.</p><pre id="em${n}" data-s="${esc(subj)}" data-b="${esc(body)}">Subject: ${esc(subj)}\n\n${esc(body)}</pre>`
      + this.btn([{ l: "Copy email", a: { act: "aiCopy", t: "em" + n } }, { l: "Open in mail app", a: { act: "aiMail", t: "em" + n } }, { l: "Open order file", a: { act: "open", href: "#order/" + o.id } }]);
  },

  style(code, fromFile) {
    const s = code && Store.get("styles", code);
    if (!s) return `<p>I could not find a tech pack for <b>${esc(code || "that style")}</b> in Product Development.</p>` + this.btn([{ l: "Open Product Development", a: { act: "open", href: "#pd" } }]);
    const miss = SECTIONS.filter(([k]) => !s["s_" + k]);
    return (fromFile ? `<p>This offline assistant cannot read the text inside the file, so the details below come from your style library. Check them against the file.</p>` : "")
      + `<p>Tech pack <b>${esc(s.id)}</b> (${esc(s.name)}, ${esc(s.buyer)}), version ${esc(s.version)}, status ${esc(s.status)}:</p>`
      + this.kv(SECTIONS.filter(([k]) => s["s_" + k]).map(([k, l]) => [l, s["s_" + k]]))
      + (miss.length ? `<p class="wn">Missing: ${miss.map(m => esc(m[1].toLowerCase())).join(", ")}.</p>` : `<p class="gd">All ${SECTIONS.length} sections are complete.</p>`)
      + this.btn(Store.get("devs", s.id) ? [{ l: "Open style", a: { act: "devView", id: s.id } }, { l: "Edit style and tech pack", a: { act: "devEdit", id: s.id } }] : [{ l: "Open Product Development", a: { act: "open", href: "#pd" } }]);
  },

  file(name) {
    const m = name.match(/([a-z]{2})-?(\d{4})/i);
    if (!m) return `<p>I could not find a style code in the file name <b>${esc(name)}</b>. Rename the file to include the style code (for example LX-2041-techpack.pdf), or ask “tech pack LX-2041”.</p>`;
    const code = (m[1] + "-" + m[2]).toUpperCase();
    return `<p>I matched <b>${esc(name)}</b> to style <b>${esc(code)}</b>.</p>` + this.style(code, true);
  },

  samples(oid) {
    const list = Store.all("samples").filter(s => oid ? s.order === oid : ["Waiting", "In progress"].includes(s.status));
    if (!list.length) return `<p class="gd">No open samples${oid ? " for " + esc(oid) : ""}.</p>`;
    return `<p>${oid ? `Samples for order ${esc(oid)}` : `${list.length} samples are open`}:</p>`
      + this.ul(list.map(s => { const stt = Logic.sampleStatus(s); return `<b>${esc(s.order)}</b> ${esc(s.type)} sample: <span class="${stt === "Past due" ? "wn" : ""}">${esc(stt)}</span>${s.due ? `, reply due ${fmtD(s.due)}` : ""}`; }))
      + this.btn([{ l: "Open sampling", a: { act: "open", href: "#sampling" } }]);
  },

  ship(oid) {
    if (oid) {
      const o = Store.get("orders", oid), miss = STAGES[8].docs.filter((_, j) => !isDone(o.docs[8][j])), sh = Store.all("shipments").find(s => s.order === oid);
      return `<p>Order <b>${esc(oid)}</b> ${sh ? `ships ${fmtD(sh.shipDate)} by ${esc(sh.mode.toLowerCase())}` : "has no shipment booked yet"}.</p>`
        + (miss.length ? `<p class="wn">${miss.length} documents still open:</p>` + this.ul(miss.map(esc)) : `<p class="gd">All shipping documents are ready.</p>`)
        + this.btn([{ l: "Open documents", a: { act: "open", href: "#shipping", k: "shp", v: sh ? sh.id : "" } }]);
    }
    const up = Store.all("shipments").filter(s => daysFrom(s.shipDate) >= 0).sort((a, b) => a.shipDate.localeCompare(b.shipDate));
    if (!up.length) return `<p>No upcoming shipments.</p>`;
    return `<p>Upcoming shipments:</p>` + this.ul(up.map(s => {
      const o = Store.get("orders", s.order), c = o ? Logic.docCount(o, 8) : { done: 0, total: 0 };
      return `<b>${esc(s.order)}</b> ${fmtD(s.shipDate)} by ${esc(s.mode.toLowerCase())}: <span class="${c.done < c.total ? "wn" : "gd"}">${c.done} of ${c.total} documents ready</span>`;
    })) + this.btn([{ l: "Open shipping", a: { act: "open", href: "#shipping" } }]);
  },

  pay(oid) {
    const list = Store.all("payments").filter(p => (oid ? p.order === oid : true) && Logic.payStatus(p) !== "Paid");
    if (!list.length) return `<p class="gd">No money is outstanding${oid ? " on " + esc(oid) : ""}.</p>`;
    const bal = p => (+p.amount || 0) - (+p.paid || 0);
    return `<p>${money(sum(list, bal))} is outstanding across ${list.length} invoices:</p>`
      + this.ul(list.map(p => { const s = Logic.payStatus(p); return `<b>${esc(p.order)}</b> ${esc(p.invoice)}: ${money(bal(p))}, <span class="${s === "Overdue" ? "wn" : ""}">${esc(s.toLowerCase())}</span> (due ${fmtD(p.due)})`; }))
      + this.btn([{ l: "Open payments", a: { act: "open", href: "#payments" } }]);
  },

  prod() {
    const L = Store.all("lines"), last = L.reduce((m, l) => l.date > m ? l.date : m, ""), day = L.filter(l => l.date === last);
    if (!day.length) return `<p>No production has been entered yet.</p>`;
    return `<p>Production on ${fmtD(last)}: ${num(sum(day, l => l.actual))} pieces, ${pct(sum(day, l => l.actual), sum(day, l => l.target))}% of target.</p>`
      + this.ul(day.map(l => { const d = Logic.dhu(l), s = Logic.lineStatus(l); return `<b>${esc(l.line)}</b> (${esc(l.order)}): ${num(l.actual)} of ${num(l.target)}${d === null ? "" : `, DHU ${d.toFixed(1)}%`}, <span class="${s === "On track" ? "gd" : "wn"}">${esc(s.toLowerCase())}</span>`; }))
      + this.btn([{ l: "Open production", a: { act: "open", href: "#production" } }]);
  },

  quality() {
    const all = Store.all("inspections"), failed = all.filter(i => Logic.inspResult(i) === "Failed" && i.capStatus !== "Done");
    const next = all.filter(i => Logic.inspResult(i) === "Scheduled").sort((a, b) => String(a.date).localeCompare(String(b.date)));
    return (failed.length ? `<p class="wn">${failed.length} failed inspections have an open CAP:</p>` + this.ul(failed.map(i => `<b>${esc(i.order)}</b> ${esc(i.type.toLowerCase())}: ${esc(i.defects)} defects, CAP due ${fmtD(i.capDue)}`)) : `<p class="gd">No open CAPs.</p>`)
      + (next.length ? `<p>Next inspections:</p>` + this.ul(next.map(i => `<b>${esc(i.order)}</b> ${esc(i.type.toLowerCase())} with ${esc(i.inspector)} on ${fmtD(i.date)}`)) : "")
      + this.btn([{ l: "Open quality", a: { act: "open", href: "#quality" } }]);
  },

  alerts() {
    const a = Logic.alerts();
    if (!a.length) return `<p class="gd">All clear. Nothing needs you today.</p>`;
    return `<p>${a.length} things need attention. The most urgent first:</p>`
      + this.ul(a.slice(0, 10).map(x => `<b>${esc(x.order)}</b> <span class="${x.sev === 2 ? "wn" : ""}">${esc(x.text)}</span> (${esc(x.stage)})`))
      + this.btn([{ l: "Open " + a[0].order, a: { act: "open", href: "#order/" + a[0].order } }, { l: "Open dashboard", a: { act: "open", href: "#dashboard" } }]);
  },

  aql(q) {
    const nums = (q.replace(/,/g, "").match(/\d+(\.\d+)?/g) || []).map(Number).filter(n => n !== 2.5 && n !== 4);
    const lot = nums.length ? Math.max(...nums) : 0, lvl = /\b4(\.0)?\b/.test(q) ? "4.0" : "2.5";
    const a = Logic.aql(lot, lvl);
    if (!a) return `<p>Tell me the lot size, for example “AQL 12000”.</p>`;
    return `<p>For a lot of ${num(lot)} pieces at AQL ${a.level}:</p>` + this.kv([["Sample size", a.n + " pcs"], ["Accept if defects", "≤ " + a.ac], ["Reject if defects", "≥ " + a.re]]);
  },

  search(q) {
    const words = q.toLowerCase().split(/\W+/).filter(w => w.length >= 3);
    const hit = obj => words.some(w => Object.values(obj).some(v => typeof v !== "object" && String(v).toLowerCase().includes(w)));
    const found = [
      ...Store.all("orders").filter(hit).map(o => ({ l: `Order ${o.id}, ${o.buyer}, ${o.style}`, h: "#order/" + o.id })),
      ...Store.all("devs").filter(hit).map(d => ({ l: `Style ${d.id} ${d.product}`, a: { act: "devView", id: d.id } })),
      ...Store.all("inquiries").filter(hit).map(i => ({ l: `Inquiry ${i.id}, ${i.buyer}`, h: "#inquiry", k: "inq", v: i.id }))
    ].slice(0, 6);
    if (!found.length) return `<p>I am not sure what you mean. ${this.help().slice(3)}`;
    return `<p>Here is what I found:</p>` + this.btn(found.map(f => ({ l: f.l, a: f.a || { act: "open", href: f.h, ...(f.k ? { k: f.k, v: f.v } : {}) } })));
  }
};

/* Send a message: to Claude when a key is saved, otherwise to the offline assistant */
function aiSay(q, file, fileObj) {
  if (typeof CLAUDE !== "undefined" && CLAUDE.busy) return toast("Please wait for the current answer.");
  AI.msgs.push({ r: "u", t: q, f: file });
  if (typeof CLAUDE !== "undefined" && CLAUDE.on()) {
    if (location.hash !== "#ai") location.hash = "#ai";
    CLAUDE.send(q, fileObj);
    return;
  }
  let h;
  try { h = AIE.reply(q, file); } catch (e) { console.error(e); h = "<p>Sorry, something went wrong while reading your data.</p>"; }
  AI.msgs.push({ r: "a", h });
  if (location.hash !== "#ai") { location.hash = "#ai"; return; }
  aiShow();
}
/* Re-draw the chat and keep the newest message in view */
function aiShow() {
  if (location.hash !== "#ai") return;
  App.render();
  const um = document.querySelectorAll(".ai .um");
  if (um.length) um[um.length - 1].scrollIntoView({ block: "start", behavior: "smooth" });
  const inp = document.getElementById("aiIn"); if (inp) inp.focus();
}
Actions.aiSend = () => { const i = document.getElementById("aiIn"), q = i && i.value.trim(); if (q) aiSay(q); };
Actions.aiAsk = el => aiSay(el.dataset.q === "help" ? "What can you do?" : el.dataset.q);
Actions.aiEmail = el => aiSay("Draft email for " + el.dataset.id);
Actions.aiChip = el => {
  const q = el.dataset.q;
  if (q === "tp") return document.getElementById("aiFile").click();
  aiSay(q === "po" ? "Check all open POs" : "Draft an email to the buyer");
};
Actions.aiAttach = () => document.getElementById("aiFile").click();
Actions.aiFile = el => {
  const f = el.files[0];
  el.value = "";
  if (!f) return;
  const typed = (document.getElementById("aiIn") || {}).value || "";
  aiSay(typed.trim() || "Read this tech pack and list the style details. Point out anything missing.", f.name, f);
};
Actions.aiNew = () => {
  if (typeof CLAUDE !== "undefined") { if (CLAUDE.busy) return toast("Please wait for the current answer."); CLAUDE.reset(); }
  AI.msgs = []; App.render();
};
Actions.aiCopy = el => {
  const t = document.getElementById(el.dataset.t).innerText;
  if (navigator.clipboard) navigator.clipboard.writeText(t).then(() => toast("Email copied"), () => toast("Copy failed. Select the text and copy it."));
  else toast("Copy is not available here. Select the text and copy it.");
};
Actions.aiMail = el => {
  const p = document.getElementById(el.dataset.t);
  location.href = `mailto:?subject=${encodeURIComponent(p.dataset.s)}&body=${encodeURIComponent(p.dataset.b)}`;
};
Actions.aiVoice = el => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return toast("Voice input is not supported in this browser. Try Chrome.");
  const r = new SR();
  r.lang = "en-US";
  r.onresult = e => { const inp = document.getElementById("aiIn"); if (inp) { inp.value = e.results[0][0].transcript; inp.focus(); } };
  r.onerror = () => toast("Could not hear you. Check microphone permission.");
  r.onend = () => el.classList.remove("rec");
  el.classList.add("rec");
  r.start();
};

Pages.add({
  id: "ai", title: "AI Assistant", sub: "Ask about orders, files and documents", filter: false,
  render() {
    const pop = AI.visit !== App.visit ? " pop" : "";
    AI.visit = App.visit;
    const log = AI.msgs.map(m => m.r === "u" ? `<div class="um">${esc(m.t)}${m.f ? `<small>${aiI("d")}${esc(m.f)}</small>` : ""}</div>` : `<div class="am"${m.live ? ' id="aiLive"' : ""}>${m.h}</div>`).join("");
    const cl = typeof CLAUDE !== "undefined" && CLAUDE.on();
    const badge = `<button class="aib${cl ? " on" : ""}" data-act="claudeSettings" title="Claude settings"><i></i>${cl ? esc(CLAUDE.name()) : "Offline assistant · connect Claude"}</button>`;
    return `<div class="ai" data-v="${AI.msgs.length ? "chat" : "home"}"><div class="mid"><div class="h"><div class="orb"></div><h2>Ready to work on your next order?</h2><p>Check a PO, find what is late, read a tech pack or draft a buyer email. Ask in Bangla, Banglish or English.</p>${badge}</div>
<div class="cv">${log}<div class="cvf">${badge}<button class="nw" data-act="aiNew">Start a new chat</button></div></div></div>
<div class="chp${pop}"><button data-act="aiChip" data-q="tp">Read tech pack ${aiI("d")}</button><button data-act="aiChip" data-q="po">Check a PO ${aiI("k")}</button><button data-act="aiChip" data-q="email">Draft an email ${aiI("e")}</button></div>
<div class="bx neon${pop}"><div class="q">${aiI("s")}<textarea id="aiIn" rows="1" placeholder="Ask anything about your orders…" aria-label="Message"></textarea></div><div class="tl"><button data-act="aiAttach">${aiI("c")}Attach</button><i></i><button data-act="aiAsk" data-q="help">${aiI("l")}What can I ask?</button><i></i><button data-act="aiAsk" data-q="What needs attention today?">${aiI("g")}Today</button><span class="rt"><button class="r" data-act="aiVoice" aria-label="Voice">${aiI("m")}</button><button class="r go" data-act="aiSend" aria-label="Send">${aiI("u")}</button></span></div></div>
<input type="file" id="aiFile" data-act="aiFile" accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.csv,.md" hidden></div>`;
  }
});
