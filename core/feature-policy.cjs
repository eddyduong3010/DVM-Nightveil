'use strict';
const POLICY=Object.freeze({version:3,visibleSession:'READ_ONLY',liveAdvice:'LOCAL_EXPERIMENTAL',liveOCR:'VISIBLE_SELF_ONLY',enemyAugments:'UNAVAILABLE',overlay:'VISIBLE_SELF_AND_MATCH',opgg:'PUBLIC_TIER_CACHE',reviewedAt:'2026-10-14'});
const BLOCKED=new Set(['scan-enemy','enemy-augments']);
function assertCommand(type){if(BLOCKED.has(type))throw Error('Không có nguồn quan sát lõi đối thủ; không suy đoán dữ liệu ẩn.');}
module.exports={POLICY,assertCommand};
