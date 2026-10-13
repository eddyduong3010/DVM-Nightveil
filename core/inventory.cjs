// Account for recipe components as a multiset: one owned component can credit
// only one branch, including recipes with duplicate swords or crystals.
function quotePurchase(id, inventory, data) {
  const bag = new Map();
  for (const i of inventory || []) bag.set(String(i.itemID), (bag.get(String(i.itemID)) || 0) + Math.max(1, Number(i.count) || 1));
  function visit(key, ancestors = new Set()) {
    key = String(key); const item = data.items[key];
    if (!item || ancestors.has(key)) return { credit: 0, missing: [] };
    if ((bag.get(key) || 0) > 0) { bag.set(key, bag.get(key) - 1); return { credit: item.gold?.total || 0, missing: [] }; }
    const next = new Set(ancestors); next.add(key);
    const children = (item.from || []).map(child => visit(child, next));
    const credit = children.reduce((n, child) => n + child.credit, 0);
    const remaining = Math.max(0, (item.gold?.total || 0) - credit);
    return { credit, missing: [{ id: key, remaining, total: item.gold?.total || 0, consumes: credit > 0 }, ...children.flatMap(child => child.missing)] };
  }
  const result = visit(id);
  return { credit: result.credit, remaining: Math.max(0, (data.items[String(id)]?.gold?.total || 0) - result.credit), missing: result.missing };
}

function conflicts(id, owned, data) {
  const groups = require('../data/mechanics.json').exclusiveItemGroups;
  // Upgrades inherit restrictions from their recipe ancestors.
  const family = (key, seen = new Set()) => {
    key = String(key); if (seen.has(key)) return seen; seen.add(key);
    for (const child of data.items[key]?.from || []) family(child, seen);
    return seen;
  };
  const proposed = family(id);
  return [...owned].some(other => groups.some(g => g.some(x => proposed.has(x)) && g.some(x => family(other).has(x))));
}
module.exports = { quotePurchase, conflicts };
