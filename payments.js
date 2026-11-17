/* Stage 10: Payments and closing – collect payment and close the order file */

Schemas.payments = {
  name: "Payment", label: r => r.invoice || r.order,
  fields: () => [
    { k: "order", l: "Order (PO)", t: "select", o: orderOpts(), req: 1 }, { k: "invoice", l: "Invoice number (blank = auto)" },
    { k: "amount", l: "Invoice amount ($, blank = order value)", t: "number" }, { k: "due", l: "Due date", t: "date", req: 1 },
    { k: "paid", l: "Paid so far ($)", t: "number", d: 0 }, { k: "paidDate", l: "Last payment date", t: "date" }
  ],
  after: r => {
    const o = Store.get("orders", r.order);
    if (!r.invoice) r.invoice = "INV-" + r.order;
    if ((r.amount === "" || r.amount == null) && o) r.amount = +(o.qty * o.price).toFixed(2);
  }
};

Pages.add({
  id: "payments", title: "Payments and closing", sub: "Collect payment and close the order file",
  onNew: () => Crud.create("payments", { order: UI.pick.pay }),
  render() {
    const all = Store.all("payments").map(p => ({ p, s: Logic.payStatus(p), bal: (+p.amount || 0) - (+p.paid || 0), o: Store.get("orders", p.order) }));
    const open = all.filter(x => x.s !== "Paid"), over = all.filter(x => x.s === "Overdue");
    const closed = Store.all("orders").filter(o => sameMonth(o.closedAt));
    const cands = Store.all("orders").filter(o => { const i = Logic.info(o); return i.stage >= 8 || Store.all("payments").some(p => p.order === o.id); });
    const tools = Pick("pay", cands.map(o => [o.id, `${o.id} · ${o.buyer}`]), (cands.find(o => !Logic.info(o).closed) || {}).id);
    const o = Store.get("orders", UI.pick.pay), inf = o && Logic.info(o);
    const left = o ? Logic.docCount(o, 9) : null;
    const rows = [...all].sort((a, b) => String(a.p.due).localeCompare(String(b.p.due))).map(x => ({
      cells: [x.p.order, x.o ? x.o.buyer : "–", x.p.invoice, money(x.p.amount), fmtD(x.p.due), money(x.p.paid), st(x.s)],
      act: { act: "edit", col: "payments", id: x.p.id }
    }));

    return KP([
      ["Outstanding", money(sum(open, x => x.bal)), `${open.length} invoices`, open.length ? "wn" : "ok"],
      ["Overdue payments", money(sum(over, x => x.bal)), `${over.length} invoices`, over.length ? "bd" : "ok"],
      ["Orders closed this month", closed.length, "All files complete"]
    ]) + `<div class="g2">${TB("Payment tracking", ["Order", "Buyer", "Invoice", "Amount", "Due date", "Paid", "Status"], rows)}${
      o ? CK(`Order closing file, ${o.id}`, docItems(o, 9), {
        tools, foot: `<p class="mute note">${inf.closed ? `Order closed on ${fmtD(o.closedAt)}. All ${inf.total} files are complete.` : `${inf.total - inf.done} files still open across the whole order. ${left.total - left.done} of them are in this closing stage.`}</p><div class="card-foot"><button class="btn sm g" data-act="open" data-href="#order/${esc(o.id)}">Open order file</button></div>`
      }) : CK("Order closing file", [], { empty: "No orders at the closing stage yet." })
    }</div>`;
  }
});
