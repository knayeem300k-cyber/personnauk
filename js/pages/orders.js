/* Stage 4: Orders and PO – confirmed orders, price, payment terms and PO review */

const PAY_TERMS = ["L/C", "TT advance", "TT 30 days", "TT 45 days", "TT 60 days"];

Schemas.orders = {
  name: "Order", label: r => r.id,
  fields: r => [
    { k: "id", l: "PO number", req: 1, ro: !!r }, buyerField(r),
    { k: "style", l: "Style code", req: 1 }, { k: "product", l: "Product" },
    { k: "qty", l: "Quantity (pcs)", t: "number", req: 1 }, { k: "price", l: "Unit price, FOB ($)", t: "number", req: 1 },
    { k: "delivery", l: "PO delivery date", t: "date", req: 1 }, { k: "contractDelivery", l: "Contract delivery date", t: "date" },
    { k: "contractPrice", l: "Contract price ($)", t: "number" }, { k: "payment", l: "Payment term", t: "select", o: PAY_TERMS },
    { k: "lc", l: "L/C status", t: "select", o: ["Not needed", "Pending", "Received"] },
    { k: "notes", l: "Notes", t: "textarea", full: 1 }
  ],
  validate: (v, r) => !r && Store.get("orders", v.id) ? "This PO number already exists." : !(v.qty > 0) ? "Quantity must be more than 0." : "",
  make: v => ({ ...v, style: v.style.toUpperCase(), docs: newDocs(), created: iso(TODAY) }),
  after: (r, isNew) => { if (isNew) location.hash = "#order/" + encodeURIComponent(r.id); },
  /* Deleting an order also deletes its samples, bookings, inspections, shipments and payments */
  removed: r => {
    ["samples", "bookings", "lines", "inspections", "shipments", "payments"].forEach(c => { Store.d[c] = Store.d[c].filter(x => x.order !== r.id); });
    if (location.hash.startsWith("#order/")) location.hash = "#orders";
  }
};

Pages.add({
  id: "orders", title: "Orders and PO", sub: "Confirmed orders, price and payment terms",
  onNew: () => Crud.create("orders"),
  render() {
    const all = Store.all("orders"), act = Logic.active(), rv = act.map(o => [o, Logic.review(o)]);
    const tools = Pick("ord", act.map(o => [o.id, `${o.id} · ${o.buyer}`]));
    const sel = Store.get("orders", UI.pick.ord), r = sel && Logic.review(sel);
    const rows = [...all].sort((a, b) => Logic.info(a).closed - Logic.info(b).closed || String(a.delivery).localeCompare(String(b.delivery))).map(o => {
      const closed = Logic.info(o).closed;
      return { cells: [o.id, o.buyer, o.style, num(o.qty), money(o.qty * o.price), fmtD(o.delivery), o.payment, st(closed ? "Closed" : Logic.review(o).chip)], act: { act: "open", href: "#order/" + o.id } };
    });
    const issues = rv.filter(x => !x[1].ok).length, conflicts = rv.filter(x => x[1].date).length, lcp = act.filter(o => o.lc === "Pending").length;

    return KP([
      ["Open POs", act.length, "Value " + money(sum(act, o => o.qty * o.price))],
      ["Under review", issues, `${conflicts} with a date conflict`, conflicts ? "bd" : issues ? "wn" : "ok"],
      ["L/C pending", lcp, lcp ? "Follow up with the buyer" : "All received", lcp ? "wn" : "ok"]
    ]) + `<div class="g2">${TB("Purchase orders", ["PO", "Buyer", "Style", "Qty", "Value", "Delivery", "Payment", "Review"], rows, { tools: '<small class="mute">Click a row to open the order file</small>' })}${
      sel ? CK("PO review checks", r.checks, {
        tools, foot: `<div class="card-foot"><button class="btn sm" data-act="open" data-href="#order/${esc(sel.id)}">Open order file</button><button class="btn sm g" data-act="edit" data-col="orders" data-id="${esc(sel.id)}">Edit PO</button>${r.ok ? "" : `<button class="btn sm g" data-act="aiEmail" data-id="${esc(sel.id)}">Draft email to buyer</button>`}</div>`
      }) : CK("PO review checks", [], { empty: "No open orders." })
    }</div>`;
  }
});
