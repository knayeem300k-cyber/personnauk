/* Stage 6–7: Production – daily line output, DHU, material in house and sewing progress */

Schemas.lines = {
  name: "Line report", label: r => `${r.line}, ${fmtD(r.date)}`,
  fields: () => [
    { k: "line", l: "Line / section", req: 1 }, { k: "order", l: "Order (PO)", t: "select", o: orderOpts(), req: 1 },
    { k: "date", l: "Date", t: "date", d: iso(TODAY), req: 1 }, { k: "target", l: "Target (pcs)", t: "number", req: 1 },
    { k: "actual", l: "Actual output (pcs)", t: "number", d: 0 }, { k: "checked", l: "Pieces checked by QC", t: "number", d: 0 },
    { k: "defects", l: "Defects found", t: "number", d: 0 }
  ]
};

Pages.add({
  id: "production", title: "Production", sub: "Daily output, line loading and follow-up",
  onNew: () => Crud.create("lines"),
  render() {
    const L = Store.all("lines"), last = L.reduce((m, l) => l.date > m ? l.date : m, "");
    const day = L.filter(l => l.date === last);
    const out = sum(day, l => l.actual), tgt = sum(day, l => l.target), chk = sum(day, l => l.checked), def = sum(day, l => l.defects);
    const dhu = chk ? def / chk * 100 : 0;
    const ords = [...new Set(day.map(l => l.order))];
    const behind = ords.filter(id => day.some(l => l.order === id && Logic.lineStatus(l) === "Behind"));
    const act = Logic.active();
    const tools = Pick("prod", act.map(o => [o.id, `${o.id} · ${o.buyer}`]), ords[0]);
    const o = Store.get("orders", UI.pick.prod);
    const bk = o ? Store.all("bookings").filter(b => b.order === o.id) : [];
    const prog = act.map(x => [x, sum(L.filter(l => l.order === x.id && !/cut/i.test(l.line)), l => l.actual)]).filter(x => x[1] > 0);

    return KP([
      [last === iso(TODAY) ? "Today’s output" : last ? `Output on ${fmtD(last)}` : "Output", num(out), `${pct(out, tgt)}% of target`, pct(out, tgt) >= 95 ? "ok" : "wn"],
      ["Average DHU", dhu.toFixed(1) + "%", "Target 2.5%", dhu <= 2.5 ? "ok" : "wn"],
      ["Orders running", ords.length, behind.length ? `${behind.length} behind plan` : "All on plan", behind.length ? "bd" : "ok"]
    ]) + `<div class="g2">${
      TB(last ? `Line status, ${fmtD(last)}` : "Line status", ["Line", "Order", "Target", "Actual", "Efficiency", "DHU", "Status"],
        day.map(l => { const d = Logic.dhu(l); return { cells: [l.line, l.order, num(l.target), num(l.actual), pct(l.actual, l.target) + "%", d === null ? "–" : d.toFixed(1) + "%", st(Logic.lineStatus(l))], act: { act: "edit", col: "lines", id: l.id } }; }),
        { empty: "No production entered yet. Click New to add a line report." })
    }<div class="stack">${
      CK(o ? `Material in house, ${o.id}` : "Material in house", bk.map(b => ({ label: b.item, note: b.status + (b.due ? `, due ${fmtD(b.due)}` : ""), s: b.status === "In house" ? "ok" : ["Failed", "Pending"].includes(b.status) ? "no" : "wt", act: { act: "edit", col: "bookings", id: b.id } })),
        { tools, empty: "No bookings for this order. Add them under Pre-production." })
    }${
      BR("Sewing progress", prog.map(([x, s]) => [x.id, pct(s, x.qty), `${pct(s, x.qty)}%`]), { empty: "No sewing output yet." })
    }</div></div>`;
  }
});
