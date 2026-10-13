'use strict';
const POLICY=Object.freeze({version:1,liveAdvice:'DISABLED_UNTIL_APPROVED',liveOCR:'DISABLED_UNTIL_APPROVED',enemyAugments:'UNAVAILABLE',overlay:'STATIC_REFERENCE_ONLY',opgg:'DISABLED_PERMISSION_UNRESOLVED',reviewedAt:'2026-10-14'});
const BLOCKED=new Set(['scan','scan-enemy','tab-diagnostic','diagnostic-arm','target-item','offers','owned-add','owned-remove','enemy-augments']);
function assertCommand(type){if(BLOCKED.has(type))throw Error('DISABLED_UNTIL_APPROVED · Chức năng live đã khóa. Dùng Build Lab ngoại tuyến.');}
module.exports={POLICY,assertCommand};
