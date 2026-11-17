/* Export: real Excel (.xlsx) files written in the browser, and PDF through the print dialog.
   A page provides export() → { file, title, note, sheets: [{ name, cols: [{ h, w, f, pdf }], rows: [[...]] }] }
   Column format f: "int" (1,234), "money" (1,234.56), "pct" (12.5%). pdf: false hides a column in the PDF. */

const Xlsx = {
  /* --- tiny ZIP writer (no compression) --- */
  crcT: null,
  crc(b) {
    if (!this.crcT) { this.crcT = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; this.crcT[n] = c >>> 0; } }
    let c = 0xFFFFFFFF;
    for (let i = 0; i < b.length; i++) c = this.crcT[(c ^ b[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  },
  zip(files) {
    const enc = new TextEncoder(), parts = [], central = [];
    const now = new Date(), time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    let offset = 0;
    files.forEach(f => {
      const name = enc.encode(f.name), data = enc.encode(f.data), crc = this.crc(data);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, time, true); h.setUint16(12, date, true); h.setUint32(14, crc, true);
      h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), name, data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(12, time, true); c.setUint16(14, date, true); c.setUint32(16, crc, true);
      c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true);
      c.setUint32(42, offset, true);
      central.push(new Uint8Array(c.buffer), name);
      offset += 30 + name.length + data.length;
    });
    const cdSize = central.reduce((s, p) => s + p.length, 0);
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
    e.setUint32(12, cdSize, true); e.setUint32(16, offset, true);
    return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  },

  /* --- spreadsheet XML --- */
  x: s => String(s ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])),
  col(i) { let s = ""; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; },
  STYLE: { int: 2, money: 3, pct: 4 },
  sheet(sh) {
    const last = this.col(sh.cols.length - 1), n = sh.rows.length + 1;
    const cell = (v, r, c, col) => {
      const ref = this.col(c) + r;
      if (typeof v === "number" && isFinite(v)) return `<c r="${ref}"${col && this.STYLE[col.f] ? ` s="${this.STYLE[col.f]}"` : ""}><v>${col && col.f === "pct" ? v / 100 : v}</v></c>`;
      if (v === "" || v == null) return "";
      return `<c r="${ref}" t="inlineStr" s="5"><is><t xml:space="preserve">${this.x(v)}</t></is></c>`;
    };
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${sh.cols.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.w || 14}" customWidth="1"/>`).join("")}</cols><sheetData><row r="1">${sh.cols.map((c, i) => `<c r="${this.col(i)}1" t="inlineStr" s="1"><is><t>${this.x(c.h)}</t></is></c>`).join("")}</row>${sh.rows.map((row, ri) => `<row r="${ri + 2}">${row.map((v, ci) => cell(v, ri + 2, ci, sh.cols[ci])).join("")}</row>`).join("")}</sheetData>${sh.rows.length ? `<autoFilter ref="A1:${last}${n}"/>` : ""}</worksheet>`;
  },
  build(spec) {
    const sheets = spec.sheets.map((s, i) => ({ ...s, safe: (String(s.name).replace(/[\[\]:*?\/\\]/g, " ").slice(0, 31) || "Sheet" + (i + 1)) }));
    const files = [
      { name: "[Content_Types].xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>` },
      { name: "_rels/.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
      { name: "xl/workbook.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${this.x(s.safe)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets>${(dn => dn ? `<definedNames>${dn}</definedNames>` : "")(sheets.map((s, i) => s.rows.length ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${this.x(s.safe.replace(/'/g, "''"))}'!$A$1:$${this.col(s.cols.length - 1)}$${s.rows.length + 1}</definedName>` : "").join(""))}</workbook>` },
      { name: "xl/_rels/workbook.xml.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
      { name: "xl/styles.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="0.0%"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF7B2FF7"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>` },
      ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: this.sheet(s) }))
    ];
    return this.zip(files);
  }
};

const Exporter = {
  fmt(v, f) {
    if (typeof v !== "number") return v ?? "";
    return f === "money" ? (+v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : f === "pct" ? (+v).toFixed(1) + "%" : f === "int" ? num(v) : String(v);
  },
  name: spec => `${spec.file}-${iso(TODAY)}`,
  xlsx(spec) {
    const blob = Xlsx.build(spec), a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = this.name(spec) + ".xlsx";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast("Excel file downloaded");
  },
  /* Opens the print dialog with a clean table; choose “Save as PDF” there */
  pdf(spec) {
    const total = sum(spec.sheets, s => s.rows.length);
    const sec = s => {
      const idx = s.cols.map((c, i) => c.pdf === false ? -1 : i).filter(i => i >= 0);
      return `${spec.sheets.length > 1 ? `<h2>${esc(s.name)} <small>(${s.rows.length})</small></h2>` : ""}<table><thead><tr>${idx.map(i => `<th>${esc(s.cols[i].h)}</th>`).join("")}</tr></thead><tbody>${s.rows.length ? s.rows.map(r => `<tr>${idx.map(i => `<td${typeof r[i] === "number" ? ' class="n"' : ""}>${esc(this.fmt(r[i], s.cols[i].f))}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${idx.length}">No records.</td></tr>`}</tbody></table>`;
    };
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(this.name(spec))}</title><style>
      @page{size:A4 landscape;margin:12mm}
      body{font:9.5px/1.4 -apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#1d1730;margin:0}
      .top{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #7b2ff7;padding-bottom:8px;margin-bottom:10px}
      h1{font-size:17px;margin:0}.m{color:#6b6386;margin:2px 0 0}.brand{font-weight:800;color:#7b2ff7;font-size:12px}
      h2{font-size:12px;margin:16px 0 6px}h2 small{color:#6b6386;font-weight:500}
      table{width:100%;border-collapse:collapse}thead{display:table-header-group}tr{page-break-inside:avoid}
      th{background:#efe9fb;text-align:left;font-weight:700;padding:5px 6px;border-bottom:1px solid #cfc4ec}
      td{padding:4px 6px;border-bottom:1px solid #e9e4f5;vertical-align:top}td.n{text-align:right;white-space:nowrap}
      tbody tr:nth-child(even) td{background:#faf8ff}
      *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    </style></head><body><div class="top"><div><h1>${esc(spec.title)}</h1><p class="m">Exported ${esc(fmtL(iso(TODAY)))} · ${total} records${spec.note ? " · " + esc(spec.note) : ""}</p></div><div class="brand">Merchandiser</div></div>${spec.sheets.map(sec).join("")}</body></html>`;
    const old = document.getElementById("printFrame"); if (old) old.remove();
    const f = document.createElement("iframe");
    f.id = "printFrame"; f.title = "Print preview";
    f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    f.onload = () => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { toast("Could not open the print dialog."); } };
    f.srcdoc = html;
    document.body.appendChild(f);
    toast("Choose “Save as PDF” in the print dialog");
  }
};

/* Header Export menu */
Actions.exportMenu = el => {
  const m = el.parentElement.querySelector(".menu"), open = m.hidden;
  m.hidden = !open; el.setAttribute("aria-expanded", open);
  if (open) m.querySelector("button").focus();
};
const pageExport = () => { const p = App.route().p; document.querySelectorAll(".xm .menu").forEach(m => { m.hidden = true; }); return p.export ? p.export() : null; };
Actions.exportXlsx = () => { const s = pageExport(); if (s) Exporter.xlsx(s); };
Actions.exportPdf = () => { const s = pageExport(); if (s) Exporter.pdf(s); };
document.addEventListener("click", e => { if (!e.target.closest(".xm")) document.querySelectorAll(".xm .menu").forEach(m => { m.hidden = true; }); });

/* Does a record match the search text? (used so exports follow the on-screen search) */
const matchQ = (obj, q) => { q = String(q || "").trim().toLowerCase(); return !q || JSON.stringify(obj, (k, v) => k === "logo" || k === "sketch" ? undefined : v).toLowerCase().includes(q); };
