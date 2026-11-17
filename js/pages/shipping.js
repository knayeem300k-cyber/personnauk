/* Stage 9: Shipping and documents – booking, shipping papers and customs */

Schemas.shipments = {
  name: "Shipment", label: r => r.order,
  fields: () => [
    { k: "order", l: "Order (PO)", t: "select", o: orderOpts(), req: 1 }, { k: "mode", l: "Mode", t: "select", o: ["Sea", "Air"] },
    { k: "forwarder", l: "Forwarder" }, { k: "vessel", l: "Vessel / flight" },
    { k: "shipDate", l: "Ship date", t: "date", req: 1 }, { k: "eta", l: "ETA at destination", t: "date" },
    { k: "bl", l: "B/L or AWB number" }
  ]
};

Pages.add({
  id: "shipping", title: "Shipping and documents", sub: "Booking, shipping papers and customs",
  onNew: () => Crud.create("shipments"),
  render() {
    const all = [...Store.all("shipments")].sort((a, b) => String(a.shipDate).localeCompare(String(b.shipDate)));
    const counts = s => { const o = Store.get("orders", s.order); return o ? Logic.docCount(o, 8) : { done: 0, total: STAGES[8].docs.length }; };
    const month = all.filter(s => sameMonth(s.shipDate));
    const upcoming = all.filter(s => daysFrom(s.shipDate) >= 0);
    const dDone = sum(upcoming, s => counts(s).done), dTotal = sum(upcoming, s => counts(s).total);
    const water = all.filter(s => daysFrom(s.shipDate) <= 0 && daysFrom(s.eta) > 0);
    const nextEta = water.map(s => s.eta).sort()[0];
    const tools = Pick("shp", [...upcoming, ...all.filter(s => daysFrom(s.shipDate) < 0).reverse()].map(s => [s.id, `${s.order} · ${fmtD(s.shipDate)}`]));
    const sel = Store.get("shipments", UI.pick.shp), o = sel && Store.get("orders", sel.order);

    return KP([
      ["Shipments this month", month.length, `${month.filter(s => s.mode === "Air").length} by air`],
      ["Documents complete", pct(dDone, dTotal) + "%", `${dTotal - dDone} missing for upcoming shipments`, dDone < dTotal ? "wn" : "ok"],
      ["On water now", water.length, nextEta ? `Next ETA ${fmtD(nextEta)}` : "None"]
    ]) + `<div class="g2">${
      TB("Shipments", ["Order", "Mode", "Forwarder", "Ship date", "ETA", "Documents"], all.map(s => {
        const c = counts(s), n = daysFrom(s.shipDate);
        return { cells: [s.order, s.mode, s.forwarder, fmtD(s.shipDate), fmtD(s.eta), chip(`${c.done} of ${c.total}`, c.done === c.total ? "ok" : n >= 0 && n <= 7 ? "b" : n < 0 ? "w" : "p")], act: { act: "edit", col: "shipments", id: s.id } };
      }))
    }${
      o ? CK(`Documents for ${o.id}`, docItems(o, 8), { tools, foot: `<div class="card-foot"><button class="btn sm g" data-act="open" data-href="#order/${esc(o.id)}">Open order file</button></div>` })
        : CK("Documents", [], { tools, empty: "No shipments yet." })
    }</div>`;
  }
});
