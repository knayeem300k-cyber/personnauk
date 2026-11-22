/* Merchandiser Management – who looks after which orders, their workload, open tasks and the work they have done */

Schemas.team = {
  name: "Team member", label: r => r.name,
  fields: () => [
    { k: "name", l: "Name", req: 1 }, { k: "role", l: "Role", t: "select", o: TEAM_ROLES, d: "Merchandiser" },
    { k: "email", l: "Email", t: "email" }, { k: "phone", l: "Phone", t: "tel" },
    { k: "status", l: "Status", t: "select", o: ["Active", "Inactive"] },
    { k: "notes", l: "Notes", t: "textarea", full: 1 }
  ],
  validate: (v, r) => {
    if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) return "Please enter a valid email address.";
    return Store.all("team").some(m => m !== r && m.name.toLowerCase() === v.name.toLowerCase()) ? "A team member with this name already exists." : "";
  }
};

/* Everything about one merchandiser's work */
function merchStats(m) {
  const orders = Store.all("orders").filter(o => Team.ofOrder(o) === m.id);
  const active = orders.filter(o => !Logic.info(o).closed);
  const ids = new Set(orders.map(o => o.id));
  const styles = (Store.all("devs") || []).filter(d => d.merch === m.id);
  const lateTasks = active.flatMap(o => Logic.tna(o).filter(t => t.late).map(t => ({ o, t })));
  const todo = Logic.alerts().filter(a => ids.has(a.order));
  const work = (Store.all("activity") || []).filter(a => a.by === m.id);
  const week = work.filter(a => Date.now() - new Date(a.at).getTime() < 7 * 864e5);
  return {
    orders, active, styles, devOpen: styles.filter(devOpen), lateTasks, todo, work, week,
    buyers: Store.all("buyers").filter(b => b.merch === m.id).map(b => b.name),
    qty: sum(active, o => o.qty), value: sum(active, o => o.qty * o.price), margin: Logic.marginOf(orders)
  };
}

function merchView(id) {
  const m = Team.get(id);
  if (!m) return;
  const s = merchStats(m);
  const kv = rows => `<div class="res bp">${rows.map(([k, v]) => `<span>${esc(k)}</span><b>${esc(v || "–")}</b>`).join("")}</div>`;
  const orderRows = s.orders.sort((a, b) => Logic.info(a).closed - Logic.info(b).closed || String(a.delivery).localeCompare(String(b.delivery))).map(o => {
    const i = Logic.info(o), late = Logic.tna(o).filter(t => t.late).length;
    return { cells: [o.id, o.buyer, o.style, i.closed ? chip("Closed", "ok") : `${i.stage + 1}. ${STAGES[i.stage].name}`, i.pct + "%", fmtD(o.delivery), late ? chip(`${late} late`, "b") : chip("On time", "ok")], act: { act: "openOrder", id: o.id } };
  });
  View.open({
    title: m.name,
    head: `<div class="vh">${avatar(m, "lg")}<div><h2>${esc(m.name)}</h2><p class="mute">${esc(m.role || "Merchandiser")} <span class="chip c-${TONES[m.status || "Active"]}">${esc(m.status || "Active")}</span></p></div></div>`,
    body: `<div class="vone">
      <h3 class="sub3">1. Contact</h3>${kv([["Email", m.email], ["Phone", m.phone], ["Buyers", s.buyers.join(", ")]])}
      <h3 class="sub3">2. Workload</h3>${kv([["Active orders", `${s.active.length} of ${s.orders.length}`], ["Quantity in hand", num(s.qty) + " pcs"], ["Order value in hand", money(s.value)], ["Profit margin", s.margin.pct === null ? "No costing yet" : s.margin.pct.toFixed(1) + "%"], ["Styles in development", `${s.devOpen.length}`], ["Overdue T&A tasks", `${s.lateTasks.length}`]])}
      <h3 class="sub3">3. Orders <span class="chip c-p">${s.orders.length}</span></h3>
      <div class="tw"><table><thead><tr>${["PO", "Buyer", "Style", "Stage", "Files", "Delivery", "T&A"].map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${orderRows.length ? orderRows.map(r => `<tr class="rw" tabindex="0"${attrs(r.act)}>${r.cells.map(c => `<td>${cell(c)}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="7" class="empty">No orders yet.</td></tr>`}</tbody></table></div>
      <h3 class="sub3">4. To do <span class="chip c-${s.todo.length ? "w" : "ok"}">${s.todo.length}</span></h3>
      ${CK("", s.todo.slice(0, 12).map(a => ({ label: `${a.order}: ${a.text}`, note: a.stage, s: a.sev === 2 ? "no" : "wt", act: { act: "openOrder", id: a.order } })), { bare: true, empty: "Nothing pending. Well done." })}
      ${s.devOpen.length ? `<h3 class="sub3">5. Styles in development</h3>${CK("", s.devOpen.map(d => ({ label: `${d.id} · ${d.product}`, note: d.status + (d.due ? `, due ${fmtD(d.due)}` : ""), s: devLate(d) ? "no" : "wt", act: { act: "devViewFromTeam", id: d.id } })), { bare: true })}` : ""}
      <h3 class="sub3">${s.devOpen.length ? 6 : 5}. Recent work <span class="chip c-p">${s.week.length} this week</span></h3>
      ${s.work.length ? `<div class="fl">${s.work.slice(0, 12).map(a => `<div class="f"><i class="ok">✓</i><b>${esc(a.text)}${a.order ? ` <small class="mute">· ${esc(a.order)}</small>` : ""}</b><small>${esc(ago(a.at))}</small></div>`).join("")}</div>` : `<p class="empty">No work recorded yet. Work on this person's orders and styles shows up here.</p>`}
    </div>`,
    buttons: [
      { l: "Close", a: { act: "formClose" }, g: 1 },
      { l: "Edit", a: { act: "merchEdit", id: m.id } }
    ]
  });
}
Actions.merchView = el => merchView(el.dataset.id);
Actions.merchEdit = el => { const id = el.dataset.id; Crud.edit("team", id, () => merchView(id)); };
Actions.openOrder = el => { Form.close(); location.hash = "#order/" + el.dataset.id; };
Actions.devViewFromTeam = el => { Form.close(); devView(el.dataset.id); };

Pages.add({
  id: "team", title: "Merchandiser Management", sub: "Who looks after which orders, their workload and the work they have done",
  newLabel: "+ Add merchandiser", filter: false,
  onNew: () => Crud.create("team", { status: "Active" }),
  export() {
    const rows = Team.all().map(m => { const s = merchStats(m); return [m.name, m.role, m.status || "Active", s.buyers.join(", "), s.active.length, s.orders.length, s.qty, +s.value.toFixed(2), s.margin.pct === null ? "" : +s.margin.pct.toFixed(1), s.devOpen.length, s.lateTasks.length, s.todo.length, s.week.length]; });
    return { file: "merchandiser-workload", title: "Merchandiser workload", sheets: [{ name: "Team", rows, cols: [
      { h: "Merchandiser", w: 20 }, { h: "Role", w: 20 }, { h: "Status", w: 9 }, { h: "Buyers", w: 30 }, { h: "Active orders", w: 12, f: "int" }, { h: "All orders", w: 10, f: "int" },
      { h: "Qty in hand", w: 12, f: "int" }, { h: "Value in hand ($)", w: 15, f: "money" }, { h: "Profit margin", w: 12, f: "pct" }, { h: "Styles in development", w: 12, f: "int" },
      { h: "Overdue T&A", w: 11, f: "int" }, { h: "To do", w: 8, f: "int" }, { h: "Work this week", w: 12, f: "int" }] }] };
  },
  render() {
    const team = Team.all(), stats = team.map(m => ({ m, s: merchStats(m) }));
    const act = Logic.active(), unassigned = act.filter(o => !Team.ofOrder(o));
    const lateAll = sum(stats, x => x.s.lateTasks.length);
    const work = (Store.all("activity") || []).slice(0, 15);
    const weekAll = (Store.all("activity") || []).filter(a => Date.now() - new Date(a.at).getTime() < 7 * 864e5).length;
    const maxLoad = Math.max(1, ...stats.map(x => x.s.active.length));

    return KP([
      ["Merchandisers", Team.active().length, `${team.length - Team.active().length} inactive`],
      ["Orders in hand", act.length - unassigned.length, unassigned.length ? `${unassigned.length} not assigned` : "All orders assigned", unassigned.length ? "wn" : "ok"],
      ["Overdue tasks", lateAll, lateAll ? "Across the team" : "Everyone on schedule", lateAll ? "bd" : "ok"],
      ["Work done this week", weekAll, "Recorded actions"]
    ]) + TB("Team workload", ["Merchandiser", "Role", "Buyers", "Active orders", "Value in hand", "Styles in dev.", "Overdue", "To do", "This week", "Workload"],
      stats.map(({ m, s }) => ({
        cells: [{ html: `<span class="bn">${avatar(m)}${esc(m.name)}</span>` }, m.role || "–",
          s.buyers.join(", ") || "–", s.active.length, money(s.value), s.devOpen.length,
          s.lateTasks.length ? chip(String(s.lateTasks.length), "b") : chip("0", "ok"), s.todo.length, s.week.length,
          { html: `<span class="mbar" title="${s.active.length} active orders"><i style="width:${pct(s.active.length, maxLoad)}%"></i></span>` }],
        act: { act: "merchView", id: m.id }
      })),
      { empty: "No team members yet. Click + Add merchandiser.", tools: '<small class="mute">Click a merchandiser to see their orders and work</small>' })
      + `<div class="g2 even">${
        Card("Recent work", work.length ? `<div class="fl">${work.map(a => { const m = Team.get(a.by); return `<div class="f">${avatar(m)}<b>${esc(a.text)}<small class="blk mute">${esc(m ? m.name : "Team")}${a.order ? " · " + esc(a.order) : ""}</small></b><small>${esc(ago(a.at))}</small></div>`; }).join("")}</div>` : `<p class="empty">No work recorded yet.</p>`)
      }${
        CK("Orders without a merchandiser", unassigned.map(o => ({ label: `${o.id} · ${o.buyer}`, note: `${o.style}, delivery ${fmtD(o.delivery)}`, s: "wt", act: { act: "edit", col: "orders", id: o.id } })),
          { empty: "Every open order has a merchandiser.", foot: unassigned.length ? `<p class="note mute">Click an order to choose its merchandiser, or set a merchandiser on the buyer.</p>` : "" })
      }</div>`;
  }
});
