/* Costing and BOM – FOB build-up, margin, bill of materials and fabric consumption */

UI.calc = { bl: 72, sl: 22, hc: 54, al: 4, gsm: 180, ws: 8, pk: 5.2 };

/* BOM line: cost per piece = consumption × price per unit × (1 + wastage %) */
const bomLines = c => (Array.isArray(c.bom) ? c.bom : []).filter(l => l && (l.item || l.cons || l.rate));
const rate = v => { v = +v || 0; return v && v < 0.01 ? "$" + v.toFixed(4) : price(v); };
const bomAmt = l => (+l.cons || 0) * (+l.rate || 0) * (1 + (+l.waste || 0) / 100);
const bomIsFabric = l => /fab|yarn|knit|denim|twill|jersey|fleece/i.test(`${l.type} ${l.item}`);
const bomTotals = c => {
  const ls = bomLines(c), fabric = sum(ls.filter(bomIsFabric), bomAmt), all = sum(ls, bomAmt);
  return { lines: ls.length, fabric, trims: all - fabric, total: all };
};

Schemas.costings = {
  name: "Costing sheet", label: r => r.style,
  fields: r => [
    { k: "style", l: "Style code", req: 1 }, buyerField(r, "Buyer", 0),
    { k: "fabric", l: "Fabric ($ per piece, from BOM when it has lines)", t: "number" }, { k: "trims", l: "Trims ($ per piece, from BOM when it has lines)", t: "number", d: 0 },
    { k: "cm", l: "CM, cost of making ($)", t: "number", d: 0 }, { k: "wastage", l: "Wastage ($)", t: "number", d: 0 },
    { k: "commercial", l: "Commercial cost ($)", t: "number", d: 0 }, { k: "profit", l: "Profit ($)", t: "number", d: 0 },
    { k: "status", l: "Status", t: "select", o: ["Draft", "Awaiting approval", "Approved"] },
    { k: "bom", l: "BOM, bill of materials (per garment)", t: "list", item: "Material", add: "Add material",
      cols: [["item", "Material / item"], ["type", "Type (Fabric, Trims, Thread, Packing…)"], ["supplier", "Supplier"], ["unit", "Unit (kg, m, pcs)"],
        ["cons", "Consumption per piece", "number"], ["rate", "Price per unit ($)", "number"], ["waste", "Wastage %", "number"]] }
  ],
  validate: v => !v.bom.length && v.fabric === "" ? "Add the fabric cost, or add materials to the BOM." : "",
  make: v => ({ ...v, style: v.style.toUpperCase() })
};

/* Knit top fabric consumption: ((body + sleeve + allowance) × (half chest + allowance) × 2 × GSM × 12) / 10,000,000 */
function calcVals() {
  const c = UI.calc;
  const kg = ((+c.bl + +c.sl + +c.al) * (+c.hc + +c.al) * 2 * +c.gsm * 12) / 1e7;
  const kgw = kg * (1 + +c.ws / 100);
  return { kg, kgw, cost: kgw / 12 * +c.pk };
}
function calcRes() {
  const v = calcVals();
  return `<span>Consumption</span><b>${v.kg.toFixed(2)} kg per dozen</b><span>With wastage</span><b>${v.kgw.toFixed(2)} kg per dozen</b><span>Fabric cost per piece</span><b>${price(v.cost)}</b>`;
}
Actions.calc = el => { UI.calc[el.dataset.k] = +el.value || 0; const r = document.getElementById("calcRes"); if (r) r.innerHTML = calcRes(); };
Actions.calcApply = el => {
  const c = Store.get("costings", el.dataset.id);
  if (!c) return;
  if (bomLines(c).length) return toast(`${c.style} takes fabric cost from its BOM. Update the fabric line in the BOM instead.`);
  c.fabric = +calcVals().cost.toFixed(2);
  Logic.sync(); App.render(); toast(`Fabric cost for ${c.style} set to ${price(c.fabric)}`);
};

Pages.add({
  id: "costing", title: "Costing and BOM", sub: "Price build-up, bill of materials and fabric consumption",
  newLabel: "New costing",
  onNew: () => Crud.create("costings", { status: "Draft", bom: [{}] }),
  export() {
    const all = Store.all("costings");
    return {
      file: "costing-and-bom", title: "Costing sheets and BOM",
      sheets: [
        { name: "Costing sheets", rows: all.map(c => { const f = Logic.fob(c), t = bomTotals(c); return [c.style, c.buyer, c.status, +c.fabric || 0, +c.trims || 0, +c.cm || 0, +c.wastage || 0, +c.commercial || 0, +c.profit || 0, +f.toFixed(2), f ? +((+c.profit || 0) / f * 100).toFixed(1) : 0, t.lines, +t.total.toFixed(3)]; }),
          cols: [{ h: "Style", w: 14 }, { h: "Buyer", w: 20 }, { h: "Status", w: 16 }, { h: "Fabric ($)", w: 11, f: "money" }, { h: "Trims ($)", w: 11, f: "money" }, { h: "CM ($)", w: 10, f: "money" },
            { h: "Wastage ($)", w: 11, f: "money" }, { h: "Commercial ($)", w: 13, f: "money" }, { h: "Profit ($)", w: 11, f: "money" }, { h: "FOB ($)", w: 11, f: "money" },
            { h: "Margin", w: 9, f: "pct" }, { h: "BOM lines", w: 10, f: "int" }, { h: "BOM total ($)", w: 13, f: "money" }] },
        { name: "BOM", rows: all.flatMap(c => bomLines(c).map(l => [c.style, l.item, l.type, l.supplier, l.unit, +l.cons || 0, +l.rate || 0, +l.waste || 0, +bomAmt(l).toFixed(3)])),
          cols: [{ h: "Style", w: 14 }, { h: "Material / item", w: 28 }, { h: "Type", w: 12 }, { h: "Supplier", w: 20 }, { h: "Unit", w: 8 },
            { h: "Consumption / pc", w: 15 }, { h: "Price / unit ($)", w: 14, f: "money" }, { h: "Wastage %", w: 10 }, { h: "Cost / pc ($)", w: 13, f: "money" }] }
      ]
    };
  },
  render() {
    const all = Store.all("costings");
    const fobs = all.map(c => Logic.fob(c)), avgFob = all.length ? sum(fobs, f => f) / all.length : 0;
    const margins = all.map((c, i) => fobs[i] ? (+c.profit || 0) / fobs[i] * 100 : 0), avgM = all.length ? sum(margins, m => m) / all.length : 0;
    const waiting = all.filter(c => c.status === "Awaiting approval").length;
    const noBom = all.filter(c => !bomLines(c).length).length;
    const tools = Pick("cost", all.map(c => [c.id, c.style]));
    const sel = Store.get("costings", UI.pick.cost), fob = sel ? Logic.fob(sel) : 0;
    const parts = [["Fabric", "fabric"], ["Trims", "trims"], ["CM", "cm"], ["Wastage", "wastage"], ["Commercial", "commercial"], ["Profit", "profit"]];
    const f = (k, l) => `<label>${l}<input type="number" step="any" min="0" data-act="calc" data-k="${k}" value="${UI.calc[k]}"></label>`;
    const t = sel ? bomTotals(sel) : null;

    const bom = sel ? TB(`BOM for ${sel.style}`, ["Material / item", "Type", "Supplier", "Unit", "Consumption / pc", "Price / unit", "Wastage", "Cost / pc"],
      bomLines(sel).map(l => ({ cells: [l.item || "–", l.type || "–", l.supplier || "–", l.unit || "–", l.cons || "–", l.rate ? rate(l.rate) : "–", l.waste ? l.waste + "%" : "–", { html: `<b>${price(bomAmt(l))}</b>` }], act: { act: "edit", col: "costings", id: sel.id } })),
      { tools, empty: "No materials yet. Click Edit costing and BOM to add them." })
      .replace(/<\/section>$/, `<div class="res bomt"><span>Fabric</span><b>${price(t.fabric)}</b><span>Trims and others</span><b>${price(t.trims)}</b><span>BOM total per piece</span><b>${price(t.total)}</b></div>${t.lines ? `<p class="note mute">Fabric and trims on the costing sheet come from this BOM automatically.</p>` : ""}
        <div class="card-foot"><button class="btn sm" data-act="edit" data-col="costings" data-id="${esc(sel.id)}">Edit costing and BOM</button></div></section>`)
      : "";

    return KP([
      ["Costing sheets", all.length, `${waiting} awaiting approval`, waiting ? "wn" : "ok"],
      ["Average FOB", price(avgFob), "Per piece"],
      ["Average margin", avgM.toFixed(1) + "%", "Target 8%", avgM >= 8 ? "ok" : "wn"],
      ["BOM ready", `${all.length - noBom} of ${all.length}`, noBom ? `${noBom} costing sheets without BOM` : "All sheets have a BOM", noBom ? "wn" : "ok"]
    ]) + `${
      TB("Costing sheets", ["Style", "Fabric", "Trims", "CM", "Wastage", "Comm.", "Profit", "FOB", "Margin", "BOM", "Status"],
        all.map((c, i) => ({ cells: [c.style, price(c.fabric), price(c.trims), price(c.cm), price(c.wastage), price(c.commercial), price(c.profit), { html: `<b>${price(fobs[i])}</b>` }, margins[i].toFixed(1) + "%", bomLines(c).length ? `${bomLines(c).length} items` : chip("No BOM", "w"), st(c.status)], act: { act: "edit", col: "costings", id: c.id } })))
    }<div class="g2 even">${
      BR(sel ? `Cost split for ${sel.style}` : "Cost split", sel ? parts.map(([l, k]) => [l, pct(+sel[k] || 0, fob), `${pct(+sel[k] || 0, fob)}%`]) : [], { tools })
    }${
      Card("Fabric consumption calculator", `<div class="calc">${f("bl", "Body length (cm)")}${f("sl", "Sleeve length (cm)")}${f("hc", "Half chest (cm)")}${f("al", "Allowance (cm)")}${f("gsm", "Fabric GSM")}${f("ws", "Wastage (%)")}${f("pk", "Fabric price ($/kg)")}</div><div class="res" id="calcRes">${calcRes()}</div>${sel ? `<div class="card-foot"><button class="btn sm" data-act="calcApply" data-id="${esc(sel.id)}">Use as fabric cost for ${esc(sel.style)}</button></div>` : ""}`)
    }</div>${bom}`;
  }
});
