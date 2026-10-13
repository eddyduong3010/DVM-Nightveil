const { z } = require('zod');
const text = z.string().min(1);
const patch = z.string().regex(/^\d+\.\d+$/);
const version = z.string().regex(/^\d+\.\d+\.\d+$/);
const record = schema => z.record(z.string(), schema);
const championSchema = z.object({id:text,key:z.union([text,z.number()]),name:text,tags:z.array(text),stats:record(z.number())}).passthrough();
// Data Dragon contains unused/hidden item records with an empty name. A
// purchasable Howling Abyss item must still have a name in both languages.
const itemSchema = z.object({name:z.string(),gold:z.object({total:z.number().nonnegative(),purchasable:z.boolean()}).passthrough(),maps:record(z.boolean()),tags:z.array(text),stats:record(z.number()),from:z.array(text).optional()}).passthrough().refine(i=>!(i.maps['12']&&i.gold.purchasable&&i.inStore!==false)||i.name.trim().length>0,{message:'Trang bị có thể mua trên ARAM thiếu tên.'});
const augmentSchema = z.object({id:text,numericId:z.number().int().positive(),name:text,en:text,rarity:z.enum(['Silver','Gold','Prismatic']),modes:z.array(text).refine(v=>v.includes('KIWI'))}).passthrough();
const catalogSchema = z.object({schema:z.literal(1),version,patch,fetchedAt:z.string().datetime(),champions:record(championSchema),items:record(itemSchema),augments:z.array(augmentSchema).min(100)}).passthrough();
function validateCatalog(input) {
  const parsed = catalogSchema.safeParse(input);
  if (!parsed.success) throw Error('Danh mục sai cấu trúc: '+parsed.error.issues[0].path.join('.'));
  const data=parsed.data;
  if (!data.version.startsWith(data.patch+'.')) throw Error('Danh mục không đồng nhất bản vá.');
  if (Object.keys(data.champions).length<100 || Object.keys(data.items).length<100) throw Error('Danh mục tướng/trang bị thiếu bất thường.');
  if (new Set(data.augments.map(a=>a.id)).size!==data.augments.length || new Set(data.augments.map(a=>a.numericId)).size!==data.augments.length) throw Error('Danh mục có mã lõi trùng; giữ bản trước.');
  return data;
}
function validateDragon(input, expectedVersion, kind, locale) {
  const schema=z.object({version:z.literal(expectedVersion),data:record(kind==='champion'?championSchema:itemSchema)}).passthrough();
  const out=schema.safeParse(input);
  if(!out.success)throw Error(`Dữ liệu ${kind} ${locale} sai cấu trúc hoặc bản vá: ${out.error.issues[0].path.join('.')}.`);
  if(Object.keys(out.data.data).length<100)throw Error(`Dữ liệu ${kind} ${locale} thiếu bất thường.`);
  return out.data;
}
// The source also contains non-KIWI records. Enforce KIWI rarities after filtering.
const cdAugments=z.array(z.object({id:z.number().int().positive(),augmentNameId:text,nameTRA:text,rarity:text,augmentSmallIconPath:text}).passthrough());
const cdLists=z.array(z.object({modeName:text,augmentList:z.array(text)}).passthrough());
module.exports={validateCatalog,validateDragon,cdAugments,cdLists};
