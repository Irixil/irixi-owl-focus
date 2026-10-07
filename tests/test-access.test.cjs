'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {initialState,validateState,command,advance}=require('../src/core.cjs');
const {CATALOG,itemStates,displayEquipment}=require('../src/collection.cjs');
const {FileStore}=require('../src/store.cjs'),{FocusService}=require('../src/service.cjs');
const cmd=(s,type,extra={})=>command(s,{type,requestId:crypto.randomUUID(),...extra},1234,()=> 'trial-round');
test('zero-focus trial independently equips every existing item without granting earned ownership; off restores normal slots',()=>{
 const s=initialState(),normal=structuredClone(s.equipment);cmd(s,'test-access',{enabled:true});
 for(const i of CATALOG.items.filter(i=>i.assetState!=='missing')){const candidate=structuredClone(s);candidate.testAccess.equipment=structuredClone(normal);candidate.testAccess.positions={};cmd(candidate,'equip',{slot:i.category,item:i.id});assert.equal(displayEquipment(candidate)[i.category],i.id);validateState(candidate);Object.assign(s,candidate);}
 assert.equal(s.totalFocusMs,0);assert.equal(s.creditedMinutes,0);assert.deepEqual(s.collection.owned,[]);assert.deepEqual(s.unlocked,[]);assert.deepEqual(s.equipment,normal);
 assert(itemStates(s).filter(i=>i.assetState!=='missing').every(i=>i.canEquip));assert(itemStates(s).filter(i=>i.assetState==='missing').every(i=>!i.testAvailable));assert(itemStates(s).some(i=>i.testAvailable&&!i.owned));
 const testEquipment=structuredClone(s.testAccess.equipment);cmd(s,'test-access',{enabled:false});assert.deepEqual(displayEquipment(s),normal);assert.deepEqual(s.testAccess.equipment,testEquipment);
 assert.throws(()=>cmd(s,'equip',{slot:'chair',item:'chair-sage'}),/没有解锁/);cmd(s,'test-access',{enabled:true});assert.deepEqual(displayEquipment(s),testEquipment);
});
test('trial access preserves an earned normal outfit and running session; real time alone still earns normally',()=>{
 const s=initialState();cmd(s,'start',{task:'Synthetic trial regression',minutes:180});advance(s,600000,600000);cmd(s,'pause',{sessionId:s.active.id});cmd(s,'equip',{slot:'chair',item:'reading-chair'});cmd(s,'equip',{slot:'accessory',item:'round-glasses'});
 const normal=structuredClone(s.equipment),active=structuredClone(s.active),owned=[...s.collection.owned];cmd(s,'test-access',{enabled:true});cmd(s,'equip',{slot:'chair',item:'chair-sage'});cmd(s,'equip',{slot:'accessory',item:'red-scarf'});
 assert.deepEqual(s.active,active);assert.equal(s.totalFocusMs,600000);assert.deepEqual(s.collection.owned,owned);cmd(s,'test-access',{enabled:false});assert.deepEqual(s.equipment,normal);assert.deepEqual(displayEquipment(s),normal);
 cmd(s,'test-access',{enabled:true});cmd(s,'resume',{sessionId:s.active.id});advance(s,300000,900000);assert(s.collection.owned.includes('lamp-linen'));assert(!s.collection.owned.includes('chair-sage'));assert.equal(s.totalFocusMs,900000);
});
test('trial cannot equip missing or wrong-category art and corrupt trial data cannot become an empty save',()=>{
 const s=initialState();cmd(s,'test-access',{enabled:true});const c=structuredClone(CATALOG);c.items.find(i=>i.id==='plant-leaf').assetState='missing';
 assert.throws(()=>command(s,{type:'equip',slot:'plant',item:'plant-leaf',requestId:'missing'},0,undefined,c),/素材待准备/);
 assert.throws(()=>cmd(s,'equip',{slot:'chair',item:'lamp-linen'}),/类别/);assert.throws(()=>cmd(s,'test-access',{enabled:'true'}),/开关无效/);
 for(const bad of [null,{enabled:true,equipment:{}},{enabled:'true',equipment:s.equipment},{enabled:true,equipment:{...s.equipment,chair:'lamp-linen',room:'lamp-linen'}}])assert.throws(()=>validateState({...s,testAccess:bad}),/体验/);
});
test('first enable backs up exact bytes, startup is immediately all-access, reopen retains trial and disabling persists',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'owl-test-access-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const normal=initialState(),bytes=Buffer.from(JSON.stringify(normal,null,2)+'\n');fs.writeFileSync(path.join(dir,'focus-state.json'),bytes);
 let svc=new FocusService(new FileStore(dir),{startWithAllItems:true,clock:()=>({mono:0,wall:1000})});assert(svc.snapshot().testAccess.enabled);svc.dispatch({type:'equip',slot:'chair',item:'chair-sage',requestId:'trial-chair'});const selected=structuredClone(svc.snapshot().testAccess.equipment);svc.close();
 const backups=fs.readdirSync(dir).filter(n=>n.startsWith('focus-state.before-test-access-'));assert.equal(backups.length,1);assert(fs.readFileSync(path.join(dir,backups[0])).equals(bytes));
 svc=new FocusService(new FileStore(dir),{clock:()=>({mono:0,wall:999999})});assert(svc.snapshot().testAccess.enabled);assert.deepEqual(svc.snapshot().testAccess.equipment,selected);assert.deepEqual(svc.snapshot().collection.owned,[]);assert.equal(svc.snapshot().totalFocusMs,0);svc.dispatch({type:'test-access',enabled:false,requestId:'trial-off'});svc.close();
 svc=new FocusService(new FileStore(dir),{startWithAllItems:true,clock:()=>({mono:0,wall:9999999})});assert.equal(svc.snapshot().testAccess.enabled,false);assert.deepEqual(displayEquipment(svc.snapshot()),normal.equipment);assert.throws(()=>svc.dispatch({type:'equip',slot:'chair',item:'chair-sage',requestId:'normal-lock'}),/没有解锁/);svc.close();
});
test('backup conflict stops enable and preserves actual original bytes instead of granting partial access',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'owl-test-access-conflict-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const bytes=Buffer.from(JSON.stringify(initialState())),digest=crypto.createHash('sha256').update(bytes).digest('hex');fs.writeFileSync(path.join(dir,'focus-state.json'),bytes);fs.writeFileSync(path.join(dir,'focus-state.before-test-access-'+digest+'.json'),'conflicting backup');
 const svc=new FocusService(new FileStore(dir),{clock:()=>({mono:0,wall:1000})});assert.throws(()=>svc.dispatch({type:'test-access',enabled:true,requestId:'conflict'}),/备份/);assert(!svc.snapshot().testAccess?.enabled);assert(svc.snapshot().fault);assert(fs.readFileSync(path.join(dir,'focus-state.json')).equals(bytes));svc.close();
});
test('renderer uses trial outfit while saved earned outfit remains intact and off returns the original',async()=>{
 const {resolveAppearance,GLASSES_KEYS}=await import('../ui/equipment-view.mjs'),s=initialState();cmd(s,'test-access',{enabled:true});cmd(s,'equip',{slot:'chair',item:'chair-sage'});cmd(s,'equip',{slot:'accessory',item:'round-glasses'});
 const images={roomBase:{},roomItems:{'chair-sage':{back:{},front:{}}},...Object.fromEntries(GLASSES_KEYS.map(k=>[k,{}]))};s.collectionCatalog={items:itemStates(s)};const look=resolveAppearance(s,images);assert.equal(look.room,'chair-sage');assert.equal(look.accessory,'round-glasses');assert.equal(s.equipment.chair,'stool');assert.deepEqual(s.collection.owned,[]);cmd(s,'test-access',{enabled:false});assert.equal(resolveAppearance(s,images).room,'stool');assert.equal(resolveAppearance(s,images).accessory,null);
});
