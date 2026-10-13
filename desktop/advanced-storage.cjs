'use strict';
const {randomUUID}=require('node:crypto');
const VERSION=3;
function migrate(db,backup){
 const version=db.prepare('PRAGMA user_version').get().user_version;if(version>VERSION)throw Error('CSDL từ phiên bản mới hơn; không ghi đè.');if(version===VERSION)return;
 backup();db.exec('BEGIN IMMEDIATE');try{db.exec(`
 CREATE TABLE IF NOT EXISTS saved_builds(id TEXT PRIMARY KEY,payload TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS build_versions(build_id TEXT NOT NULL REFERENCES saved_builds(id) ON DELETE CASCADE,version INTEGER NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(build_id,version));
 CREATE TABLE IF NOT EXISTS personal_profile(id INTEGER PRIMARY KEY CHECK(id=1),payload TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS practice_history(id TEXT PRIMARY KEY,payload TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS community_drafts(id TEXT PRIMARY KEY,payload TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS patch_reports(id TEXT PRIMARY KEY,payload TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS saved_simulations(id TEXT PRIMARY KEY,payload TEXT NOT NULL,created_at TEXT NOT NULL,invalidated INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS migration_history(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL);
 PRAGMA user_version=3;`);db.prepare('INSERT OR IGNORE INTO migration_history VALUES(?,?)').run(VERSION,new Date().toISOString());db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
}
function run(db,body){
 if(!body||typeof body!=='object'||JSON.stringify(body).length>2e6)throw Error('Dữ liệu lưu quá lớn hoặc không hợp lệ.');
 const {action,payload={}}=body,now=new Date().toISOString();
 if(action==='workspace'){db.prepare('INSERT OR REPLACE INTO metadata VALUES(?,?)').run('advanced-workspace',JSON.stringify(payload));return true;}
 if(action==='workspace-load')return JSON.parse(db.prepare('SELECT value FROM metadata WHERE key=?').get('advanced-workspace')?.value||'null');
 if(action==='simulation'){const id=randomUUID();db.prepare('INSERT INTO saved_simulations VALUES(?,?,?,0)').run(id,JSON.stringify({...payload,id}),now);return id;}
 if(action==='simulations')return db.prepare('SELECT * FROM saved_simulations ORDER BY created_at DESC LIMIT 100').all().map(r=>({...JSON.parse(r.payload),invalidated:!!r.invalidated,createdAt:r.created_at}));
 if(action==='invalidate-simulations'){for(const r of db.prepare('SELECT id,payload FROM saved_simulations WHERE invalidated=0').all()){const sim=JSON.parse(r.payload);if(sim.builds?.some(b=>payload.ids.includes(b.id)))db.prepare('UPDATE saved_simulations SET invalidated=1 WHERE id=?').run(r.id);}return true;}
 if(action==='load')return {builds:db.prepare('SELECT * FROM saved_builds ORDER BY updated_at DESC LIMIT 1000').all().map(r=>({...JSON.parse(r.payload),id:r.id,createdAt:r.created_at,updatedAt:r.updated_at})),profile:JSON.parse(db.prepare('SELECT payload FROM personal_profile WHERE id=1').get()?.payload||'{}'),practice:db.prepare('SELECT payload FROM practice_history ORDER BY created_at DESC LIMIT 500').all().map(r=>JSON.parse(r.payload)),submissions:db.prepare('SELECT payload FROM community_drafts ORDER BY created_at DESC LIMIT 500').all().map(r=>JSON.parse(r.payload)),patches:db.prepare('SELECT payload FROM patch_reports ORDER BY created_at DESC LIMIT 10').all().map(r=>JSON.parse(r.payload))};
 if(action==='save-build'){
  const id=payload.id||randomUUID();db.exec('BEGIN IMMEDIATE');try{
   const version=(db.prepare('SELECT MAX(version) AS n FROM build_versions WHERE build_id=?').get(id)?.n||0)+1;
   db.prepare('INSERT INTO saved_builds VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at').run(id,JSON.stringify({...payload,id}),now,now);
   db.prepare('INSERT INTO build_versions VALUES(?,?,?)').run(id,version,JSON.stringify(payload));db.exec('COMMIT');return {id,version};
  }catch(e){db.exec('ROLLBACK');throw e;}
 }
 if(action==='delete-build'){db.prepare('DELETE FROM saved_builds WHERE id=?').run(payload.id);return true;}
 if(action==='versions')return db.prepare('SELECT version,payload FROM build_versions WHERE build_id=? ORDER BY version DESC LIMIT 30').all(payload.id).map(r=>({...r,payload:JSON.parse(r.payload)}));
 if(action==='profile'){db.prepare('INSERT OR REPLACE INTO personal_profile VALUES(1,?)').run(JSON.stringify(payload));return true;}
 if(action==='clear-personalization'){const old=JSON.parse(db.prepare('SELECT payload FROM personal_profile WHERE id=1').get()?.payload||'{}');db.prepare('INSERT OR REPLACE INTO personal_profile VALUES(1,?)').run(JSON.stringify({...old,personalization:false,preferences:{},favorites:[]}));db.exec('DELETE FROM practice_history;');return true;}
 const tables={practice:'practice_history',submission:'community_drafts',patch:'patch_reports'};
 if(tables[action]){const id=payload.id||randomUUID(),value={...payload,id,createdAt:now};db.prepare('INSERT OR REPLACE INTO '+tables[action]+' VALUES(?,?,?)').run(id,JSON.stringify(value),now);return value;}
 if(action==='delete-submission'){db.prepare('DELETE FROM community_drafts WHERE id=?').run(payload.id);return true;}
 throw Error('Lệnh advanced storage không hợp lệ.');
}
module.exports={migrate,run,VERSION};
