// Anime Cloud — Standalone Plans Module
// Catalog only: no server-management functionality.

const PLANS = {
  ipv4: [
    { id: "ipv4-1", name: "1 IPv4", price: 200, billing: "month", ipv4: 1 },
    { id: "ipv4-2", name: "2 IPv4", price: 400, billing: "month", ipv4: 2 },
    { id: "ipv4-5", name: "5 IPv4", price: 1000, billing: "month", ipv4: 5 },
    { id: "ipv4-10", name: "10 IPv4", price: 2000, billing: "month", ipv4: 10 },
    { id: "ipv4-20", name: "20 IPv4", price: 4000, billing: "month", ipv4: 20 }
  ],
  minecraft: [
    { id: "mc-dirt", name: "Dirt", price: 20, ram: 2, cpu: 50, storage: 6 },
    { id: "mc-stone", name: "Stone", price: 50, ram: 4, cpu: 100, storage: 8 },
    { id: "mc-copper", name: "Copper", price: 100, ram: 8, cpu: 150, storage: 20 },
    { id: "mc-iron", name: "Iron", price: 150, ram: 12, cpu: 200, storage: 30 },
    { id: "mc-diamond", name: "Diamond", price: 250, ram: 16, cpu: 250, storage: 50 },
    { id: "mc-netherite", name: "Netherite", price: 399, ram: 32, cpu: 300, storage: 70 },
    { id: "mc-bedrock", name: "Bedrock", price: 499, ram: 48, cpu: 400, storage: 100 }
  ],
  vps: [
    { id: "vps-nano", name: "VPS Nano", price: 300, ram: 4, vcpu: 1, storage: 30, ipv4: "Public IPv4" },
    { id: "vps-micro", name: "VPS Micro", price: 450, ram: 8, vcpu: 2, storage: 50, ipv4: "Public IPv4" },
    { id: "vps-mini", name: "VPS Mini", price: 550, ram: 12, vcpu: 2, storage: 70, ipv4: "Public IPv4" },
    { id: "vps-starter", name: "VPS Starter", price: 700, ram: 16, vcpu: 4, storage: 100, ipv4: "Public IPv4" },
    { id: "vps-basic", name: "VPS Basic", price: 900, ram: 24, vcpu: 6, storage: 140, ipv4: "Public IPv4" },
    { id: "vps-advanced", name: "VPS Advanced", price: 1300, ram: 40, vcpu: 8, storage: 200, ipv4: "Private IPv4", priority: "Priority Node" },
    { id: "vps-pro", name: "VPS Pro", price: 1500, ram: 64, vcpu: 12, storage: 300, ipv4: "Private IPv4", priority: "High Priority Cluster" }
  ]
};

const CATEGORY_NAMES = { ipv4: "🌐 IPv4 Services", minecraft: "⛏️ Minecraft India", vps: "☁️ Paid VPS" };
const normalize = v => String(v || "").toLowerCase().trim().replace(/[_\s]+/g, "-");
const money = v => `₹${Number(v).toLocaleString("en-IN")}`;
function allPlans() { return Object.entries(PLANS).flatMap(([category, plans]) => plans.map(plan => ({ ...plan, category }))); }
function categoryPlans(category) { return PLANS[normalize(category)] || []; }
function findPlan(query) { const q = normalize(query); return allPlans().find(p => p.id === q || normalize(p.name) === q || normalize(p.name).includes(q)) || null; }
function planLine(p, category) {
  if (category === "ipv4") return `• **${p.name}** — ${money(p.price)}/month • ${p.ipv4} IPv4`;
  if (category === "minecraft") return `• **${p.name}** — ${p.ram} GB RAM • ${p.cpu}% CPU • ${p.storage} GB Disk • ${money(p.price)}`;
  return `• **${p.name}** — ${p.ram} GB RAM • ${p.vcpu} vCPU • ${p.storage} GB NVMe • ${p.ipv4} • ${money(p.price)}/month`;
}
function planText(category) {
  if (category && PLANS[normalize(category)]) { const key = normalize(category); return `**${CATEGORY_NAMES[key]}**\n\n${PLANS[key].map(p => planLine(p, key)).join("\n")}`; }
  return Object.keys(PLANS).map(key => `**${CATEGORY_NAMES[key]}**\n${PLANS[key].map(p => planLine(p, key)).join("\n")}`).join("\n\n");
}
function orderDetails(plan) { if (!plan) return null; return { id: plan.id, name: plan.name, category: plan.category, amount: plan.price, billing: plan.billing || "month", description: planLine(plan, plan.category) }; }
module.exports = { PLANS, CATEGORY_NAMES, allPlans, categoryPlans, findPlan, planText, orderDetails, money };
