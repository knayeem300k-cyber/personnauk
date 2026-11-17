/* Stage 5: Pre-production – material booking, approvals and planning */

const BOOK_TYPES = ["Fabric", "Trims", "Lab dip", "Strike-off", "Embroidery", "Print", "Wash", "Test", "Other"];
const BOOK_ST = ["Pending", "Booked", "Awaiting", "Review", "Approved", "In house", "Failed"];

Schemas.bookings = {
  name: "Booking", label: r => r.item,
  fields: () => [
    { k: "order", l: "Order (PO)", t: "select", o: orderOpts(), req: 1 }, { k: "type", l: "Type", t: "select", o: BOOK_TYPES },
    { k: "item", l: "Item", req: 1 }, { k: "supplier", l: "Supplier" },
    { k: "date", l: "Booked on", t: "date", d: iso(TODAY) }, { k: "due", l: "In-house / approval due", t: "date" },
    { k: "status", l: "Status", t: "select", o: BOOK_ST }, { k: "notes", l: "Notes", t: "textarea", full: 1 }
  ]
};

Pages.add({
  id: "preprod", title: "Pre-production", sub: "Booking, approvals and planning",
  onNew: () => Crud.create("bookings", { order: UI.pick.pp }),
  render() {
    const act = Logic.active(), ids = new Set(act.map(o => o.id));
    const bk = Store.all("bookings").filter(b => ids.has(b.order));
    const planning = act.filter(o => Logic.info(o).stage === 4);
    const late = bk.filter(b => daysFrom(b.due) < 0 && !["In house", "Approved"].includes(b.status));
    const pending = bk.filter(b => ["Awaiting", "Review"].includes(b.status));
    const failed = bk.filter(b => b.status === "Failed");
    const tools = Pick("pp", act.map(o => [o.id, `${o.id} · ${o.buyer}`]), planning[0] && planning[0].id);
    const o = Store.get("orders", UI.pick.pp);
    const mine = o ? Store.all("bookings").filter(b => b.order === o.id) : [];

    return KP([
      ["Orders in planning", planning.length, `${late.length} bookings late`, late.length ? "wn" : "ok"],
      ["Approvals pending", pending.length, `Lab dip ${pending.filter(b => b.type === "Lab dip").length}`, pending.length ? "wn" : "ok"],
      ["Failed items", failed.length, failed.length ? "Need re-test or rebooking" : "None", failed.length ? "bd" : "ok"]
    ]) + `<div class="g2">${
      TB(o ? `Booking and approvals for ${o.id}` : "Booking and approvals", ["Item", "Type", "Supplier", "Booked", "Due", "Status"],
        mine.map(b => ({ cells: [b.item, b.type, b.supplier, fmtD(b.date), fmtD(b.due), st(daysFrom(b.due) < 0 && !["In house", "Approved", "Failed"].includes(b.status) ? "Overdue" : b.status)], act: { act: "edit", col: "bookings", id: b.id } })),
        { tools, empty: "No bookings for this order yet. Click New to add one." })
    }${
      o ? CK("Pre-production files", docItems(o, 4), { foot: `<div class="card-foot"><button class="btn sm g" data-act="open" data-href="#order/${esc(o.id)}">Open order file and TNA</button></div>` })
        : CK("Pre-production files", [], { empty: "No open orders." })
    }</div>`;
  }
});
