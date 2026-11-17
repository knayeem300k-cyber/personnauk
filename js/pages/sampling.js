/* Stage 3: Sampling – sample requests, buyer comments and courier tracking */

const SAMPLE_TYPES = ["Proto", "Fit", "Size set", "Salesman", "PP", "Shipment"];
const COURIERS = ["DHL", "FedEx", "UPS", "Aramex", "Hand carry"];
const TRACK = {
  DHL: n => "https://www.dhl.com/global-en/home/tracking/tracking-express.html?submit=1&tracking-id=" + n,
  FedEx: n => "https://www.fedex.com/fedextrack/?trknbr=" + n,
  UPS: n => "https://www.ups.com/track?tracknum=" + n
};
const awbCell = s => {
  if (!s.awb) return "Not sent";
  const t = TRACK[s.courier];
  return t ? { html: `<a class="lk" target="_blank" rel="noopener" href="${esc(t(s.awb.replace(/\s/g, "")))}">${esc(s.courier + " " + s.awb)}</a>` } : `${s.courier} ${s.awb}`;
};

Schemas.samples = {
  name: "Sample", label: r => `${r.order} ${r.type}`,
  fields: () => [
    { k: "order", l: "Order (PO)", t: "select", o: orderOpts(), req: 1 }, { k: "style", l: "Style code (blank = from order)" },
    { k: "type", l: "Sample type", t: "select", o: SAMPLE_TYPES }, { k: "status", l: "Status", t: "select", o: ["In progress", "Waiting", "Approved", "Rejected"] },
    { k: "sent", l: "Sent to buyer", t: "date" }, { k: "due", l: "Buyer reply due", t: "date" },
    { k: "courier", l: "Courier", t: "select", o: COURIERS }, { k: "awb", l: "AWB / tracking number" },
    { k: "comments", l: "Buyer comments", t: "textarea", full: 1 }
  ],
  validate: v => v.status === "Waiting" && !v.sent ? "Add the date the sample was sent." : "",
  after: r => {
    if (!r.style) { const o = Store.get("orders", r.order); if (o) r.style = o.style; }
    if (r.sent && !r.due) r.due = addDays(r.sent, 10);
    if (r.status === "Approved") { if (!r.approvedAt) r.approvedAt = iso(TODAY); } else delete r.approvedAt;
  }
};

Pages.add({
  id: "sampling", title: "Sampling", sub: "Sample requests, comments and courier tracking",
  onNew: () => Crud.create("samples", { status: "In progress" }),
  render() {
    const all = Store.all("samples"), open = all.filter(s => !["Approved", "Rejected"].includes(s.status));
    const waiting = all.filter(s => s.status === "Waiting"), past = waiting.filter(s => Logic.sampleStatus(s) === "Past due");
    const fits = all.filter(s => s.type === "Fit" && ["Approved", "Rejected"].includes(s.status));
    const dueWeek = open.filter(s => { const n = daysFrom(s.due); return n >= 0 && n <= 7; }).length;
    const rows = [...all].sort((a, b) => String(b.sent || "9").localeCompare(String(a.sent || "9")))
      .map(s => ({ cells: [s.order, s.style, s.type, fmtD(s.sent), awbCell(s), fmtD(s.due), st(Logic.sampleStatus(s))], act: { act: "edit", col: "samples", id: s.id } }));

    return KP([
      ["Samples in progress", open.length, `${dueWeek} due this week`],
      ["Waiting for buyer", waiting.length, `${past.length} past due`, past.length ? "bd" : "ok"],
      ["Approved this month", all.filter(s => sameMonth(s.approvedAt)).length, `Fit approval ${pct(fits.filter(s => s.status === "Approved").length, fits.length)}%`]
    ]) + `<div class="g2">${TB("Sample tracker", ["Order", "Style", "Type", "Sent", "AWB", "Reply due", "Status"], rows)}<div class="stack">${
      CK("Waiting for buyer comments", waiting.map(s => {
        const n = daysFrom(s.due);
        return { label: `${s.order} ${s.type}`, note: n < 0 ? `${-n} days late` : `due ${relDays(n)}`, s: n < 0 ? "no" : "wt", act: { act: "edit", col: "samples", id: s.id } };
      }), { empty: "No samples waiting for the buyer." })
    }${
      BR("Sample types in progress", SAMPLE_TYPES.map(t => [t, pct(open.filter(s => s.type === t).length, open.length)]))
    }</div></div>`;
  }
});
