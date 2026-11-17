/* Order file: one page per order with all 10 stages, every file, the T&A calendar and linked records */

Pages.add({
  id: "order", nav: false, navId: "orders", filter: false,
  title: p => "Order " + p,
  sub: p => { const o = Store.get("orders", p); return o ? `${o.buyer} · ${o.style} ${o.product || ""} · ${num(o.qty)} pcs · ${money(o.qty * o.price)}` : "Order not found"; },
  buttons: p => `<a class="btn g" href="#orders">Back to orders</a>${Store.get("orders", p) ? `<button class="btn" data-act="edit" data-col="orders" data-id="${esc(p)}">Edit order</button>` : ""}`,
  render(p) {
    const o = Store.get("orders", p);
    if (!o) return Card("Not found", `<p class="mute">This order does not exist. It may have been deleted.</p>`);
    const inf = Logic.info(o), tna = Logic.tna(o), late = tna.filter(x => x.late), dl = daysFrom(o.delivery);
    const linked = [
      ...Store.all("samples").filter(x => x.order === o.id).map(x => ({ cells: ["Sample", `${x.type} sample`, fmtD(x.sent), st(Logic.sampleStatus(x))], act: { act: "edit", col: "samples", id: x.id } })),
      ...Store.all("bookings").filter(x => x.order === o.id).map(x => ({ cells: ["Booking", x.item, fmtD(x.date), st(x.status)], act: { act: "edit", col: "bookings", id: x.id } })),
      ...Store.all("inspections").filter(x => x.order === o.id).map(x => ({ cells: ["Inspection", `${x.type}, ${x.inspector}`, fmtD(x.date), st(Logic.inspResult(x))], act: { act: "edit", col: "inspections", id: x.id } })),
      ...Store.all("shipments").filter(x => x.order === o.id).map(x => ({ cells: ["Shipment", `${x.mode}, ${x.forwarder || "forwarder not set"}`, fmtD(x.shipDate), chip("Booked", "p")], act: { act: "edit", col: "shipments", id: x.id } })),
      ...Store.all("payments").filter(x => x.order === o.id).map(x => ({ cells: ["Payment", `${x.invoice}, ${money(x.amount)}`, fmtD(x.due), st(Logic.payStatus(x))], act: { act: "edit", col: "payments", id: x.id } }))
    ];
    const keyS = refs => { const v = refs.map(([s, j]) => o.docs[s][j]); return v.every(isDone) ? "ok" : v.some(x => x !== "no") ? "wt" : "no"; };

    return KP([
      ["Current stage", inf.closed ? "Closed" : `${inf.stage + 1}. ${STAGES[inf.stage].name}`, inf.behind ? `${inf.behind} files still open in earlier stages` : "Earlier stages complete", inf.behind ? "wn" : "ok"],
      ["Files complete", inf.pct + "%", `${inf.done} of ${inf.total} files`],
      ["Delivery", fmtD(o.delivery), isNaN(dl) ? "No date" : dl < 0 ? `${-dl} days ago` : `${dl} days left`, dl < 14 && !inf.closed ? "wn" : "ok"],
      ["Overdue TNA tasks", late.length, late[0] ? late[0].name : "On schedule", late.length ? "bd" : "ok"]
    ]) + `<p class="mute note">Click any file to change it: missing → in progress → done → not needed. Files also tick themselves when you enter samples, bookings, inspections, shipments and payments.</p>
    <div class="stg">${STAGES.map((s, i) => {
      const c = inf.per[i];
      return `<section class="card${i === inf.stage && !inf.closed ? " cur" : ""}"><div class="hd"><h2>${i + 1}. ${esc(s.name)}</h2><span class="chip c-${c.done === c.total ? "ok" : c.started ? "w" : "p"}">${c.done}/${c.total}</span></div><div class="bar"><i style="width:${pct(c.done, c.total)}%"></i></div>${CK("", docItems(o, i), { bare: true })}</section>`;
    }).join("")}</div>
    <div class="g2">${
      TB("T&A calendar", ["Task", "Planned", "When", "Status"], tna.map(t => [t.name, fmtD(t.date), t.done ? "–" : relDays(t.days), t.done ? chip("Done", "ok") : t.late ? chip("Late", "b") : t.days <= 7 ? chip("Due soon", "w") : chip("Planned", "p")]), { empty: "Add a delivery date to build the T&A calendar." })
    }${
      CK("8 key files", KEY_FILES.map(([l, refs]) => ({ label: l, note: LABEL[keyS(refs)], s: keyS(refs) })))
    }</div>${TB("Linked records", ["Type", "Detail", "Date", "Status"], linked, { empty: "No samples, bookings, inspections, shipments or payments yet." })}`;
  }
});
