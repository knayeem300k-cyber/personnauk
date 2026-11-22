/* Merchandising team: who is responsible for what, and a log of the work done on their orders and styles */

const TEAM_ROLES = ["Merchandising manager", "Senior merchandiser", "Merchandiser", "Assistant merchandiser"];

const Team = {
  all() { return Store.all("team") || []; },
  active() { return this.all().filter(m => (m.status || "Active") === "Active"); },
  get(id) { return id ? Store.get("team", id) : null; },
  name(id) { const m = this.get(id); return m ? m.name : ""; },
  /* Options for a "Merchandiser" dropdown; keeps the current person even if inactive */
  opts(cur, none = "Unassigned") {
    const a = this.active().map(m => [m.id, m.name]);
    if (cur && !a.some(x => x[0] === cur) && this.get(cur)) a.push([cur, this.name(cur) + " (inactive)"]);
    return [["", none], ...a];
  },
  /* Who looks after an order: set on the order, otherwise the buyer's merchandiser */
  ofOrder(o) { return o.merch || ((Store.all("buyers").find(b => b.name === o.buyer) || {}).merch) || ""; }
};

const initials = n => String(n || "?").split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
const avatar = (m, size = "sm") => `<span class="blogo ${size} av">${esc(m ? initials(m.name) : "T")}</span>`;

/* "2 h ago", "yesterday", "3 days ago" */
function ago(s) {
  const t = new Date(s).getTime();
  if (!t) return "";
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return m + " min ago";
  const h = Math.round(m / 60);
  if (h < 24) return h + " h ago";
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : d < 7 ? d + " days ago" : new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/* Record a piece of work. It is credited to the merchandiser who looks after the order
   (or the given person, for styles and buyers); otherwise to the team. */
function logWork(text, order, by) {
  if (!Store.d || !Array.isArray(Store.d.activity)) return;
  const o = order && Store.get("orders", order);
  Store.d.activity.unshift({ id: uid(), at: new Date().toISOString(), by: by || (o ? Team.ofOrder(o) : "") || "", text, order: order || "" });
  if (Store.d.activity.length > 500) Store.d.activity.length = 500;
}

