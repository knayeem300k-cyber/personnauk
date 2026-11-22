/* Claude chat for the AI Assistant page, using Claude Haiku 5.5.
   Runs in the browser with the user's own API key, which is kept only in this browser (localStorage).
   Without a key the page keeps using the offline assistant (AIE in pages/ai-assistant.js). */

const CLAUDE = {
  model: "claude-haiku-5-5",
  label: "Claude Haiku 5.5",
  sdkUrl: "https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.5.0/+esm",
  keyName: "merchandiser-claude-key",
  hist: [],        // conversation sent to the API; only ever appended to
  lastSnap: "",    // last app-data snapshot sent in this conversation
  busy: false,
  sdk: null,
  server: null,    // set when the app is opened from the local backend (http://localhost:8787)

  SYSTEM: `You are the merchandising assistant inside "Merchandiser", an apparel merchandising app used by a garment merchandiser in Bangladesh. You help with buyers, product development, costing and BOM, sampling, purchase orders, pre-production (T&A calendar, bookings, approvals), production, quality (AQL inspections), shipping documents and payments.

Reply in the language the user writes in: Bangla, Banglish (Bangla written in English letters) or English.

The user's messages include "App data" blocks with the current state of the app as JSON; when there are several, the newest one is current. Base every fact about orders, buyers, styles, dates and money on that data. If the data doesn't contain something, say so instead of guessing. Today's date is in the data.

Write PO numbers as plain 5-digit numbers (for example 88217) so the app can turn them into links.

Keep answers short and practical: lead with the answer, then only the details that matter. Use a short list or a small table when comparing several items. When asked for a buyer email, write a ready-to-send email with a subject line, polite and clear, signed "[Your name]".

When a file such as a tech pack is attached, pull out the style details (style number, fabric and GSM, sizes and measurements, trims, stitching, labels, packing) and point out anything missing or unclear. If the style already exists in the app data, compare the file with it.

You cannot change data in the app. When something needs editing, tell the user which page to use (for example Orders and PO, Sampling, Buyer Management).`,

  getKey() { try { return localStorage.getItem(this.keyName) || ""; } catch (e) { return ""; } },
  setKey(k) { try { if (k) localStorage.setItem(this.keyName, k); else localStorage.removeItem(this.keyName); } catch (e) { toast("This browser blocks saving the key."); } },
  on() { return !!(this.server && this.server.hasKey) || !!this.getKey(); },
  name() { return this.server ? this.label + " · local server" : this.label; },

  /* When the page comes from the local backend, use it instead of a key in the browser */
  async init() {
    if (!/^https?:$/.test(location.protocol)) return;
    try {
      const r = await fetch("/claude/health", { cache: "no-store" });
      if (!r.ok) return;
      this.server = await r.json();
      if (location.hash === "#ai") App.render();
    } catch (e) { /* not running on the local backend */ }
  },
  reset() { this.hist = []; this.lastSnap = ""; },

  async client() {
    if (!this.sdk) this.sdk = (await import(this.sdkUrl)).default;
    if (this.server) return new this.sdk({ apiKey: "kept-on-local-server", baseURL: location.origin + "/claude", dangerouslyAllowBrowser: true });
    return new this.sdk({ apiKey: this.getKey(), dangerouslyAllowBrowser: true });
  },

  /* Compact JSON of the app's data (no images, no portal login notes) */
  snapshot() {
    const D = Store.d, n = v => v === "" || v == null ? undefined : +v;
    return JSON.stringify({
      today: iso(TODAY),
      orders: D.orders.map(o => {
        const i = Logic.info(o), r = Logic.review(o), s = i.closed ? null : i.stage;
        return { po: o.id, buyer: o.buyer, merchandiser: Team.name(Team.ofOrder(o)) || "not assigned", style: o.style, product: o.product, qty: n(o.qty), unitPrice: n(o.price), delivery: o.delivery,
          contractDelivery: o.contractDelivery, contractPrice: n(o.contractPrice), payment: o.payment, lc: o.lc,
          stage: i.closed ? "Closed" : STAGES[s].name, filesDone: i.pct + "%", poReview: r.chip,
          openFilesThisStage: s === null ? [] : STAGES[s].docs.filter((_, j) => !isDone(o.docs[s][j])),
          overdueTasks: Logic.tna(o).filter(t => t.late).map(t => `${t.name} (planned ${t.date})`) };
      }),
      buyers: D.buyers.map(b => ({ name: b.name, country: b.country, currency: b.currency, status: b.status || "Active", payment: b.payment, incoterm: b.incoterm,
        portal: b.portal, departments: typeof bDepts === "function" ? bDepts(b) : undefined,
        contacts: typeof bContacts === "function" ? bContacts(b).map(c => ({ name: c.name, role: c.role, email: c.email, phone: c.phone, department: c.department })) : undefined,
        calendar: b.calendar, manual: b.manual, procedures: b.procedures })),
      styles: (D.devs || []).map(d => ({ style: d.id, buyer: d.buyer, season: d.season, category: d.category, product: d.product, factory: d.factory,
        status: d.status, targetApproval: d.due, targetFob: n(d.targetPrice), projectedQty: n(d.targetQty), fabric: d.fabric, colours: d.colours, notes: d.notes })),
      techPacks: D.styles.map(s => { const o = { style: s.id, name: s.name, buyer: s.buyer, version: s.version, status: s.status }; SECTIONS.forEach(([k, l]) => { o[l] = s["s_" + k] || "MISSING"; }); return o; }),
      costings: D.costings.map(c => ({ style: c.style, buyer: c.buyer, status: c.status, fabric: n(c.fabric), trims: n(c.trims), cm: n(c.cm), wastage: n(c.wastage),
        commercial: n(c.commercial), profit: n(c.profit), fob: +Logic.fob(c).toFixed(2),
        bom: typeof bomLines === "function" ? bomLines(c).map(l => ({ item: l.item, type: l.type, supplier: l.supplier, unit: l.unit, consPerPc: l.cons, rate: l.rate, wastagePct: l.waste })) : undefined })),
      inquiries: D.inquiries.map(i => ({ id: i.id, buyer: i.buyer, style: i.style, qty: n(i.qty), targetPrice: n(i.target), received: i.received, status: i.status })),
      samples: D.samples.map(s => ({ po: s.order, style: s.style, type: s.type, sent: s.sent, replyDue: s.due, courier: s.courier, awb: s.awb, status: Logic.sampleStatus(s), comments: s.comments })),
      bookings: D.bookings.map(b => ({ po: b.order, type: b.type, item: b.item, supplier: b.supplier, booked: b.date, due: b.due, status: b.status, notes: b.notes })),
      production: D.lines.map(l => ({ date: l.date, line: l.line, po: l.order, target: n(l.target), actual: n(l.actual), dhuPct: Logic.dhu(l) === null ? undefined : +Logic.dhu(l).toFixed(1), status: Logic.lineStatus(l) })),
      inspections: D.inspections.map(i => ({ po: i.order, type: i.type, date: i.date, inspector: i.inspector, aql: i.aql, defects: i.defects === "" ? undefined : n(i.defects), result: Logic.inspResult(i), cap: i.capStatus || undefined, capDue: i.capDue })),
      shipments: D.shipments.map(s => { const o = Store.get("orders", s.order), c = o ? Logic.docCount(o, 8) : null; return { po: s.order, mode: s.mode, forwarder: s.forwarder, shipDate: s.shipDate, eta: s.eta, documentsReady: c ? `${c.done} of ${c.total}` : undefined, missingDocuments: o ? STAGES[8].docs.filter((_, j) => !isDone(o.docs[8][j])) : undefined }; }),
      payments: D.payments.map(p => ({ po: p.order, invoice: p.invoice, amount: n(p.amount), paid: n(p.paid), due: p.due, status: Logic.payStatus(p) })),
      team: Team.all().map(m => ({ name: m.name, role: m.role, status: m.status || "Active", buyers: Store.all("buyers").filter(b => b.merch === m.id).map(b => b.name) })),
      recentWork: (Store.all("activity") || []).slice(0, 25).map(a => `${Team.name(a.by) || "Team"}: ${a.text}${a.order ? " (" + a.order + ")" : ""}, ${a.at.slice(0, 16).replace("T", " ")}`),
      alerts: Logic.alerts().slice(0, 30).map(a => `${a.order}: ${a.text} (${a.stage})`)
    });
  },

  /* Read an attached file into a content block the API understands */
  async fileBlock(f) {
    if (f.size > 20 * 1024 * 1024) throw new Error("The file is larger than 20 MB.");
    const b64 = () => new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.onerror = () => bad(new Error("The file could not be read.")); r.readAsDataURL(f); });
    if (f.type === "application/pdf") return { type: "document", source: { type: "base64", media_type: "application/pdf", data: await b64() }, title: f.name };
    if (/^image\/(png|jpeg|gif|webp)$/.test(f.type)) return { type: "image", source: { type: "base64", media_type: f.type, data: await b64() } };
    if (/^text\//.test(f.type) || /\.(txt|csv|md)$/i.test(f.name)) return { type: "text", text: `File "${f.name}":\n${await f.text()}` };
    throw new Error("Claude can read PDF, PNG, JPG, GIF, WebP and text files. Save Word or Excel files as PDF first.");
  },

  /* Send one user turn and stream the reply into the chat */
  async send(q, file) {
    if (this.busy) return toast("Please wait for the current answer.");
    this.busy = true;
    const msg = { r: "a", h: `<p class="thinking">Thinking<span>.</span><span>.</span><span>.</span></p>`, live: true };
    AI.msgs.push(msg);
    aiShow();
    let added = false, text = "";
    try {
      const content = [], snap = this.snapshot();
      if (snap !== this.lastSnap) content.push({ type: "text", text: `App data (current state):\n${snap}` });
      if (file) content.push(await this.fileBlock(file));
      content.push({ type: "text", text: q });
      this.hist.push({ role: "user", content });
      added = true;
      const client = await this.client();
      const stream = client.messages.stream({
        model: this.model,
        max_tokens: 64000,
        output_config: { effort: "medium" },
        cache_control: { type: "ephemeral" },
        system: this.SYSTEM,
        messages: this.hist
      });
      stream.on("text", d => {
        text += d;
        const el = document.getElementById("aiLive");
        if (el) el.innerHTML = aiMd(text) + `<span class="cursor"></span>`;
      });
      const final = await stream.finalMessage();
      this.lastSnap = snap;
      if (final.stop_reason === "refusal") {
        this.hist.pop(); added = false;
        msg.h = `<p class="wn">Claude declined this request${final.stop_details && final.stop_details.category ? ` (${esc(final.stop_details.category)})` : ""}. Try asking in a different way.</p>`;
      } else {
        this.hist.push({ role: "assistant", content: final.content });
        const out = final.content.filter(b => b.type === "text").map(b => b.text).join("\n\n") || text;
        msg.h = aiMd(out) + (final.stop_reason === "max_tokens" ? `<p class="wn">The answer was cut off because it was too long. Ask Claude to continue.</p>` : "") + this.footer(final.usage);
      }
    } catch (e) {
      if (added) this.hist.pop();
      msg.h = `<p class="wn">${esc(this.errorText(e))}</p>`;
      console.error(e);
    } finally {
      delete msg.live;
      this.busy = false;
      aiShow();
    }
  },

  /* Approximate cost of one answer: Claude Haiku 5.5, prompts up to 100K tokens */
  footer(u) {
    if (!u) return "";
    const long = (u.input_tokens + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0)) > 100000;
    const inR = long ? 0.5 : 0.1, outR = long ? 2.5 : 0.5;
    const cost = (u.input_tokens * inR + (u.cache_creation_input_tokens || 0) * inR * 1.25 + (u.cache_read_input_tokens || 0) * inR * 0.1 + u.output_tokens * outR) / 1e6;
    return `<p class="mf">${esc(this.name())} · about $${cost < 0.001 ? cost.toFixed(5) : cost.toFixed(4)}</p>`;
  },

  errorText(e) {
    const A = this.sdk, is = n => !!(A && typeof A[n] === "function" && e instanceof A[n]);
    if (is("AuthenticationError")) return this.server ? "The local server has no working API key. Check backend/.env and restart the server." : "The API key was not accepted. Open Claude settings and check the key.";
    if (is("PermissionDeniedError")) return "This API key is not allowed to use Claude Haiku 5.5. Check your Claude Console.";
    if (is("RateLimitError")) return "Too many requests right now. Wait a minute and try again.";
    if (is("APIConnectionError")) return "Could not reach Claude. Check your internet connection.";
    if (is("BadRequestError")) return /credit balance/i.test(e.message) ? "Your Claude credit balance is too low. Add credit in the Claude Console (Billing)." : "Claude could not process this request: " + e.message;
    if (is("APIError")) return e.status === 529 ? "Claude is very busy right now. Try again in a moment." : `Claude error ${e.status || ""}: ${e.message}`;
    if (!A) return "Could not load the Claude library. Check your internet connection.";
    return e && e.message ? e.message : "Something went wrong.";
  },

  /* Check the key with a free token-count call */
  async test() {
    const client = await this.client();
    await client.messages.countTokens({ model: this.model, messages: [{ role: "user", content: "Hello" }] });
  }
};

/* Small, safe Markdown → HTML for Claude's answers (escape first, then format) */
function aiMd(src) {
  const inline = s => {
    s = esc(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<i>$2</i>");
    return s.replace(/\b(\d{5})\b/g, (m, id) => Store.get("orders", id) ? `<a class="lk" href="#order/${id}">${id}</a>` : m);
  };
  const lines = String(src).replace(/\r/g, "").split("\n"), out = [];
  let list = null, table = null, para = [];
  const flushP = () => { if (para.length) { out.push(`<p>${para.map(inline).join("<br>")}</p>`); para = []; } };
  const flushL = () => { if (list) { out.push(`<${list.t}>${list.items.map(i => `<li>${inline(i)}</li>`).join("")}</${list.t}>`); list = null; } };
  const flushT = () => {
    if (!table) return;
    const rows = table.filter(r => !/^\s*\|?\s*:?-{2,}/.test(r)).map(r => r.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map(c => c.trim()));
    out.push(`<div class="tw"><table><thead><tr>${rows[0].map(c => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${rows.slice(1).map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
    table = null;
  };
  for (const ln of lines) {
    const t = ln.trim();
    if (/^\|.*\|$/.test(t)) { flushP(); flushL(); (table = table || []).push(t); continue; }
    flushT();
    let m;
    if (!t) { flushP(); flushL(); continue; }
    if ((m = t.match(/^#{1,6}\s+(.*)$/))) { flushP(); flushL(); out.push(`<h4>${inline(m[1])}</h4>`); continue; }
    if ((m = t.match(/^[-*•]\s+(.*)$/))) { flushP(); if (!list || list.t !== "ul") { flushL(); list = { t: "ul", items: [] }; } list.items.push(m[1]); continue; }
    if ((m = t.match(/^\d+[.)]\s+(.*)$/))) { flushP(); if (!list || list.t !== "ol") { flushL(); list = { t: "ol", items: [] }; } list.items.push(m[1]); continue; }
    flushL(); para.push(t);
  }
  flushP(); flushL(); flushT();
  return out.join("") || "<p></p>";
}

/* Claude settings popup */
function claudeSettings() {
  if (CLAUDE.server) {
    const ok = CLAUDE.server.hasKey;
    return View.open({
      title: "Claude settings",
      head: `<div class="vh"><span class="blogo md">AI</span><div><h2>Claude settings</h2><p class="mute">${ok ? `Connected through the local server · ${esc(CLAUDE.label)}` : "Local server is running, but it has no API key"}</p></div></div>`,
      body: `<div class="res bp ck-note"><span>Where the key is</span><b>backend/.env on this computer</b><span>Model</span><b>${esc(CLAUDE.label)}</b><span>Cost</span><b>about $0.0005–0.005 per question</b></div>
        <p class="note mute">${ok ? "The key stays on this computer and is never sent to the browser or GitHub. To change it, edit backend/.env and restart the server." : "Put the key in backend/.env as ANTHROPIC_API_KEY=sk-ant-… and restart the server."}</p>`,
      buttons: [{ l: "Close", a: { act: "formClose" } }]
    });
  }
  const has = CLAUDE.on(), k = CLAUDE.getKey();
  View.open({
    title: "Claude settings",
    head: `<div class="vh"><span class="blogo md">AI</span><div><h2>Claude settings</h2><p class="mute">${has ? `Connected · ${esc(CLAUDE.label)}` : "Not connected · using the offline assistant"}</p></div></div>`,
    body: `<label class="fd full"><span>Claude API key</span><input id="claudeKey" type="password" autocomplete="off" spellcheck="false" placeholder="sk-ant-…" value="${has ? "••••••••" + esc(k.slice(-4)) : ""}"></label>
      <p class="err" id="claudeErr" hidden></p>
      <div class="res bp ck-note"><span>Model</span><b>${esc(CLAUDE.label)}</b><span>Cost</span><b>about $0.0005–0.005 per question</b></div>
      <p class="note mute">Create a key at platform.claude.com → Settings → API keys. The key is saved only in this browser. It is not part of Export backup and is never uploaded to GitHub. Use it only on your own computer, and set a monthly spend limit in the Claude Console.</p>`,
    buttons: [
      { l: "Close", a: { act: "formClose" }, g: 1 },
      ...(has ? [{ l: "Remove key", a: { act: "claudeRemove" }, g: 1 }] : []),
      { l: "Save and test", a: { act: "claudeSave" } }
    ]
  });
  const i = document.getElementById("claudeKey");
  if (i) { i.addEventListener("focus", () => { if (/^•/.test(i.value)) i.value = ""; }, { once: true }); }
}
Actions.claudeSettings = () => claudeSettings();
CLAUDE.init();
Actions.claudeRemove = () => { CLAUDE.setKey(""); CLAUDE.reset(); Form.close(); App.render(); toast("Key removed. Using the offline assistant."); };
Actions.claudeSave = async el => {
  const i = document.getElementById("claudeKey"), err = document.getElementById("claudeErr"), v = i ? i.value.trim() : "";
  const show = m => { err.textContent = m; err.hidden = false; };
  if (/^•/.test(v) && CLAUDE.on()) { Form.close(); return; }
  if (!/^sk-ant-[\w-]{20,}$/.test(v)) return show("That does not look like a Claude API key. It starts with sk-ant-.");
  const old = CLAUDE.getKey();
  CLAUDE.setKey(v);
  el.disabled = true; el.textContent = "Testing…";
  try {
    await CLAUDE.test();
    CLAUDE.reset(); Form.close(); App.render(); toast("Claude is connected");
  } catch (e) {
    CLAUDE.setKey(old);
    el.disabled = false; el.textContent = "Save and test";
    show(CLAUDE.errorText(e));
  }
};
