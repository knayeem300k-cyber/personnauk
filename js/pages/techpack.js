/* Tech pack library – every style's details in one place */

Schemas.styles = {
  name: "Tech pack", label: r => r.id,
  fields: r => [
    { k: "id", l: "Style code", req: 1, ro: !!r }, { k: "name", l: "Style name", req: 1 },
    buyerField(r), { k: "version", l: "Version", d: "v1" },
    { k: "status", l: "Status", t: "select", o: ["Draft", "Review", "Final"] },
    ...SECTIONS.map(([k, l]) => ({ k: "s_" + k, l }))
  ],
  validate: (v, r) => !r && Store.get("styles", v.id.toUpperCase()) ? "This style code already exists." : "",
  make: v => ({ ...v, id: v.id.toUpperCase() }),
  after: r => { r.updated = iso(TODAY); }
};

Pages.add({
  id: "techpack", title: "Tech Pack", sub: "Style details in one place",
  onNew: () => Crud.create("styles"),
  render() {
    const all = Store.all("styles");
    const missing = all.map(s => SECTIONS.length - Logic.secDone(s)), affected = missing.filter(m => m > 0).length;
    const review = all.filter(s => s.status === "Review");
    const oldest = review.length ? Math.max(...review.map(s => -daysFrom(s.updated) || 0)) : 0;
    const tools = Pick("tp", all.map(s => [s.id, `${s.id} ${s.name}`]));
    const sel = Store.get("styles", UI.pick.tp);

    return KP([
      ["Tech packs", all.length, `${all.filter(s => daysFrom(s.updated) >= -7).length} updated this week`],
      ["Missing sections", sum(missing, m => m), `${affected} styles affected`, affected ? "bd" : "ok"],
      ["Awaiting buyer revision", review.length, review.length ? `Oldest ${oldest} days` : "None", review.length ? "wn" : "ok"]
    ]) + `<div class="g2">${
      TB("Style library", ["Style", "Buyer", "Version", "Sections ready", "Updated", "Status"],
        all.map(s => ({ cells: [`${s.id} ${s.name}`, s.buyer, s.version, `${Logic.secDone(s)} of ${SECTIONS.length}`, fmtD(s.updated), st(s.status)], act: { act: "edit", col: "styles", id: s.id } })))
    }${
      sel ? CK(`Sections in ${sel.id}`, SECTIONS.map(([k, l]) => ({ label: l, note: sel["s_" + k] || "Missing", s: sel["s_" + k] ? "ok" : "no", act: { act: "edit", col: "styles", id: sel.id } })), { tools })
        : CK("Sections", [], { empty: "No tech packs yet." })
    }</div>`;
  }
});
