export type DamageKind = 'physical' | 'magic' | 'true' | 'heal' | 'shield';
export interface UserEffect {
 id: string; type: DamageKind; base: number; apRatio: number; adRatio: number;
 count: number; cooldown: number; icd: number; condition: boolean;
 source: 'USER_ASSUMPTION';
}
export function userEffect(raw: Partial<UserEffect>): UserEffect {
 const number=(v:unknown,fallback:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=0?v:fallback;
 return {id:typeof raw.id==='string'?raw.id.slice(0,80):'user-effect',type:['physical','magic','true','heal','shield'].includes(raw.type||'')?raw.type!:'magic',base:number(raw.base,0),apRatio:number(raw.apRatio,0),adRatio:number(raw.adRatio,0),count:number(raw.count,1),cooldown:number(raw.cooldown,0),icd:number(raw.icd,0),condition:raw.condition!==false,source:'USER_ASSUMPTION'};
}
export interface BuildSelection {id:string; name:string; items:string[]; augments:string[]}
export function selectionDiff(before:BuildSelection,after:BuildSelection){return {
 itemsAdded:after.items.filter(id=>!before.items.includes(id)),itemsRemoved:before.items.filter(id=>!after.items.includes(id)),
 augmentsAdded:after.augments.filter(id=>!before.augments.includes(id)),augmentsRemoved:before.augments.filter(id=>!after.augments.includes(id))
};}
