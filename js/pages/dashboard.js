/* Dashboard: live summary of everything that needs attention today */

Pages.add({
  id: "dashboard", title: "Dashboard", sub: "Everything that needs you today",
  onNew: () => Crud.create("orders"),
  render() {
    const act = Logic.active(), samples = Store.all("samples");
    const waiting = samples.filter(s => s.status === "Waiting"), past = waiting.filter(s => Logic.sampleStatus(s) === "Past due");
    const week = Store.all("shipments").filter(s => { const n = daysFrom(s.shipDate); return n >= 0 && n <= 7; });
    const ready = week.filter(s => { const o = Store.get("orders", s.order); if (!o) return false; const c = Logic.docCount(o, 8); return c.done === c.total; });
    const tasks = act.flatMap(o => Logic.tna(o)), late = tasks.filter(t => t.late), soon = tasks.filter(t => !t.done && t.days >= 0 && t.days <= 7);
    const fresh = act.filter(o => daysFrom(o.created) >= -7).length;
    const alerts = Logic.alerts().slice(0, 8);
    const month = Store.all("shipments").filter(s => sameMonth(s.shipDate)).sort((a, b) => a.shipDate.localeCompare(b.shipDate));

    return KP([
      ["Active orders", act.length, `${fresh} new this week`],
      ["Samples waiting for buyer", waiting.length, `${past.length} past due`, past.length ? "bd" : "ok"],
      ["Shipping this week", week.length, `${ready.length} with all documents ready`, ready.length < week.length ? "wn" : "ok"],
      ["Overdue tasks", late.length, `${soon.length} due in the next 7 days`, late.length ? "bd" : "ok"]
    ]) + Pipe() + `<div class="g2">${
      TB("Today’s briefing", ["Update", "Order", "Stage"],
        alerts.map(a => ({ cells: [a.text, a.order, chip(a.stage, a.tone)], act: { act: "open", href: "#order/" + a.order } })),
        { empty: "All clear. Nothing needs you today." })
    }${
      CK("Shipments this month", month.map(s => {
        const o = Store.get("orders", s.order), c = o ? Logic.docCount(o, 8) : { done: 0, total: 0 }, n = daysFrom(s.shipDate);
        return { label: `${s.order}, ${o ? o.buyer : "unknown order"}`, note: `${fmtD(s.shipDate)} · docs ${c.done}/${c.total}`, s: c.done === c.total ? "ok" : n >= 0 && n <= 7 ? "wt" : "no", act: { act: "open", href: "#order/" + s.order } };
      }), { empty: "No shipments this month." })
    }</div>`;
  }
});
