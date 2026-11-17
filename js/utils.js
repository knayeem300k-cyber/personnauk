/* Small helpers: dates, number formatting, HTML escaping */

const TODAY = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
const pad = n => String(n).padStart(2, "0");
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseD = s => {
  if (!s) return null;
  const [y, m, d] = String(s).split("-").map(Number);
  return y ? new Date(y, (m || 1) - 1, d || 1) : null;
};
const addDays = (s, n) => { const d = parseD(s); if (!d) return ""; d.setDate(d.getDate() + n); return iso(d); };
/* Days from today: positive = in the future, negative = in the past, NaN = no date */
const daysFrom = s => { const d = parseD(s); return d ? Math.round((d - TODAY) / 864e5) : NaN; };
const fmtD = s => { const d = parseD(s); return d ? d.toLocaleDateString("en-US", { month: "short", day: "2-digit" }) : "–"; };
const fmtL = s => { const d = parseD(s); return d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "–"; };
const relDays = n => isNaN(n) ? "" : n === 0 ? "today" : n > 0 ? `in ${n} day${n === 1 ? "" : "s"}` : `${-n} day${n === -1 ? "" : "s"} ago`;
const sameMonth = s => { const d = parseD(s); return !!d && d.getMonth() === TODAY.getMonth() && d.getFullYear() === TODAY.getFullYear(); };

const money = n => {
  n = +n || 0; const a = Math.abs(n);
  return (n < 0 ? "-" : "") + (a >= 1e6 ? "$" + (a / 1e6).toFixed(1) + "M" : a >= 1e3 ? "$" + (a / 1e3).toFixed(1) + "K" : "$" + a.toFixed(0));
};
const price = n => "$" + (+n || 0).toFixed(2);
const num = n => (+n || 0).toLocaleString("en-US");
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
const sum = (arr, f) => arr.reduce((s, x) => s + (+f(x) || 0), 0);
const uid = () => Math.random().toString(36).slice(2, 9);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
