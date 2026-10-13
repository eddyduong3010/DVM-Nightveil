const BASE = 'https://op.gg/lol/modes/aram-mayhem/';
const {safeFetch,boundedBody}=require('./safe-http.cjs');
const {normalize}=require('../core/engine.cjs');
const {glyphs}=require('../data/opgg-tier-glyphs.json');
const glyphTiers=new Map(Object.entries(glyphs).map(([tier,path])=>[path.replace(/\s+/g,' ').trim(),tier]));
function rowTier(row){
 // Decode only glyphs observed on the source. Unknown markup stays unclassified.
 for(const [,svg] of row.matchAll(/<svg\b[^>]*>([\s\S]*?)<\/svg>/g)){
  for(const [,d] of svg.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)){
   const tier=glyphTiers.get(d.replace(/\s+/g,' ').trim());if(tier)return tier;
  }
 }
 return null;
}

function championSlug(id) {
  return String(id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function itemRows(html, caption) {
  const start = html.indexOf(`<caption>${caption}</caption>`);
  if (start < 0) return [];
  const end = html.indexOf('</table>', start);
  if (end < 0) return [];
  const table = html.slice(start, end);
  return [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)]
    .map(([, row]) => [...new Set([...row.matchAll(/\/item\/(\d+)\.png/g)].map(m => m[1]))])
    .filter(row => row.length);
}

function parseOpggBuild(html, champion, expectedPatch) {
  const patch = html.match(/ARAM Build &amp; Runes[\s\S]{0,1500}?Patch\s+(\d+\.\d+)/)?.[1]
    || html.match(/Patch\s+(\d+\.\d+)/)?.[1];
  if (!patch || patch !== expectedPatch) return null;
  const builds = itemRows(html, 'Builds Table').filter(row => row.length >= 3).slice(0, 5);
  if (!builds.length) return null;
  return { source: 'OP.GG', patch, champion, url: BASE + championSlug(champion) + '/build', fetchedAt: Date.now(), builds, boots: itemRows(html, 'Boots Table').flat().slice(0, 3) };
}

async function fetchOpggBuild(champion, patch) {
  const url = BASE + championSlug(champion) + '/build';
  const response = await safeFetch(url, { hosts:['op.gg'],signal: AbortSignal.timeout(8000), headers: { 'accept': 'text/html' } });
  if (!response.ok) throw new Error(`OP.GG HTTP ${response.status}`);
  return parseOpggBuild((await boundedBody(response,8000000)).toString('utf8'), champion, patch);
}

function decodeHtml(value){
  return value.replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)))
    .replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)))
    .replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&apos;/g,"'");
}

function parseOpggAugments(html,champion,expectedPatch,augments){
  const patch=html.match(/Patch\s+(\d+\.\d+)/)?.[1];
  if(patch!==expectedPatch)return null;
  const start=html.indexOf('<ul class="w-full">');
  const end=html.indexOf('</ul>',start);
  if(start<0||end<0)return null;
  const rows=[...html.slice(start,end).matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)];
  if(rows.length<20)return null;
  const byName=new Map(augments.map(a=>[normalize(a.en),a.id]));
  const ranks={},tiers={},icons={},unmatched=[];
  rows.forEach(([,row],index)=>{
    const img=row.match(/<img\b[^>]*>/)?.[0]||'';
    const name=img.match(/\balt="([^"]+)"/)?.[1];
    const id=name&&byName.get(normalize(decodeHtml(name)));
    if(!id){if(name)unmatched.push(decodeHtml(name));return;}
    if(ranks[id]!==undefined)return;
    ranks[id]=index+1;
    const tier=rowTier(row);if(tier)tiers[id]=tier;
    const raw=img.match(/\bsrc="([^"]+)"/)?.[1];
    if(raw){try{const url=new URL(decodeHtml(raw));if(url.protocol==='https:'&&url.hostname==='opgg-static.akamaized.net'&&url.pathname.includes('/aram-augment/'))icons[id]=url.href;}catch{}}
  });
  if(Object.keys(ranks).length<20)return null;
  const groups={};for(const [id,icon] of Object.entries(icons)){const key=new URL(icon).pathname;(groups[key]??=[]).push(id);}
  const ambiguousIcons=Object.values(groups).filter(ids=>ids.length>1);
  return {parserVersion:2,source:'OP.GG',patch,champion,url:BASE+championSlug(champion)+'/augments',fetchedAt:Date.now(),total:rows.length,ranks,tiers,icons,ambiguousIcons,unmatched};
}

async function fetchOpggAugments(champion,patch,augments){
  const response=await safeFetch(BASE+championSlug(champion)+'/augments',{hosts:['op.gg'],signal:AbortSignal.timeout(15000),headers:{accept:'text/html'}});
  if(!response.ok)throw new Error(`OP.GG HTTP ${response.status}`);
  return parseOpggAugments((await boundedBody(response,8000000)).toString('utf8'),champion,patch,augments);
}

module.exports = { championSlug, parseOpggBuild, fetchOpggBuild, parseOpggAugments, fetchOpggAugments, rowTier };
