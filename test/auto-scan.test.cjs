const { test } = require('node:test');
const assert = require('node:assert/strict');
const { augmentGate, shouldAutoScan } = require('../core/auto-scan.cjs');

test('automatic scans follow the initial and 7, 11, 15 level gates', () => {
  assert.deepEqual([[3, 10], [5, 130], [5, 190], [7, 190], [11, 500], [15, 900]].map(([level, time]) => augmentGate(level, time)), [1, 1, 0, 7, 11, 15]);
});

test('later gates wait until death, throttle retries, and keep trying until cards appear', () => {
  const state = { gate: 0, attempts: 0, nextAt: 0, complete: false };
  const args = { level: 7, gameTime: 200, isDead: false, focused: true, busy: false };
  assert.equal(shouldAutoScan(state, { ...args, now: 1000 }), false);
  assert.equal(shouldAutoScan(state, { ...args, isDead: true, now: 1000 }), true);
  assert.equal(shouldAutoScan(state, { ...args, isDead: true, now: 2000 }), false);
  for (let n = 1; n < 24; n++) assert.equal(shouldAutoScan(state, { ...args, isDead: true, now: 1000 + n * 5000 }), true);
  assert.equal(shouldAutoScan(state, { ...args, isDead: true, now: 121000 }), false);
  assert.equal(shouldAutoScan(state, { ...args, level: 11, isDead: true, now: 121000 }), true);
});
