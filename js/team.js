/* Merchandising team: who is responsible for what, who is using the app, and a log of the work done */

const TEAM_ROLES = ["Merchandising manager", "Senior merchandiser", "Merchandiser", "Assistant merchandiser"];

const Team = {
  key: "merchandiser-user",
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
  /* The person using the app in this browser (chosen in the sidebar) */
  me() {
    let id = "";
    try { id = localStorage.getItem(this.key) || ""; } catch (e) { /* storage blocked */ }
    return this.get(id) ? id : ((this.active()[0] || {}).id || "");
  },
  setMe(id) { try { localStorage.setItem(this.key, id); } catch (e) { /* storage blocked */ } },
  /* Who looks after an order: set on the order, otherwise the buyer's merchandiser */
  ofOrder(o) { return o.merch || ((Store.all("buyers").find(b => b.name === o.buyer) || {}).merch) || ""; }
};

const initials = n => String(n || "?").split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
const avatar = (m, size = "sm") => `<span class="blogo ${size} av">${esc(initials(m ? m.name : "?"))}</span>`;

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

/* Record a piece of work done by the person using the app */
function logWork(text, order) {
  if (!Store.d || !Array.isArray(Store.d.activity)) return;
  Store.d.activity.unshift({ id: uid(), at: new Date().toISOString(), by: Team.me(), text, order: order || "" });
  if (Store.d.activity.length > 500) Store.d.activity.length = 500;
}

Actions.setUser = el => { Team.setMe(el.value); toast(`Working as ${Team.name(el.value) || "nobody"}`); App.render(); };
