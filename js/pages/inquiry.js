/* Stage 1: Inquiry – buyer requirement, target price and factory capability */

const INQ_ST = ["New", "Costing", "Quoted", "Capacity check", "Won", "Lost"];

Schemas.inquiries = {
  name: "Inquiry", label: r => r.id,
  fields: r => [
    buyerField(r), { k: "style", l: "Style / product", req: 1 },
    { k: "qty", l: "Quantity (pcs)", t: "number", req: 1 }, { k: "target", l: "Target price ($)", t: "number" },
    { k: "received", l: "Received on", t: "date", d: iso(TODAY) }, { k: "status", l: "Status", t: "select", o: INQ_ST },
    { k: "notes", l: "Notes", t: "textarea", full: 1 }
  ],
  make: v => ({ ...v, id: nextId("inquiries", "INQ-", 300), ck: INQ_CK.map((_, j) => j === 2 && v.target && v.qty ? "ok" : "no") }),
  extra: r => r.status === "Won" ? [] : [{ label: "Convert to order", run: () => convertInquiry(r.id) }]
};

/* Turn a won inquiry into a purchase order, carrying its checklist into the order file */
function convertInquiry(id) {
  const r = Store.get("inquiries", id);
  if (!r) return;
  Crud.create("orders", { buyer: r.buyer, product: r.style, qty: r.qty, price: r.target, contractPrice: r.target }, o => {
    r.status = "Won"; o.inquiry = r.id; o.docs[0] = r.ck.slice();
  });
}
Actions.convert = el => convertInquiry(el.dataset.id);
Actions.ick = el => {
  const r = Store.get("inquiries", el.dataset.id), j = +el.dataset.i;
  r.ck[j] = NEXT[r.ck[j]]; Store.save(); App.render();
};

Pages.add({
  id: "inquiry", title: "Inquiry", sub: "Buyer requirement, target price and factory capability",
  onNew: () => Crud.create("inquiries"),
  render() {
    const all = Store.all("inquiries"), open = all.filter(i => !["Won", "Lost"].includes(i.status));
    const won = all.filter(i => i.status === "Won").length, lost = all.filter(i => i.status === "Lost").length;
    const noTp = open.filter(i => i.ck[0] !== "ok").length;
    const tools = Pick("inq", open.map(i => [i.id, `${i.id} · ${i.buyer}`]));
    const sel = Store.get("inquiries", UI.pick.inq);
    const rows = [...all].sort((a, b) => String(b.received).localeCompare(String(a.received)))
      .map(i => ({ cells: [i.id, i.buyer, i.style, num(i.qty), i.target ? price(i.target) : "–", fmtD(i.received), st(i.status)], act: { act: "edit", col: "inquiries", id: i.id } }));

    return KP([
      ["New inquiries", all.filter(i => i.status === "New").length, `${all.filter(i => daysFrom(i.received) >= -7).length} received this week`],
      ["Quoted", all.filter(i => i.status === "Quoted").length, `${pct(won, won + lost)}% win rate`],
      ["Waiting for tech pack", noTp, noTp ? "Follow up with the buyer" : "All received", noTp ? "wn" : "ok"]
    ]) + `<div class="g2">${TB("Inquiries", ["Inquiry", "Buyer", "Style", "Qty", "Target price", "Received", "Status"], rows)}${
      sel ? CK("Requirement checklist", INQ_CK.map((l, j) => ({ label: l, note: LABEL[sel.ck[j]], s: sel.ck[j], act: { act: "ick", id: sel.id, i: j } })),
        { tools, foot: `<div class="card-foot"><button class="btn sm" data-act="convert" data-id="${esc(sel.id)}">Convert to order</button></div>` })
        : CK("Requirement checklist", [], { empty: "No open inquiries." })
    }</div>`;
  }
});
