const fs = require('node:fs/promises');
const path = require('node:path');
const { gunzipSync } = require('node:zlib');
const {safeFetch,boundedBody}=require('../desktop/safe-http.cjs');
const {JsonCache}=require('../desktop/json-cache.cjs');
const {CatalogStore}=require('../desktop/catalog-store.cjs');
const {validateCatalog,validateDragon,cdAugments,cdLists}=require('../core/data-validation.cjs');

async function get(url, binary = false) {
  const r = await safeFetch(url, {hosts:['tessdata.projectnaptha.com'], signal: AbortSignal.timeout(45000) });
  if (!r.ok) throw new Error(`Nguồn dữ liệu trả ${r.status}: ${new URL(url).hostname}`);
  const body=await boundedBody(r,32000000);return binary ? body : JSON.parse(body.toString('utf8'));
}
function plain(s = '') { return s.replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&'); }
async function updateData(dir, requestedPatch, onProgress = () => {}) {
  await fs.mkdir(dir, { recursive: true });
  const cache=new JsonCache(path.join(dir,'http-cache'));
  const versions = await cache.get('https://ddragon.leagueoflegends.com/api/versions.json',v=>{if(!Array.isArray(v)||!v.some(x=>/^\d+\.\d+\.\d+$/.test(x)))throw Error('Danh sách phiên bản không hợp lệ.');return v.filter(x=>/^\d+\.\d+\.\d+$/.test(x));});
  const patch = requestedPatch && /^\d+\.\d+$/.test(requestedPatch) ? requestedPatch : versions[0].split('.').slice(0, 2).join('.');
  const version = versions.find(v => v.startsWith(patch + '.'));
  if (!version) throw new Error('Chưa có gói dữ liệu cho phiên bản ' + patch);
  const dd = `https://ddragon.leagueoflegends.com/cdn/${version}/data/`;
  const cd = `https://raw.communitydragon.org/${patch}`;
  onProgress('Đang tải danh mục tiếng Việt…');
  const [champs, items, itemsEn, augVi, augEn, lists, descriptions] = await Promise.all([
    cache.get(dd + 'vi_VN/champion.json',v=>validateDragon(v,version,'champion','vi_VN'),{immutable:true}),
    cache.get(dd + 'vi_VN/item.json',v=>validateDragon(v,version,'item','vi_VN'),{immutable:true}),
    cache.get(dd + 'en_US/item.json',v=>validateDragon(v,version,'item','en_US'),{immutable:true}),
    cache.get(cd + '/plugins/rcp-be-lol-game-data/global/vi_vn/v1/cherry-augments.json',v=>cdAugments.parse(v)),
    cache.get(cd + '/plugins/rcp-be-lol-game-data/global/default/v1/cherry-augments.json',v=>cdAugments.parse(v)),
    cache.get(cd + '/plugins/rcp-be-lol-game-data/global/vi_vn/v1/augment-lists.json',v=>cdLists.parse(v)),
    cache.get(cd + '/cdragon/arena/vi_vn.json').catch(() => ({ augments: [] }))
  ]);
  const modes = Object.fromEntries(lists.map(l => [l.modeName, l.augmentList.map(n => n.split('/').pop())]));
  if (!modes.KIWI?.length) throw new Error('Nguồn thiếu danh sách Mayhem KIWI. Giữ dữ liệu cũ.');
  const enById = new Map(augEn.map(a => [a.augmentNameId, a]));
  const descByApi = new Map((descriptions.augments || []).map(a => [a.apiName, a]));
  const augments = augVi.filter(a => modes.KIWI.includes(a.augmentNameId)).map(a => {
    const desc = descByApi.get(a.augmentNameId);
    return { id: a.augmentNameId, numericId: a.id, name: a.nameTRA, en: enById.get(a.augmentNameId)?.nameTRA || a.augmentNameId,
      rarity: a.rarity.replace('k', ''), icon: cd + '/plugins/rcp-be-lol-game-data/global/default/' + a.augmentSmallIconPath.replace('/lol-game-data/assets/', '').toLowerCase(),
      description: desc ? plain(desc.desc || desc.tooltip).replace(/@[^@]+@/g, '[giá trị theo game]') : '',
      descriptionSource: desc ? 'CommunityDragon; cần đối chiếu tooltip Mayhem' : '',
      modes: Object.entries(modes).filter(([, v]) => v.includes(a.augmentNameId)).map(([k]) => k) };
  });
  if (augments.length < 100) throw new Error('Danh mục lõi thiếu bất thường; giữ bản trước.');
  if(augments.length!==new Set(modes.KIWI).size||augments.some(a=>!enById.has(a.id)))throw Error('Danh sách KIWI và tên lõi chưa đồng nhất; giữ bản trước.');
  const itemData = Object.fromEntries(Object.entries(items.data).map(([id, a]) => [id, { ...a, id, en: itemsEn.data[id]?.name || a.name,
    plain: plain(a.description), english: plain(itemsEn.data[id]?.description), icon: `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${id}.png` }]));
  const champions = Object.fromEntries(Object.values(champs.data).map(c => [c.id, { id: c.id, key: c.key, name: c.name, tags: c.tags, info: c.info, stats: c.stats, icon: `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${c.id}.png` }]));
  const result = { schema: 1, version, patch, fetchedAt: new Date().toISOString(), champions, items: itemData, augments,
    sources: ['https://developer.riotgames.com/docs/lol#data-dragon', cd + '/plugins/rcp-be-lol-game-data/global/vi_vn/v1/augment-lists.json', cd + '/plugins/rcp-be-lol-game-data/global/vi_vn/v1/cherry-augments.json'],
    assessment: 'Điểm theo quy tắc v0.1; không phải tỷ lệ thắng hoặc tier được kiểm chứng cho mọi tướng.' };
  validateCatalog(result);
  await new CatalogStore(dir).publish(result);
  onProgress(`Đã cập nhật ${augments.length} lõi, ${Object.keys(champions).length} tướng.`);
  return result;
}
async function downloadLanguages(dir) {
  const dest = path.join(dir, 'ocr'); await fs.mkdir(dest, { recursive: true });
  for (const lang of ['vie', 'eng']) {
    const file = path.join(dest, `${lang}.traineddata`);
    try { await fs.access(file); } catch {
      const data = await get(`https://tessdata.projectnaptha.com/4.0.0/${lang}.traineddata.gz`, true);
      await fs.writeFile(file, gunzipSync(data,{maxOutputLength:64000000}));
    }
  }
}
if (require.main === module) {
  const dir = path.join(__dirname, '..', 'data');
  updateData(dir, process.argv[2], console.log).then(() => downloadLanguages(dir)).catch(e => { console.error(e.message); process.exitCode = 1; });
}
module.exports = { updateData, downloadLanguages, plain };
