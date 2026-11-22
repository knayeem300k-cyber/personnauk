/* Business rules: order stage, PO review, T&A, AQL, statuses, alerts, and automatic file ticking */

const LABEL = { ok: "Done", wt: "In progress", no: "Missing", na: "Not needed" };
const NEXT = { no: "wt", wt: "ok", ok: "na", na: "no" };
const isDone = v => v === "ok" || v === "na";
const TONES = {
  Active: "ok", Inactive: "w",
  New: "p", Costing: "w", Quoted: "ok", "Capacity check": "w", Won: "ok", Lost: "b",
  Draft: "p", Review: "w", Final: "ok", "Awaiting approval": "w", Approved: "ok",
  "In progress": "p", Waiting: "w", "Past due": "b", Rejected: "b",
  Pending: "p", Booked: "p", Awaiting: "w", "In house": "ok", Failed: "b",
  Passed: "ok", Scheduled: "p", Paid: "ok", Overdue: "b", "Due soon": "w", "Not due": "p",
  Open: "w", Done: "ok", "On track": "ok", "Slightly behind": "w", Behind: "b",
  Clear: "ok", Closed: "ok", "Date conflict": "b", "Check price": "w", "L/C pending": "w"
};

const Logic = {
  /* Progress of an order through the 10 stages, based on its file checklist */
  info(o) {
    const per = o.docs.map(a => ({ done: a.filter(isDone).length, total: a.length, started: a.some(x => x !== "no") }));
    const done = sum(per, p => p.done), total = sum(per, p => p.total);
    let stage = 0;
    per.forEach((p, i) => { if (p.started) stage = i; });
    if (per[stage].done === per[stage].total && stage < per.length - 1) stage++;
    const behind = per.slice(0, stage).reduce((s, p) => s + p.total - p.done, 0);
    return { per, done, total, pct: pct(done, total), closed: done === total, stage, behind };
  },
  active() { return Store.all("orders").filter(o => !this.info(o).closed); },
  docCount(o, s) { const a = o.docs[s]; return { done: a.filter(isDone).length, total: a.length }; },

  /* Profit on an order: (order price − cost per piece from its costing sheet) × quantity.
     Returns null when the style has no costing sheet. */
  orderProfit(o) {
    const c = Store.all("costings").find(x => x.style === o.style);
    if (!c) return null;
    const cost = this.fob(c) - (+c.profit || 0), qty = +o.qty || 0, value = qty * (+o.price || 0);
    return { value, profit: qty * ((+o.price || 0) - cost) };
  },
  marginOf(orders) {
    const known = orders.map(o => this.orderProfit(o)).filter(Boolean), value = sum(known, k => k.value);
    return { known: known.length, value, profit: sum(known, k => k.profit), pct: value ? sum(known, k => k.profit) / value * 100 : null };
  },
  fob(c) { return ["fabric", "trims", "cm", "wastage", "commercial", "profit"].reduce((s, k) => s + (+c[k] || 0), 0); },
  secDone(s) { return SECTIONS.filter(([k]) => String(s["s_" + k] || "").trim()).length; },

  /* Compare a PO with its sales contract and costing sheet */
  review(o) {
    const c = Store.all("costings").find(x => x.style === o.style);
    const fob = c ? this.fob(c) : null;
    const priceLow = fob !== null && +o.price < fob - 0.001;
    const cp = o.contractPrice !== "" && o.contractPrice != null && Math.abs(+o.contractPrice - +o.price) > 0.001;
    const date = !!o.contractDelivery && o.contractDelivery !== o.delivery;
    const lc = o.payment === "L/C" && o.lc !== "Received";
    const checks = [
      { label: "Price matches costing", note: fob === null ? `No costing sheet for ${o.style}` : priceLow ? `PO ${price(o.price)}, costing ${price(fob)}` : `${price(o.price)} per piece`, s: fob === null ? "no" : priceLow ? "wt" : "ok" },
      { label: "Price matches sales contract", note: cp ? `Contract says ${price(o.contractPrice)}` : "Same price", s: cp ? "wt" : "ok" },
      { label: "Delivery date matches contract", note: date ? `PO ${fmtD(o.delivery)}, contract ${fmtD(o.contractDelivery)}` : fmtD(o.delivery), s: date ? "wt" : "ok" },
      { label: "Payment term and L/C", note: (o.payment || "–") + (o.payment === "L/C" ? `, L/C ${String(o.lc || "pending").toLowerCase()}` : ""), s: lc ? "wt" : "ok" }
    ];
    const ok = !priceLow && !cp && !date && !lc;
    const chip = date ? "Date conflict" : priceLow || cp ? "Check price" : lc ? "L/C pending" : "Clear";
    return { ok, date, priceLow, cp, lc, fob, checks, chip };
  },

  /* T&A calendar worked out backwards from the delivery date */
  tna(o) {
    if (!o.delivery) return [];
    return TNA_PLAN.map(([name, off, s, j]) => {
      const date = addDays(o.delivery, off), done = isDone(o.docs[s][j]), days = daysFrom(date);
      return { name, date, days, done, late: !done && days < 0, s, j };
    });
  },

  sampleStatus(s) { return s.status === "Waiting" && daysFrom(s.due) < 0 ? "Past due" : s.status; },

  payStatus(p) {
    const bal = (+p.amount || 0) - (+p.paid || 0), n = daysFrom(p.due);
    return bal <= 0 ? "Paid" : n < 0 ? "Overdue" : n <= 14 ? "Due soon" : "Not due";
  },

  dhu(l) { return +l.checked > 0 ? (+l.defects || 0) / +l.checked * 100 : null; },
  lineStatus(l) {
    const r = +l.target ? (+l.actual || 0) / +l.target : 1;
    return r >= 0.95 ? "On track" : r >= 0.8 ? "Slightly behind" : "Behind";
  },

  /* AQL sample size and accept/reject numbers (ANSI/ASQ Z1.4, general level II, single sampling, normal) */
  aql(lot, level) {
    lot = Math.round(+lot || 0);
    if (lot < 2) return null;
    const T = [[150, 20], [280, 32], [500, 50], [1200, 80], [3200, 125], [10000, 200], [35000, 315], [150000, 500], [500000, 800], [Infinity, 1250]];
    const AC = { "2.5": { 20: 1, 32: 2, 50: 3, 80: 5, 125: 7, 200: 10, 315: 14, 500: 21 }, "4.0": { 20: 2, 32: 3, 50: 5, 80: 7, 125: 10, 200: 14, 315: 21 } };
    const L = AC[level] ? level : "2.5", tb = AC[L], max = Math.max(...Object.keys(tb).map(Number));
    if (lot < 20) return { n: lot, ac: 0, re: 1, level: L };
    const n = Math.min(T.find(t => lot <= t[0])[1], max);
    return { n, ac: tb[n], re: tb[n] + 1, level: L };
  },
  inspLot(i) { const o = Store.get("orders", i.order); return +i.lot || (o ? +o.qty : 0); },
  inspResult(i) {
    if (i.defects === "" || i.defects == null) return "Scheduled";
    const a = this.aql(this.inspLot(i), i.aql);
    return !a || +i.defects <= a.ac ? "Passed" : "Failed";
  },

  /* Everything that needs attention, most urgent first */
  alerts() {
    const A = [], add = (sev, text, order, stage, tone) => A.push({ sev, text, order, stage, tone });
    const D = Store.d, active = new Set(this.active().map(o => o.id));
    D.samples.forEach(s => {
      const st = this.sampleStatus(s);
      if (st === "Past due") add(2, `${s.type} sample reply is ${-daysFrom(s.due)} days late`, s.order, "Sampling", "b");
      else if (st === "Waiting" && daysFrom(s.due) <= 3) add(1, `${s.type} sample comments due ${relDays(daysFrom(s.due))}`, s.order, "Sampling", "w");
    });
    this.active().forEach(o => {
      const r = this.review(o);
      if (r.date) add(2, "PO delivery date differs from contract", o.id, "PO review", "b");
      if (r.priceLow) add(1, `PO price is below costing (${price(o.price)} vs ${price(r.fob)})`, o.id, "PO review", "w");
      if (r.cp) add(1, "PO price differs from contract", o.id, "PO review", "w");
      if (r.lc) add(1, "L/C not received yet", o.id, "PO review", "w");
      this.tna(o).filter(t => t.late).forEach(t => add(2, `${t.name} is ${-t.days} days overdue`, o.id, STAGES[t.s].name, "b"));
    });
    D.bookings.filter(b => active.has(b.order)).forEach(b => {
      if (b.status === "Failed") add(2, `${b.item} failed${b.notes ? ": " + b.notes : ""}`, b.order, "Pre-production", "b");
      else if (daysFrom(b.due) < 0 && !["In house", "Approved"].includes(b.status)) add(1, `${b.item} is late from ${b.supplier || "supplier"}`, b.order, "Pre-production", "w");
    });
    const last = D.lines.reduce((m, l) => l.date > m ? l.date : m, "");
    D.lines.filter(l => l.date === last && this.lineStatus(l) === "Behind").forEach(l => add(1, `${l.line} is behind plan (${pct(l.actual, l.target)}%)`, l.order, "Production", "w"));
    D.inspections.forEach(i => {
      const r = this.inspResult(i);
      if (r === "Failed" && i.capStatus !== "Done") add(2, `${i.type} inspection failed, CAP due ${fmtD(i.capDue)}`, i.order, "Quality", "b");
      else if (r === "Scheduled" && daysFrom(i.date) >= 0 && daysFrom(i.date) <= 7) add(0, `${i.type} inspection ${relDays(daysFrom(i.date))}`, i.order, "Quality", "p");
    });
    D.shipments.forEach(s => {
      const o = Store.get("orders", s.order), n = daysFrom(s.shipDate);
      if (!o || !(n >= 0 && n <= 10)) return;
      const c = this.docCount(o, 8);
      if (c.done < c.total) add(1, `Ships ${relDays(n)}, ${c.total - c.done} documents missing`, s.order, "Shipping", "w");
    });
    D.payments.forEach(p => {
      const st = this.payStatus(p), bal = (+p.amount || 0) - (+p.paid || 0);
      if (st === "Overdue") add(2, `Payment of ${money(bal)} is ${-daysFrom(p.due)} days overdue`, p.order, "Payments", "b");
      else if (st === "Due soon") add(0, `Payment of ${money(bal)} due ${relDays(daysFrom(p.due))}`, p.order, "Payments", "p");
    });
    return A.sort((a, b) => b.sev - a.sev);
  },

  /* Tick order files automatically from the records entered in each module.
     It only moves a file forward (missing → in progress → done), never back. */
  sync() {
    const D = Store.d;
    const up = (o, s, i, v) => {
      const c = o.docs[s][i];
      if (v === "ok") { if (!isDone(c)) o.docs[s][i] = "ok"; }
      else if (c === "no") o.docs[s][i] = v;
    };
    D.orders.forEach(o => {
      const by = c => D[c].filter(x => x.order === o.id);
      up(o, 3, 1, "ok");
      up(o, 3, 4, this.review(o).ok ? "ok" : "wt");
      if (o.payment === "L/C" && o.lc === "Received") up(o, 3, 3, "ok");
      const tp = Store.get("styles", o.style);
      if (tp) up(o, 0, 0, this.secDone(tp) === SECTIONS.length ? "ok" : "wt");
      const cs = D.costings.find(c => c.style === o.style);
      if (cs) up(o, 1, 0, cs.status === "Approved" ? "ok" : "wt");
      by("samples").forEach(s => {
        if (s.awb) up(o, 2, 4, "ok");
        if (s.status === "Approved") { if (s.type === "Fit") up(o, 2, 3, "ok"); if (s.type === "PP") up(o, 5, 1, "ok"); }
        else if (s.status === "Waiting" && s.type === "Fit") up(o, 2, 3, "wt");
      });
      by("bookings").forEach(b => {
        const m = { Fabric: 2, Trims: 3, "Lab dip": 4, "Strike-off": 5, Embroidery: 6, Print: 6, Wash: 6, Test: 7 }[b.type];
        if (m === undefined) return;
        const good = m <= 3 ? ["Booked", "Awaiting", "In house", "Approved"].includes(b.status) : b.status === "Approved";
        up(o, 4, m, good ? "ok" : "wt");
      });
      const ls = by("lines");
      if (ls.length) { up(o, 6, 0, "ok"); if (ls.some(l => +l.checked > 0)) up(o, 6, 3, "ok"); }
      by("inspections").forEach(i => {
        const r = this.inspResult(i);
        if (r === "Passed" && i.type === "Final") { up(o, 7, 0, "ok"); if (i.inspector !== "Internal") up(o, 7, 1, "ok"); }
        if (r === "Failed" && i.type !== "In-line") up(o, 7, 3, i.capStatus === "Done" ? "ok" : "wt");
      });
      if (by("shipments").length) up(o, 8, 2, "wt");
      const ps = by("payments");
      if (ps.length) up(o, 9, 0, ps.every(p => (+p.paid || 0) >= (+p.amount || 0)) ? "ok" : "wt");
      this.stamp(o);
    });
    Store.save();
  },
  /* Record when an order was closed (all files done) */
  stamp(o) {
    if (this.info(o).closed) { if (!o.closedAt) o.closedAt = iso(TODAY); }
    else delete o.closedAt;
  }
};
