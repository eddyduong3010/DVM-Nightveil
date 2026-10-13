const BADGE_WIDTH = 180;
const BADGE_HEIGHT = 58;

function badgeLayout(game, regions) {
  if (!game || !Array.isArray(regions) || regions.length !== 3 || game.width < 300 || game.height < 300) return null;
  const centers = regions.map(r => game.x + (r.x + r.w / 2) * game.width);
  const top = Math.min(...regions.map(r => r.y));
  if (![...centers, top].every(Number.isFinite)) return null;
  const x = Math.max(game.x, Math.floor(Math.min(...centers) - BADGE_WIDTH / 2));
  const right = Math.min(game.x + game.width, Math.ceil(Math.max(...centers) + BADGE_WIDTH / 2));
  const y = Math.max(game.y, Math.round(game.y + top * game.height - BADGE_HEIGHT - 8));
  return { bounds: { x, y, width: right - x, height: BADGE_HEIGHT }, centers: centers.map(c => Math.round(c - x)) };
}

module.exports = { badgeLayout, BADGE_WIDTH, BADGE_HEIGHT };
