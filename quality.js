/* Stage 8: Quality – inspections with automatic AQL pass/fail and corrective actions (CAP) */

const INSPECTORS = ["Internal", "SGS", "Bureau Veritas", "Intertek", "QIMA", "Buyer QA"];
UI.aql = { lot: 12000, lvl: "2.5" };

Schemas.inspections = {
  name: "Inspection", label: r => `${r.order} ${r.type}`,
  fields: () => [
    { k: "order", l: "Order (PO)", t: "select", o: orderOpts(), req: 1 }, { k: "type", l: "Type", t: "select", o: ["In-line", "Pre-final", "Final"] },
    { k: "inspector", l: "Inspector", t: "select", o: INSPECTORS }, { k: "date", l: "Date", t: "date", d: iso(TODAY), req: 1 },
    { k: "aql", l: "AQL level", t: "select", o: [["2.5", "2.5 (major)"], ["4.0", "4.0 (minor)"]] }, { k: "lot", l: "Lot size (blank = order qty)", t: "number" },
    { k: "defects", l: "Defects found (blank if not done yet)", t: "number" }, { k: "capDue", l: "CAP due date", t: "date" },
    { k: "capStatus", l: "CAP status", t: "select", o: [["", "Not needed"], "Open", "Done"] }
  ],
  after: r => {
    if (Logic.inspResult(r) === "Failed" && !r.capStatus) { r.capStatus = "Open"; if (!r.capDue) r.capDue = addDays(iso(TODAY), 3); }
  }
};
Actions.cap = el => {
  const i = Store.get("inspections", el.dataset.id);
  i.capStatus = i.capStatus === "Done" ? "Open" : "Done";
  Logic.sync(); App.render(); toast(i.capStatus === "Done" ? "CAP marked done" : "CAP reopened");
};
function aqlRes() {
  const a = Logic.aql(UI.aql.lot, UI.aql.lvl);
  return a ? `<span>Sample size</span><b>${a.n} pcs</b><span>Accept if defects ≤</span><b>${a.ac}</b><span>Reject if defects ≥</span><b>${a.re}</b>` : `<span>Enter a lot size</span><b>–</b>`;
}
Actions.aqlc = el => { UI.aql[el.dataset.k] = el.value; const r = document.getElementById("aqlRes"); if (r) r.innerHTML = aqlRes(); };

Pages.add({
  id: "quality", title: "Quality", sub: "Inspection and corrective action",
  onNew: () => Crud.create("inspections"),
  render() {
    const all = Store.all("inspections").map(i => ({ i, r: Logic.inspResult(i), a: Logic.aql(Logic.inspLot(i), i.aql) }));
    const month = all.filter(x => sameMonth(x.i.date) && x.r !== "Scheduled");
    const decided = all.filter(x => x.r !== "Scheduled"), passed = decided.filter(x => x.r === "Passed");
    const failed = all.filter(x => x.r === "Failed"), capOpen = failed.filter(x => x.i.capStatus !== "Done");
    const rows = [...all].sort((a, b) => String(b.i.date).localeCompare(String(a.i.date))).map(({ i, r, a }) => ({
      cells: [i.order, i.type, fmtD(i.date), i.inspector, a ? `${a.n} / ${a.ac}` : "–", i.defects === "" || i.defects == null ? "–" : i.defects, st(r)],
      act: { act: "edit", col: "inspections", id: i.id }
    }));

    return KP([
      ["Inspections this month", month.length, `${month.filter(x => x.r === "Passed").length} passed`],
      ["Failed", failed.length, `${capOpen.length} CAPs open`, capOpen.length ? "bd" : "ok"],
      ["Pass rate", pct(passed.length, decided.length) + "%", `${decided.length} inspections done`, pct(passed.length, decided.length) >= 90 ? "ok" : "wn"]
    ]) + `<div class="g2">${TB("Inspections", ["Order", "Type", "Date", "Inspector", "Sample / accept", "Defects", "Result"], rows)}<div class="stack">${
      CK("Corrective actions (CAP)", failed.map(({ i }) => ({ label: `CAP for ${i.order}, ${i.type.toLowerCase()}`, note: i.capStatus === "Done" ? "Done" : `Due ${fmtD(i.capDue)}`, s: i.capStatus === "Done" ? "ok" : daysFrom(i.capDue) < 0 ? "no" : "wt", act: { act: "cap", id: i.id } })), { empty: "No failed inspections." })
    }${
      Card("AQL calculator", `<div class="calc"><label>Lot size (pcs)<input type="number" min="0" data-act="aqlc" data-k="lot" value="${esc(UI.aql.lot)}"></label><label>AQL level<select data-act="aqlc" data-k="lvl"><option value="2.5"${UI.aql.lvl === "2.5" ? " selected" : ""}>2.5 (major)</option><option value="4.0"${UI.aql.lvl === "4.0" ? " selected" : ""}>4.0 (minor)</option></select></label></div><div class="res" id="aqlRes">${aqlRes()}</div><p class="mute note">General inspection level II, single sampling, normal inspection.</p>`)
    }</div></div>`;
  }
});
