/* Dashboard: a simple overview of buyers, their business and profit margin */

const MARGIN_TARGET = 8; // % profit margin the business aims for
const marginTone = p => p === null ? "p" : p < 0 ? "bd" : p < MARGIN_TARGET ? "wn" : "ok";
const marginCell = m => m.pct === null ? { html: '<span class="mute">No costing</span>' }
  : { html: `<span class="mg ${marginTone(m.pct)}"><b>${m.pct.toFixed(1)}%</b><span class="mbar"><i style="width:${Math.max(0, Math.min(100, m.pct / 15 * 100))}%"></i></span></span>` };

Pages.add({
  id: "dashboard", title: "Dashboard", sub: "Buyer relationships and business performance at a glance",
  newLabel: "+ Add Buyer",
  onNew: () => Crud.create("buyers", { status: "Active", currency: "USD", incoterm: "FOB", contacts: [{}] }),
  render() {
    const buyers = Store.all("buyers"), orders = Store.all("orders");
    const active = buyers.filter(b => (b.status || "Active") === "Active");
    const value = o => (+o.qty || 0) * (+o.price || 0);
    const total = Logic.marginOf(orders);
    const rows = buyers.map(b => {
      const os = orders.filter(o => o.buyer === b.name);
      return { b, n: os.length, v: sum(os, value), m: Logic.marginOf(os) };
    }).sort((a, b) => b.v - a.v || a.b.name.localeCompare(b.b.name));

    return KP([
      ["Total buyers", buyers.length, "Buyer master database"],
      ["Active buyers", active.length, "Currently engaged"],
      ["Order value", money(sum(orders, value)), `${orders.length} orders in total`],
      ["Profit margin", total.pct === null ? "–" : total.pct.toFixed(1) + "%",
        total.pct === null ? "Add costing sheets to see margin" : `${money(total.profit)} profit · ${total.known} of ${orders.length} orders costed`, marginTone(total.pct) === "p" ? "wn" : marginTone(total.pct)]
    ]) + TB("Buyer portfolio", ["Buyer", "Country", "Status", "Orders", "Order value", "Profit", "Profit margin"],
      rows.map(({ b, n, v, m }) => ({
        cells: [{ html: `<span class="bn">${buyerLogo(b)}${esc(b.name)}</span>` }, b.country || "–", st(b.status || "Active"), n, money(v),
          m.pct === null ? "–" : money(m.profit), marginCell(m)],
        act: { act: "buyerView", id: b.id }
      })),
      { empty: "No buyers yet. Click + Add Buyer to register one.", tools: `<small class="mute">Target margin ${MARGIN_TARGET}% · click a buyer to see details</small>` })
      + `<p class="note mute">Profit margin uses each order's style costing sheet: (order price − cost per piece) × quantity. Orders without a costing sheet are left out.</p>`;
  }
});
