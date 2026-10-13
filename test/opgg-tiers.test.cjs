const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {parseOpggAugments,rowTier}=require('../desktop/opgg.cjs');
const {augmentAdvice}=require('../core/engine.cjs');
const data=require('../data/catalog.json');
const html=fs.readFileSync(path.join(__dirname,'fixtures/opgg-gragas-16.20.html'),'utf8');
test('real OP.GG tier glyphs include E and exact tiers survive list order changes',()=>{
 const parsed=parseOpggAugments(html,'Gragas','16.20',data.augments);
 assert.equal(parsed.tiers.ChainReaction,'S');assert.equal(parsed.tiers.ARAM_JeweledGauntlet,'A');
 assert.equal(parsed.tiers.ARAM_WithHaste,'A');
 assert.ok(Object.values(parsed.tiers).includes('E'));
 assert.ok(Object.keys(parsed.icons).length>150);
 assert.ok(parsed.ambiguousIcons.some(ids=>ids.length>1));
 assert.equal(rowTier('<svg><path d="unknown future glyph"/></svg>'),null);
 const unknown=html.replaceAll('M15 6.5v1.75h-2V7.5l-.5-.5h-1l-.5.5v1l.5.5h2l1.5 1.5v3L13.5 15h-3L9 13.5v-1.75h2v.75l.5.5h1l.5-.5v-1l-.5-.5h-2L9 9.5v-3L10.5 5h3z','new-glyph');
 assert.equal(parseOpggAugments(unknown,'Gragas','16.20',data.augments).tiers.ChainReaction,undefined);
});
test('source tier stays exact while suitability score can change with enemies',()=>{
 const reference={parserVersion:2,champion:'Caitlyn',patch:data.patch,total:3,ranks:{GlassCannon:1},tiers:{GlassCannon:'S'}};
 const neutral=augmentAdvice(data,'Caitlyn',[],['GlassCannon'],'auto',{referenceAugments:reference}).offers[0];
 const danger=augmentAdvice(data,'Caitlyn',[],['GlassCannon'],'auto',{referenceAugments:reference,enemyThreats:['Blitzcrank','Anivia','Pantheon'].map(champion=>({champion}))}).offers[0];
 assert.equal(neutral.sourceTier,'S');assert.equal(danger.tier,'S');assert.ok(danger.score<neutral.score);
 const unknown=augmentAdvice(data,'Gragas',[],['ChainReaction'],'auto',{referenceAugments:{...reference,champion:'Gragas',ranks:{ChainReaction:1},tiers:{}}}).offers[0];
 assert.equal(unknown.sourceTier,undefined);assert.equal(unknown.tier,'?');
});
