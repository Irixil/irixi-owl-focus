'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{createHash}=require('node:crypto');
const {initialState,validateState}=require('../src/core.cjs'),{FileStore}=require('../src/store.cjs'),{FocusService}=require('../src/service.cjs');
function legacy(){
 const s=initialState();s.schema=2;delete s.settledFocusMs;s.totalFocusMs=620000;s.creditedMinutes=10;s.unlocked=['round-glasses','reading-chair'];s.equipment={accessory:'round-glasses',room:'reading-chair'};s.preferences.reducedMotion=true;s.processed=['already-saved'];
 s.records=[{id:'synthetic-ended',task:'Synthetic legacy record',startedAt:1000,endedAt:601000,durationMs:600000,focusMs:600000,outcome:'completed',marksEarned:10}];
 s.active={id:'synthetic-active',task:'Synthetic recovery',kind:'focus',status:'paused',durationMs:60000,elapsedMs:20000,startedAt:601000,startCreditedMinutes:10,reason:'paused'};s.lastSavedAt=621000;return s;
}
test('Archive old bytes before replacing history, preserve rewards/equipment/active and never recreate history',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'owl-history-synthetic-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const file=path.join(dir,'focus-state.json'),raw=legacy(),bytes=JSON.stringify(raw,null,2);fs.writeFileSync(file,bytes);
 const store=new FileStore(dir);t.after(()=>store.close());const s=store.read();const hash=createHash('sha256').update(bytes).digest('hex'),backup=path.join(dir,`focus-state.schema2-${hash}.json`);
 assert.equal(fs.readFileSync(backup,'utf8'),bytes);assert.equal(s.schema,3);assert.equal('records' in s,false);assert.equal(s.settledFocusMs,600000);for(const key of ['totalFocusMs','creditedMinutes','unlocked','equipment','active','preferences','processed','lastSavedAt'])assert.deepEqual(s[key],raw[key]);
 let mono=0;const svc=new FocusService(store,{clock:()=>({mono,wall:621000+mono})});assert.equal(svc.snapshot().active.id,raw.active.id);assert.equal(svc.snapshot().active.status,'paused');svc.dispatch({type:'resume',requestId:'resume',sessionId:raw.active.id});
 for(let n=0;n<4;n++){mono+=10000;svc.tick();}const done=svc.snapshot();assert.equal(done.active,null);assert.equal(done.totalFocusMs,660000);assert.equal(done.settledFocusMs,660000);assert.equal(done.creditedMinutes,11);assert.equal(done.lastOutcome.outcome,'completed');assert.equal('records' in done,false);assert.equal('records' in JSON.parse(fs.readFileSync(file)),false);assert.equal(fs.readFileSync(backup,'utf8'),bytes);validateState(done);
 svc.close();const reopen=new FileStore(dir);try{assert.equal(reopen.read().settledFocusMs,660000);}finally{reopen.close();}
});
test('Backup conflict and migration save failure preserve source byte-for-byte',t=>{
 for(const failure of ['backup','save']){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'owl-history-failure-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const bytes=JSON.stringify(legacy()),file=path.join(dir,'focus-state.json');fs.writeFileSync(file,bytes);const store=new FileStore(dir);try{
 if(failure==='backup'){const hash=createHash('sha256').update(bytes).digest('hex');fs.writeFileSync(path.join(dir,`focus-state.schema2-${hash}.json`),'conflict');}else store.write=()=>{throw Error('synthetic full disk');};
 assert.throws(()=>store.read());assert.equal(fs.readFileSync(file,'utf8'),bytes);
 }finally{store.close();}}
});
test('Malformed legacy rewards/history rejected before migration and current totals remain checked',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'owl-history-invalid-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const s=legacy();s.records[0].focusMs--;const bytes=JSON.stringify(s),file=path.join(dir,'focus-state.json');fs.writeFileSync(file,bytes);const store=new FileStore(dir);try{assert.throws(()=>store.read());assert.equal(fs.readFileSync(file,'utf8'),bytes);assert.equal(fs.readdirSync(dir).some(n=>n.startsWith('focus-state.schema2-')),false);}finally{store.close();}
 assert.throws(()=>validateState({...initialState(),settledFocusMs:1}));assert.throws(()=>validateState({...initialState(),records:[]}));
});

test('Malformed UTF-8 never migrates or rewrites original legacy/current bytes',t=>{
 for(const schema of [2,3]){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'owl-invalid-utf8-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const state=schema===2?legacy():initialState();state.processed=['synthetic-encoding-marker'];
  const text=Buffer.from(JSON.stringify(state)),marker=Buffer.from('synthetic-encoding-marker'),index=text.indexOf(marker);assert.ok(index>=0);
  const bytes=Buffer.concat([text.subarray(0,index),Buffer.from([0xff]),text.subarray(index+marker.length)]),file=path.join(dir,'focus-state.json');fs.writeFileSync(file,bytes);
  const store=new FileStore(dir);try{assert.throws(()=>store.read(),/UTF-8/);assert.deepEqual(fs.readFileSync(file),bytes);assert.equal(fs.readdirSync(dir).some(n=>n.startsWith('focus-state.schema')),false);}finally{store.close();}
 }
});
test('Valid multilingual legacy backup preserves raw bytes and is reusable unchanged',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'owl-utf8-backup-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const state=legacy();state.records[0].task='合成中文 · café · 🦉';const bytes=Buffer.from(JSON.stringify(state,null,2)+'\n'),hash=createHash('sha256').update(bytes).digest('hex');
 const file=path.join(dir,'focus-state.json'),backup=path.join(dir,`focus-state.schema2-${hash}.json`);fs.writeFileSync(file,bytes);fs.writeFileSync(backup,bytes);
 const store=new FileStore(dir);try{assert.equal(store.read().schema,3);assert.deepEqual(fs.readFileSync(backup),bytes);}finally{store.close();}
});

function failDirectorySyncAfterReplace(file,action){
 const rename=fs.renameSync,sync=fs.fsyncSync;let replaced=false;
 fs.renameSync=(from,to)=>{const result=rename(from,to);if(to===file)replaced=true;return result;};
 fs.fsyncSync=fd=>{if(replaced&&fs.fstatSync(fd).isDirectory())throw Object.assign(Error('synthetic directory sync EIO'),{code:'EIO'});return sync(fd);};
 try{return action();}finally{fs.renameSync=rename;fs.fsyncSync=sync;}
}
test('Post-rename migration sync failure reports replacement honestly and retains exact backup',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'owl-migration-post-rename-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const bytes=Buffer.from(JSON.stringify(legacy())),file=path.join(dir,'focus-state.json'),hash=createHash('sha256').update(bytes).digest('hex');fs.writeFileSync(file,bytes);
 const store=new FileStore(dir);try{
  failDirectorySyncAfterReplace(file,()=>assert.throws(()=>store.read(),error=>/存档已替换/.test(error.message)&&!/未覆盖原文件/.test(error.message)));
  assert.equal(JSON.parse(fs.readFileSync(file)).schema,3);assert.deepEqual(fs.readFileSync(path.join(dir,`focus-state.schema2-${hash}.json`)),bytes);
 }finally{store.close();}
});
test('Post-rename normal save stops timing with an unconfirmed-durability warning',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'owl-save-post-rename-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const store=new FileStore(dir),svc=new FocusService(store,{clock:()=>({mono:0,wall:1000})});try{
  failDirectorySyncAfterReplace(store.file,()=>assert.throws(()=>svc.dispatch({type:'preferences',requestId:'synthetic-save',reducedMotion:true}),error=>error.focusStateReplaced===true));
  assert.match(svc.snapshot().fault,/存档文件已替换，但未能确认落盘/);assert.throws(()=>svc.dispatch({type:'start',requestId:'blocked',task:'synthetic',seconds:1}));
  assert.equal(JSON.parse(fs.readFileSync(store.file)).preferences.reducedMotion,true);assert.equal(svc.snapshot().preferences.reducedMotion,false);
 }finally{svc.close();}
});
