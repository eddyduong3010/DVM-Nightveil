const { test } = require('node:test');
const assert = require('node:assert/strict');
const { badgeLayout } = require('../core/badge-layout.cjs');

test('tier labels align to OCR card centers above the cards on an offset display', () => {
  const game = { x: 1920, y: 40, width: 1600, height: 900 };
  const regions = [{ x: .18, y: .26, w: .20, h: .44 }, { x: .40, y: .26, w: .20, h: .44 }, { x: .62, y: .26, w: .20, h: .44 }];
  const result = badgeLayout(game, regions);
  assert.deepEqual(result.centers.map(x => x + result.bounds.x), [2368, 2720, 3072]);
  assert.ok(result.bounds.y + result.bounds.height < game.y + .26 * game.height);
  assert.ok(result.bounds.x >= game.x && result.bounds.x + result.bounds.width <= game.x + game.width);
});

test('invalid game bounds do not place tier labels', () => {
  assert.equal(badgeLayout(null, []), null);
  assert.equal(badgeLayout({ x: 0, y: 0, width: 0, height: 0 }, [{}, {}, {}]), null);
});
