/* Data layer: the 10 order stages with their files, demo data, and saving to the browser (localStorage) */

/* Every order carries this checklist. The files come from the merchandising workflow, stage by stage. */
const STAGES = [
  { name: "Inquiry", module: "inquiry", docs: ["Tech pack", "Design sketch / reference sample", "Target price and quantity", "Factory capability sheet"] },
  { name: "Costing", module: "costing", docs: ["Costing sheet", "BOM (bill of materials)", "Consumption sheet", "Marker efficiency report", "Supplier quotations"] },
  { name: "Sampling", module: "sampling", docs: ["Measurement spec sheet", "Sample request / tracking sheet", "Pattern file (CAD)", "Sample comment sheet", "Courier AWB"] },
  { name: "PO and contract", module: "orders", docs: ["Quotation / offer sheet", "Purchase order (PO)", "Proforma invoice (PI)", "Sales contract / master L/C", "PO review sheet"] },
  { name: "Pre-production", module: "preprod", docs: ["Order breakdown sheet", "T&A calendar (TNA)", "Fabric / yarn booking", "Trims booking", "Lab dip approval", "Strike-off approval", "Embroidery / print / wash approval", "Fabric test report", "Back-to-back L/C", "PP meeting minutes", "Style / production file"] },
  { name: "Production", module: "production", docs: ["Final tech pack", "Approved PP sample", "Approved lab dip and strike-off", "Cutting plan and marker", "Sewing instruction / operation breakdown", "Trim card", "Packing instruction and carton marking", "Label placement guide", "Wash standard"] },
  { name: "Follow-up", module: "production", docs: ["Daily production report", "Line loading plan", "WIP report", "In-line inspection report (DHU)", "Capacity vs booking sheet", "Material in-house report"] },
  { name: "Quality", module: "quality", docs: ["Final inspection report (AQL)", "Third-party inspection report", "Final garment test report", "CAP (if failed)", "Metal detection report"] },
  { name: "Shipping", module: "shipping", docs: ["Packing list", "Commercial invoice", "Booking confirmation", "Bill of lading / airway bill", "EXP form", "Certificate of origin / GSP", "UD (BGMEA)", "Inspection certificate", "CNF / forwarder communication", "Customs documents"] },
  { name: "Post-shipment", module: "payments", docs: ["Payment tracking sheet", "Buyer claim / feedback report", "Shipment summary", "Order closing file"] }
];

/* The 8 most important files, mapped to [stage, file] positions above */
const KEY_FILES = [
  ["Tech pack", [[0, 0]]], ["Costing sheet", [[1, 0]]], ["BOM", [[1, 1]]], ["Purchase order", [[3, 1]]],
  ["TNA calendar", [[4, 1]]], ["Order breakdown", [[4, 0]]], ["Approved samples and lab dip", [[5, 1], [5, 2]]],
  ["Packing list and commercial invoice", [[8, 0], [8, 1]]]
];

/* T&A plan: task, days before (–) or after (+) the delivery date, and the file that marks it done */
const TNA_PLAN = [
  ["Lab dip approval", -80, 4, 4], ["Fabric booking", -75, 4, 2], ["Trims booking", -70, 4, 3],
  ["Fit sample approval", -65, 2, 3], ["Fabric test report", -50, 4, 7], ["PP sample approval", -45, 5, 1],
  ["PP meeting", -40, 4, 9], ["Cutting start", -35, 5, 3], ["Sewing start", -28, 6, 0],
  ["Final inspection", -7, 7, 0], ["Ex-factory", 0, 8, 2], ["Payment collection", 30, 9, 0]
];

const SECTIONS = [["sketch", "Design sketch"], ["measure", "Measurement chart"], ["fabric", "Fabric details"], ["stitch", "Stitch details"], ["trims", "Trims and labels"], ["label", "Label placement"], ["packing", "Packing instruction"]];
const INQ_CK = ["Tech pack received", "Design sketch / reference sample", "Target price and quantity", "Factory capability sheet sent"];

const newDocs = () => STAGES.map(s => s.docs.map(() => "no"));

/* Demo data. Dates are relative to today so the demo always looks current. */
function seedData() {
  const d = n => addDays(iso(TODAY), n);
  const docs = (stage, part = "", extra = []) => {
    const p = part ? part.split(" ") : [];
    const a = STAGES.map((s, i) => s.docs.map((_, j) => i < stage ? "ok" : i === stage ? (p[j] || "no") : "no"));
    extra.forEach(([s, j, v]) => { a[s][j] = v; });
    return a;
  };
  const O = (id, buyer, style, product, qty, pr, del, cdel, cpr, payment, lc, stage, part, extra, created) =>
    ({ id, buyer, style, product, qty, price: pr, delivery: d(del), contractDelivery: d(cdel), contractPrice: cpr, payment, lc, docs: docs(stage, part, extra), created: d(created) });
  const S = (id, name, buyer, version, status, upd, sec) => {
    const r = { id, name, buyer, version, status, updated: d(upd) };
    SECTIONS.forEach(([k], i) => { r["s_" + k] = sec[i] || ""; });
    return r;
  };
  const orders = [
    O("88217", "Northwind Apparel", "LX-2041", "Polo shirt", 24000, 4.20, 63, 70, 4.20, "L/C", "Received", 4, "ok ok ok wt wt ok no no wt no no", [[2, 3, "wt"]], -3),
    O("88190", "Harbor and Pine", "KD-1190", "Fleece hoodie", 18500, 7.90, 75, 75, 7.90, "TT 30 days", "Not needed", 6, "ok ok wt no no wt", [], -40),
    O("88162", "Northwind Apparel", "LX-2033", "Chino pant", 12000, 6.10, 82, 82, 6.10, "L/C", "Pending", 6, "ok wt no wt no wt", [], -45),
    O("88140", "Alder Co.", "AL-0907", "Basic tee", 40000, 2.55, 88, 88, 2.55, "TT 45 days", "Not needed", 2, "ok wt ok no no", [[3, 0, "ok"], [3, 1, "ok"]], -5),
    O("88104", "Alder Co.", "AL-0880", "Basic tee", 40000, 2.65, 6, 6, 2.65, "TT 45 days", "Not needed", 8, "ok ok ok no ok ok ok ok wt ok", [], -120),
    O("88071", "Harbor and Pine", "KD-1150", "Zip hoodie", 12000, 8.40, 11, 11, 8.40, "L/C", "Received", 8, "ok ok ok no wt wt wt ok no no", [], -110),
    O("88059", "Northwind Apparel", "LX-2010", "Polo shirt", 9000, 4.05, 16, 16, 4.05, "L/C", "Received", 8, "ok no ok no no wt no no no no", [], -100),
    O("88033", "Kestrel Wear", "KW-0410", "Chino pant", 12000, 6.30, 23, 23, 6.30, "TT 30 days", "Not needed", 7, "ok ok no no ok", [], -95),
    O("87990", "Northwind Apparel", "LX-1990", "Polo shirt", 24000, 4.10, -41, -41, 4.10, "TT 30 days", "Not needed", 9, "wt no ok no", [], -160),
    O("87952", "Harbor and Pine", "KD-1101", "Fleece hoodie", 18500, 7.90, -21, -21, 7.90, "TT 45 days", "Not needed", 9, "wt no ok no", [], -150),
    O("87911", "Alder Co.", "AL-0850", "Basic tee", 27000, 2.70, -60, -60, 2.70, "TT 30 days", "Not needed", 10, "", [], -190)
  ];
  orders[10].closedAt = d(-6);
  const B = (id, name, country, currency, contact, role, email, phone, department, payment, incoterm, portal, calendar, status, manual, procedures, documents, tech) =>
    ({ id, name, country, currency, contact, role, email, phone, department, payment, incoterm, portal, calendar, status, manual, procedures, documents, tech: tech.split(" "), created: d(-200) });
  const buyers = [
    B("by1", "Northwind Apparel", "USA", "USD", "Sarah Lee", "Senior buyer", "buying@northwind.example", "+1 555 0100", "Menswear, Kids", "L/C at sight", "FOB", "Inspectorio", "US federal holidays, Thanksgiving week", "Active", "Restricted substances list v4, social compliance audit yearly", "Fit and PP sample before bulk, final AQL 2.5 by third party, 12 pcs per carton", "Packing list, commercial invoice, B/L, GSP, inspection certificate", "ok ok ok ok wt ok"),
    B("by2", "Harbor and Pine", "Canada", "USD", "Marc Dubois", "Buying assistant", "orders@harborpine.example", "+1 555 0144", "Adult outerwear", "TT 30 days", "FOB", "SmartMoov", "Canada Day, Christmas to New Year", "Active", "Bilingual care labels (English and French)", "PP sample approval in portal, solid size packing", "", "ok wt ok ok no wt"),
    B("by3", "Alder Co.", "UK", "GBP", "Priya Shah", "Buyer", "", "+44 20 7946 0000", "Womenswear, Basics", "TT 45 days", "FOB", "", "UK bank holidays", "Active", "", "Final inspection by buyer QA", "", "ok ok wt no no wt"),
    B("by4", "Kestrel Wear", "Germany", "EUR", "Jonas Weber", "Buyer", "", "", "Menswear", "TT 30 days", "FCA", "", "German public holidays", "Active", "", "", "", "wt no no no no no"),
    B("by5", "PEPCO", "Poland", "EUR", "Buying office", "Buying assistant", "", "", "Adult, Kids", "TT 60 days", "FOB", "SmartMoov", "Polish public holidays", "Active", "", "", "", "no no no no no no"),
    B("by6", "Pernambucanas", "Brazil", "USD", "Apparel team", "Buyer", "", "", "Apparel", "L/C 90 days", "FOB", "", "Brazil carnival week", "Active", "", "", "", "no no no no no no"),
    B("by7", "Lidl", "Germany", "EUR", "", "", "", "", "Kids", "Open account", "FOB", "Inspectorio", "", "Inactive", "", "", "", "no no no no no no")
  ];
  buyers[0].portalAccess = "Inspectorio supplier portal. User ID: factory-merch-01. Access: merchandising lead and QA manager.";
  buyers[1].portalAccess = "SmartMoov supplier login. User ID: hp-supplier-221. Access: merchandiser for PP sample uploads.";
  buyers[4].portalAccess = "SmartMoov. Access request sent to buying office, waiting for login.";
  buyers[0].contacts = [
    { name: "Sarah Lee", role: "Senior buyer", email: "buying@northwind.example", phone: "+1 555 0100", department: "Menswear" },
    { name: "Tom Becker", role: "Buying assistant", email: "tom.b@northwind.example", phone: "+1 555 0102", department: "Kids" },
    { name: "Ana Ruiz", role: "Technologist", email: "tech@northwind.example", phone: "", department: "Menswear, Kids" }
  ];
  const y = TODAY.getFullYear() % 100;
  const V = (id, buyer, season, category, product, factory, status, due, merch, fabric, colours, targetPrice, targetQty, notes, histDays) => {
    const hist = {};
    const flow = ["Brief received", "Design", "Pattern", "Proto sample", "Fit sample", "Costing", "Approved"], end = flow.indexOf(status);
    (end < 0 ? [flow[0], status] : flow.slice(0, end + 1)).forEach((s, i, a) => { hist[s] = d(histDays + Math.round(i * (-histDays) / Math.max(1, a.length))); });
    return { id, buyer, season, category, product, factory, status, due: d(due), merch, fabric, colours, targetPrice, targetQty, notes, hist, created: d(histDays) };
  };
  const devs = [
    V("AW" + (y + 1) + "BG105-SL", "PEPCO", "AW" + (y + 1), "Outerwear", "Padded jacket", "Glamour Dresses Ltd.", "Pattern", 38, "Merchandising team A", "Nylon taffeta with polyfill", "Black, Olive", 11.5, 30000, "Buyer wants a lighter fill weight than last season.", -20),
    V("LX-2041", "Northwind Apparel", "SS" + (y + 1), "Knit", "Polo shirt", "Unit 2, knit floor", "Approved", -40, "Merchandising team A", "180 GSM cotton pique", "Navy, White, Red", 4.2, 24000, "Approved after fit sample v2.", -120),
    V("AL-0907", "Alder Co.", "SS" + (y + 1), "Knit", "Basic tee", "Unit 1", "Costing", 6, "Merchandising team B", "160 GSM single jersey", "White, Grey melange", 2.6, 40000, "Costing is above target. Check cheaper yarn.", -45),
    V("KD-1190", "Harbor and Pine", "AW" + y, "Knit", "Fleece hoodie", "Unit 2, knit floor", "Approved", -60, "Merchandising team B", "280 GSM brushed fleece", "Charcoal, Forest", 7.9, 18500, "", -150),
    V("PEP-SS" + (y + 1) + "-114", "PEPCO", "SS" + (y + 1), "Knit", "Kids printed tee", "Unit 1", "Proto sample", 12, "Merchandising team A", "150 GSM single jersey", "4 prints", 1.85, 60000, "Print artwork v2 received.", -15),
    V("PRN-SS" + (y + 1) + "-021", "Pernambucanas", "SS" + (y + 1), "Denim", "Women's skinny jeans", "Denim unit", "Fit sample", -3, "Merchandising team B", "10 oz stretch denim", "Mid blue, Black", 8.4, 15000, "Fit comments: waist too high, re-make fit sample.", -35),
    V("KW-0455", "Kestrel Wear", "AW" + (y + 1), "Woven", "Slim chino", "Woven unit", "Design", 50, "Merchandising team B", "Cotton twill 240 GSM", "Khaki, Navy", 6.2, 10000, "", -5),
    V("PEP-AW" + (y + 1) + "-201", "PEPCO", "AW" + (y + 1), "Sweater", "Cable knit jumper", "", "Brief received", 60, "Merchandising team A", "Acrylic wool blend", "", 6.8, 25000, "Waiting for gauge and yarn confirmation.", -2),
    V("NW-SS" + (y + 1) + "-330", "Northwind Apparel", "SS" + (y + 1), "Woven", "Linen shirt", "Woven unit", "On hold", 20, "Merchandising team A", "100% linen", "White, Sky", 7.1, 8000, "Buyer paused the style until range review.", -25)
  ];
  return {
    v: 1,
    buyers,
    devs,
    orders,
    inquiries: [
      { id: "INQ-311", buyer: "Northwind Apparel", style: "Polo shirt", qty: 24000, target: 4.20, received: d(-12), status: "Quoted", ck: ["ok", "ok", "ok", "ok"] },
      { id: "INQ-312", buyer: "Alder Co.", style: "Basic tee", qty: 40000, target: 2.65, received: d(-6), status: "Costing", ck: ["ok", "wt", "ok", "no"] },
      { id: "INQ-313", buyer: "Harbor and Pine", style: "Fleece hoodie", qty: 18500, target: 7.90, received: d(0), status: "New", ck: ["ok", "wt", "ok", "wt"] },
      { id: "INQ-314", buyer: "Kestrel Wear", style: "Chino pant", qty: 12000, target: 6.10, received: d(-2), status: "Capacity check", ck: ["no", "no", "ok", "wt"] },
      { id: "INQ-305", buyer: "Northwind Apparel", style: "Polo shirt", qty: 24000, target: 4.20, received: d(-40), status: "Won", ck: ["ok", "ok", "ok", "ok"] },
      { id: "INQ-308", buyer: "Kestrel Wear", style: "Cargo short", qty: 8000, target: 5.40, received: d(-30), status: "Lost", ck: ["ok", "ok", "ok", "ok"] }
    ],
    styles: [
      S("LX-2041", "Polo", "Northwind Apparel", "v3", "Final", -2, ["Front, back", "S, M, L, XL, XXL", "180 GSM cotton pique", "Overlock, topstitch 1/4 inch", "4-hole button, woven main label", "Neck, hem", "Polybag, 12 pieces per carton"]),
      S("KD-1190", "Hoodie", "Harbor and Pine", "v2", "Review", -6, ["Front, back, hood", "XS to XL", "280 GSM brushed fleece", "Flatlock, coverstitch", "Metal eyelets, drawcord, main label", "", "Polybag, 8 pieces per carton"]),
      S("AL-0907", "Tee", "Alder Co.", "v1", "Draft", -1, ["Front, back", "S to XL", "160 GSM single jersey", "", "Printed neck label", "", ""]),
      S("LX-2033", "Chino", "Northwind Apparel", "v4", "Final", -20, ["Front, back, pocket detail", "28 to 40 waist", "240 GSM cotton twill", "Lockstitch, bartack", "Shank button, zipper, leather patch", "Waistband, back pocket", "Folded, 10 pieces per carton"])
    ],
    costings: [
      { id: "c1", style: "LX-2041", buyer: "Northwind Apparel", fabric: 2.45, trims: 0.62, cm: 0.52, wastage: 0.21, commercial: 0.10, profit: 0.30, status: "Approved", bom: [
        { item: "180 GSM cotton pique", type: "Fabric", supplier: "Rahim Textile", unit: "kg", cons: "0.29", rate: "7.80", waste: "8" },
        { item: "Rib collar and cuff", type: "Fabric", supplier: "Rahim Textile", unit: "set", cons: "1", rate: "0.12", waste: "3" },
        { item: "4-hole button 18L", type: "Trims", supplier: "Trims Hub", unit: "pcs", cons: "3", rate: "0.02", waste: "3" },
        { item: "Woven main label", type: "Trims", supplier: "Trims Hub", unit: "pcs", cons: "1", rate: "0.05", waste: "2" },
        { item: "Care label", type: "Trims", supplier: "Trims Hub", unit: "pcs", cons: "1", rate: "0.02", waste: "2" },
        { item: "Sewing thread", type: "Thread", supplier: "Coats", unit: "m", cons: "180", rate: "0.0006", waste: "5" },
        { item: "Hang tag with string", type: "Trims", supplier: "Print Pack BD", unit: "pcs", cons: "1", rate: "0.04", waste: "2" },
        { item: "Polybag", type: "Packing", supplier: "Print Pack BD", unit: "pcs", cons: "1", rate: "0.03", waste: "2" },
        { item: "Export carton (12 pcs)", type: "Packing", supplier: "Print Pack BD", unit: "pcs", cons: "0.083", rate: "1.20", waste: "1" }
      ] },
      { id: "c2", style: "AL-0907", buyer: "Alder Co.", fabric: 1.62, trims: 0.25, cm: 0.38, wastage: 0.10, commercial: 0.12, profit: 0.18, status: "Awaiting approval" },
      { id: "c3", style: "KD-1190", buyer: "Harbor and Pine", fabric: 4.95, trims: 0.95, cm: 0.78, wastage: 0.30, commercial: 0.37, profit: 0.55, status: "Approved", bom: [
        { item: "280 GSM brushed fleece", type: "Fabric", supplier: "Padma Knit", unit: "kg", cons: "0.62", rate: "7.40", waste: "8" },
        { item: "Metal eyelets", type: "Trims", supplier: "Trims Hub", unit: "pcs", cons: "2", rate: "0.03", waste: "3" },
        { item: "Flat drawcord", type: "Trims", supplier: "Trims Hub", unit: "pcs", cons: "1", rate: "0.09", waste: "3" },
        { item: "Main label and care label", type: "Trims", supplier: "Trims Hub", unit: "set", cons: "1", rate: "0.08", waste: "2" },
        { item: "Polybag and carton share", type: "Packing", supplier: "Print Pack BD", unit: "set", cons: "1", rate: "0.16", waste: "1" }
      ] },
      { id: "c4", style: "LX-2033", buyer: "Northwind Apparel", fabric: 4.00, trims: 0.74, cm: 0.60, wastage: 0.24, commercial: 0.16, profit: 0.36, status: "Approved" }
    ],
    samples: [
      { id: "s1", order: "88217", style: "LX-2041", type: "Proto", sent: d(-45), due: d(-35), courier: "DHL", awb: "4419 0021", status: "Approved", approvedAt: d(-38) },
      { id: "s2", order: "88217", style: "LX-2041", type: "Fit", sent: d(-6), due: d(4), courier: "DHL", awb: "4420 1818", status: "Waiting" },
      { id: "s3", order: "88190", style: "KD-1190", type: "PP", sent: d(-10), due: d(-3), courier: "FedEx", awb: "8821 0255", status: "Approved", approvedAt: d(-4) },
      { id: "s4", order: "88190", style: "KD-1190", type: "Salesman", sent: d(-14), due: d(-4), courier: "DHL", awb: "4418 9033", status: "Waiting" },
      { id: "s5", order: "88162", style: "LX-2033", type: "Size set", sent: d(-19), due: d(-9), courier: "DHL", awb: "4419 7712", status: "Waiting" },
      { id: "s6", order: "88162", style: "LX-2033", type: "Fit", sent: d(-40), due: d(-30), courier: "FedEx", awb: "8819 4410", status: "Approved", approvedAt: d(-31) },
      { id: "s7", order: "88140", style: "AL-0907", type: "Proto", sent: "", due: d(5), courier: "DHL", awb: "", status: "In progress" },
      { id: "s8", order: "88059", style: "LX-2010", type: "Shipment", sent: d(-3), due: d(7), courier: "DHL", awb: "4420 0391", status: "Waiting" }
    ],
    bookings: [
      { id: "b1", order: "88217", type: "Fabric", item: "Fabric, 180 GSM pique", supplier: "Rahim Textile", date: d(-8), due: d(-2), status: "In house" },
      { id: "b2", order: "88217", type: "Trims", item: "Buttons and labels", supplier: "Trims Hub", date: d(-7), due: d(5), status: "Awaiting" },
      { id: "b3", order: "88217", type: "Lab dip", item: "Lab dip, navy", supplier: "Rahim Textile", date: d(-4), due: d(2), status: "Review" },
      { id: "b4", order: "88217", type: "Strike-off", item: "Embroidery strike-off", supplier: "Star Emb.", date: d(-3), due: d(1), status: "Approved" },
      { id: "b5", order: "88217", type: "Test", item: "Fabric test report", supplier: "Lab Dhaka", date: d(-2), due: d(0), status: "Failed", notes: "Shrinkage out of tolerance" },
      { id: "b6", order: "88162", type: "Trims", item: "Elastic", supplier: "Fastening BD", date: d(-15), due: d(-4), status: "Pending" },
      { id: "b7", order: "88190", type: "Fabric", item: "Fleece, 280 GSM", supplier: "Padma Knit", date: d(-30), due: d(-12), status: "In house" }
    ],
    lines: [
      { id: "l1", line: "Line 4", order: "88190", date: d(0), target: 1400, actual: 1310, checked: 620, defects: 13 },
      { id: "l2", line: "Line 7", order: "88162", date: d(0), target: 1200, actual: 980, checked: 540, defects: 21 },
      { id: "l3", line: "Line 9", order: "88162", date: d(0), target: 1100, actual: 1090, checked: 500, defects: 12 },
      { id: "l4", line: "Cutting", order: "88190", date: d(0), target: 6000, actual: 5800, checked: 0, defects: 0 }
    ],
    inspections: [
      { id: "i1", order: "88104", type: "Final", aql: "2.5", inspector: "SGS", date: d(-3), lot: 40000, defects: 4 },
      { id: "i2", order: "88071", type: "Final", aql: "2.5", inspector: "Intertek", date: d(-1), lot: 12000, defects: 6 },
      { id: "i3", order: "88162", type: "In-line", aql: "2.5", inspector: "Internal", date: d(-2), lot: 12000, defects: 18, capDue: d(3), capStatus: "Open" },
      { id: "i4", order: "88217", type: "Pre-final", aql: "2.5", inspector: "Bureau Veritas", date: d(34), lot: 24000, defects: "" },
      { id: "i5", order: "88059", type: "Final", aql: "2.5", inspector: "Internal", date: d(-1), lot: 9000, defects: 12, capDue: d(2), capStatus: "Open" }
    ],
    shipments: [
      { id: "h1", order: "88104", mode: "Sea", forwarder: "Apex Logistics", vessel: "MSC Aurora", shipDate: d(6), eta: d(36) },
      { id: "h2", order: "88071", mode: "Sea", forwarder: "Apex Logistics", vessel: "", shipDate: d(11), eta: d(41) },
      { id: "h3", order: "88059", mode: "Air", forwarder: "SkyLink Cargo", vessel: "", shipDate: d(16), eta: d(19) },
      { id: "h4", order: "88033", mode: "Sea", forwarder: "Oriental Freight", vessel: "", shipDate: d(23), eta: d(53) },
      { id: "h5", order: "87952", mode: "Sea", forwarder: "Apex Logistics", vessel: "Maersk Kobe", shipDate: d(-21), eta: d(19) },
      { id: "h6", order: "87990", mode: "Sea", forwarder: "Apex Logistics", vessel: "", shipDate: d(-41), eta: d(-10) }
    ],
    payments: [
      { id: "p1", order: "88104", invoice: "INV-88104", amount: 106000, due: d(34), paid: 0 },
      { id: "p2", order: "87990", invoice: "INV-87990", amount: 98400, due: d(-11), paid: 40000 },
      { id: "p3", order: "87952", invoice: "INV-87952", amount: 146150, due: d(9), paid: 0 },
      { id: "p4", order: "87911", invoice: "INV-87911", amount: 72900, due: d(-17), paid: 72900, paidDate: d(-8) }
    ]
  };
}

const Store = {
  key: "merchandiser-data-v1",
  d: null,
  cols: ["buyers", "devs", "orders", "inquiries", "styles", "costings", "samples", "bookings", "lines", "inspections", "shipments", "payments"],
  load() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(this.key)); } catch (e) { /* storage blocked or empty */ }
    this.d = d && d.v === 1 ? d : seedData();
    this.fix();
  },
  /* Make sure every collection exists and every order has a full checklist */
  fix() {
    if (!Array.isArray(this.d.buyers)) this.d.buyers = seedData().buyers;
    if (!Array.isArray(this.d.devs)) this.d.devs = seedData().devs;
    if (!this.d.bomReady) {
      const seed = seedData().costings;
      (this.d.costings || []).forEach(c => { const s = seed.find(x => x.id === c.id && x.style === c.style); if (s && s.bom && !Array.isArray(c.bom)) c.bom = s.bom; });
      this.d.bomReady = true;
    }
    this.cols.forEach(c => { if (!Array.isArray(this.d[c])) this.d[c] = []; });
    this.d.buyers.forEach(b => {
      if (!Array.isArray(b.contacts)) {
        const c = { name: b.contact || "", role: b.role || "", email: b.email || "", phone: b.phone || "", department: b.department || "" };
        b.contacts = Object.values(c).some(Boolean) ? [c] : [];
      }
      ["contact", "role", "email", "phone", "department"].forEach(k => delete b[k]); if (!Array.isArray(b.tech)) b.tech = ["no", "no", "no", "no", "no", "no"]; });
    this.d.orders.forEach(o => {
      o.id = String(o.id);
      o.docs = STAGES.map((s, i) => s.docs.map((_, j) => (o.docs && o.docs[i] && o.docs[i][j]) || "no"));
    });
    this.d.inquiries.forEach(i => { if (!Array.isArray(i.ck)) i.ck = INQ_CK.map(() => "no"); });
  },
  save() {
    try { localStorage.setItem(this.key, JSON.stringify(this.d)); return true; }
    catch (e) { if (typeof toast === "function") toast("Could not save: browser storage is full or blocked. Export a backup."); return false; }
  },
  all(c) { return this.d[c]; },
  get(c, id) { return this.d[c].find(r => String(r.id) === String(id)); },
  add(c, r) { if (!r.id) r.id = uid(); this.d[c].push(r); this.save(); return r; },
  update(c, id, patch) { const r = this.get(c, id); if (r) Object.assign(r, patch); this.save(); return r; },
  remove(c, id) { this.d[c] = this.d[c].filter(r => String(r.id) !== String(id)); this.save(); },
  reset() { this.d = seedData(); this.fix(); this.save(); },
  replace(d) {
    if (!d || !Array.isArray(d.orders)) throw new Error("Not a valid backup file");
    d.v = 1; this.d = d; this.fix(); this.save();
  }
};
