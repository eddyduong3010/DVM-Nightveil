const {test}=require('node:test');
const assert=require('node:assert/strict');
const {visibleSession}=require('../core/visible-session.cjs');
const {POLICY,assertCommand}=require('../core/feature-policy.cjs');
const {demo}=require('../core/demo.cjs');
const catalog=require('../data/catalog.json');

test('passive session exposes champion and item names without hidden match fields',()=>{
 const snapshot=demo(catalog,'Evelynn');
 snapshot.allPlayers[0].secretAugments=['not-observed'];
 const view=visibleSession(snapshot,catalog);
 assert.ok(view.players.length);
 assert.ok(view.players.some(p=>p.side==='Bạn'));
 assert.ok(view.players.every(p=>Object.keys(p).sort().join(',')==='champion,icon,items,name,side'));
 assert.ok(view.players.every(p=>p.items.every(i=>Object.keys(i).sort().join(',')==='icon,id,name')));
 assert.ok(!JSON.stringify(view).includes('not-observed'));
});
test('passive session disappears when no live snapshot exists',()=>{
 assert.equal(visibleSession(null,catalog),null);
 assert.equal(POLICY.visibleSession,'READ_ONLY');
 assert.doesNotThrow(()=>assertCommand('scan'));
 assert.throws(()=>assertCommand('scan-enemy'));
});
