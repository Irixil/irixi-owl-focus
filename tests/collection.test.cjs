'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {CATALOG,validateCatalog}=require('../src/collection.cjs');
const {initialState,validateState,migrateState,command,advance}=require('../src/core.cjs');
const {FileStore}=require('../src/store.cjs');
const {FocusService}=require('../src/service.cjs');
const {roomCamera,mapPoint,renderedGeometry,validateRoomCatalog}=require('../ui/room-geometry.cjs');
function catalog(){const c=structuredClone(CATALOG);for(const i of c.items.filter(i=>i.assetState==='missing'&&Number.isInteger(i.proposedMinutes))){i.assetState='ready';i.unlockMinutes=i.proposedMinutes;}return c;}
test('first four categories retain at least two separate registered styles; future categories stay deferred and null thresholds cannot award',()=>{
 const pending=structuredClone(CATALOG);for(const i of pending.items.filter(i=>i.assetState==='ready')){i.assetState='missing';i.unlockMinutes=null;}const s=initialState();command(s,{type:'start',task:'Synthetic ownership',minutes:180,requestId:'start'},0,()=> 'round');advance(s,6000000,6000000,pending);
 assert.deepEqual([...s.collection.owned].sort(),['reading-chair','round-glasses']);
 assert.deepEqual(CATALOG.categories.slice(0,5).map(i=>i.id),['lamp','rug','chair','plant','accessory']);const registered=CATALOG.items.filter(i=>i.scene?.placement&&i.assetState==='ready');assert(registered.length>0);assert(registered.every(i=>i.unlockMinutes===null));for(const category of ['lamp','rug','chair','plant'])assert(CATALOG.items.filter(i=>i.category===category&&i.assetState==='ready'&&!i.scene?.placement).length>=2);
 assert.deepEqual(CATALOG.futureCategories,['wallpaper','floor-tile']);
});
test('permanent ownership survives changed/removed future configuration and more than 128 repeated request IDs; chair and room alias stay coherent',()=>{
 const c=catalog(),s=initialState();command(s,{type:'start',task:'Synthetic permanent rights',minutes:180,requestId:'start'},0,()=> 'round',c);advance(s,900000,900000,c);
 command(s,{type:'equip',slot:'lamp',item:'lamp-linen',requestId:'equip'},900000,undefined,c);
 for(let n=0;n<140;n++)command(s,{type:'preferences',reducedMotion:false,requestId:`noise-${n}`},900000,undefined,c);
 command(s,{type:'equip',slot:'lamp',item:'lamp-linen',requestId:'equip'},900000,undefined,c);assert.equal(s.collection.owned.filter(id=>id==='lamp-linen').length,1);
 const changed=catalog();changed.version='future-config';changed.items=changed.items.filter(i=>i.id!=='lamp-linen');changed.items.find(i=>i.id==='round-glasses').unlockMinutes=1000;
 advance(s,1000,901000,changed);assert.ok(s.collection.owned.includes('lamp-linen'));assert.ok(s.collection.owned.includes('round-glasses'));assert.equal(s.equipment.lamp,'lamp-linen');validateState(s);
 const restored=structuredClone(s);command(restored,{type:'equip',slot:'room',item:'reading-chair',requestId:'chair'},901000,undefined,c);assert.equal(restored.equipment.chair,'reading-chair');
 assert.throws(()=>command(restored,{type:'equip',slot:'plant',item:'lamp-linen',requestId:'wrong'},901000,undefined,c),/类别/);
 assert.throws(()=>command(restored,{type:'equip',slot:'plant',item:'plant-leaf',requestId:'locked'},901000,undefined,c),/没有解锁/);
});
test('schema3 migrates to permanent ownership with original bytes backed up and running session preserved, then reopen pauses without offline credit',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'owl-collection-migration-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const old=initialState();command(old,{type:'start',task:'Synthetic old session',minutes:25,requestId:'start'},1000,()=> 'old');advance(old,601000,602000);command(old,{type:'equip',slot:'room',item:'reading-chair',requestId:'chair'},602000);
 old.schema=3;delete old.positions;delete old.collection;old.equipment={accessory:'red-scarf',room:'reading-chair'};const bytes=JSON.stringify(old,null,2);fs.writeFileSync(path.join(dir,'focus-state.json'),bytes);
 let store=new FileStore(dir);const migrated=store.read();assert.equal(migrated.schema,8);assert.deepEqual(migrated.collection.owned,old.unlocked);assert.equal(migrated.active.id,'old');assert.equal(migrated.active.status,'running');assert.equal(migrated.equipment.chair,'reading-chair');
 const backup=fs.readdirSync(dir).find(i=>i.startsWith('focus-state.schema3-'));assert.equal(fs.readFileSync(path.join(dir,backup),'utf8'),bytes);store.close();
 store=new FileStore(dir);const svc=new FocusService(store,{clock:()=>({mono:0,wall:9999999})});assert.equal(svc.snapshot().active.status,'paused');assert.equal(svc.snapshot().totalFocusMs,601000);assert.deepEqual(svc.snapshot().collection.owned,old.unlocked);svc.close();
 const corrupt={...old,collection:{owned:[]}};assert.throws(()=>migrateState(corrupt),/未知收藏/);
});
test('eight configurable awards/equipment persist atomically and swapping does not change active session or duration',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'owl-collection-save-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const c=catalog();let mono=0;
 const svc=new FocusService(new FileStore(dir),{catalog:c,clock:()=>({mono,wall:1000+mono})});let s=svc.dispatch({type:'start',task:'Synthetic collection E2E',minutes:180,requestId:'start'});const id=s.active.id;
 for(let n=0;n<360;n++){mono+=15000;svc.tick();}for(const i of c.items.filter(i=>i.assetState==='ready'&&i.unlockMinutes!==null)){s=svc.dispatch({type:'equip',slot:i.category,item:i.id,requestId:`equip-${i.id}`});assert.equal(s.active.id,id);assert.equal(s.active.status,'running');assert.equal(s.active.durationMs,10800000);}
 assert.equal(s.collection.owned.length,10);assert.equal(s.totalFocusMs,5400000);svc.close();const reopened=new FocusService(new FileStore(dir),{catalog:c,clock:()=>({mono:0,wall:9000000})});assert.deepEqual(reopened.snapshot().equipment,s.equipment);assert.deepEqual(reopened.snapshot().collection.owned,s.collection.owned);assert.equal(reopened.snapshot().active.status,'paused');reopened.close();
});
test('missing art cannot be equipped even when owned; incomplete assets/config do not reset rights',()=>{
 const s=initialState();s.collection.owned=['lamp-linen'];s.unlocked=['lamp-linen'];validateState(s);const pending=structuredClone(CATALOG);pending.items.find(i=>i.id==='lamp-linen').assetState='missing';assert.throws(()=>command(s,{type:'equip',slot:'lamp',item:'lamp-linen',requestId:'missing'},0,undefined,pending),/素材待准备/);assert.deepEqual(s.collection.owned,['lamp-linen']);
});
test('new configurable rewards grant from already saved focus on reopen without inventing extra time',()=>{
 const saved=initialState();saved.totalFocusMs=saved.settledFocusMs=900000;saved.creditedMinutes=15;saved.collection.owned=saved.unlocked=['round-glasses','reading-chair'];let written;
 const service=new FocusService({read:()=>saved,write:s=>{written=structuredClone(s);},close(){}},{clock:()=>({mono:0,wall:12345})});
 assert.ok(service.snapshot().collection.owned.includes('lamp-linen'));assert.equal(service.snapshot().totalFocusMs,900000);assert.equal(service.snapshot().active,null);assert.equal(written.collection.owned.filter(id=>id==='lamp-linen').length,1);
});
test('long-lived schema3 saves validate against their historical rewards, not the expanded new catalog',()=>{
 const old=initialState();old.schema=3;delete old.positions;delete old.collection;old.totalFocusMs=old.settledFocusMs=6000000;old.creditedMinutes=100;old.unlocked=['round-glasses','reading-chair'];old.equipment={accessory:'round-glasses',room:'reading-chair'};
 const migrated=migrateState(old);assert.deepEqual(migrated.collection.owned,old.unlocked);let persisted;
 const service=new FocusService({read:()=>migrated,write:s=>{persisted=s;},close(){}},{clock:()=>({mono:0,wall:1000})});assert.equal(service.snapshot().collection.owned.length,10);assert.equal(service.snapshot().totalFocusMs,6000000);assert.equal(service.snapshot().equipment.chair,'reading-chair');assert.ok(persisted);
});
test('physical bounds prohibit chair-lamp/plant intersections; crown overlap is allowed, all floor contacts fit four viewport cameras',()=>{
 validateRoomCatalog(CATALOG);const c=structuredClone(CATALOG),plant=c.items.find(i=>i.id==='plant-leaf');plant.scene.visualBounds=[600,350,404,742];assert.doesNotThrow(()=>validateRoomCatalog(c));plant.scene.collisionBounds=[700,580,304,512];assert.throws(()=>validateRoomCatalog(c),/范围|相交/);
 for(const [w,h] of [[186,64],[186,145],[387,154],[387,320]]){const camera=roomCamera(w,h);for(const item of CATALOG.items.filter(i=>i.scene.contacts))for(const contact of item.scene.contacts){const p=mapPoint(contact,camera);assert.ok(p[0]>=0&&p[0]<=w&&p[1]>=0&&p[1]<=h);}}
 const bad=structuredClone(CATALOG);bad.items.find(i=>i.id==='chair-lilac').scene.contacts[0][1]=1100;assert.throws(()=>validateCatalog(bad),/接地/);
});
test('owl-only display keeps original seat anchor and input inverse across all four cameras; furniture stays fixed',async()=>{
 const {ROLE_DISPLAY,sourceToRoom,roomToSource}=await import('../ui/role-placement.mjs');assert.deepEqual(sourceToRoom({x:450,y:745}),{x:512,y:935});assert.ok(Math.abs(sourceToRoom({x:196,y:166}).y-564.44)<.001);
 for(const [w,h] of [[186,64],[186,145],[387,154],[387,320]]){const camera=roomCamera(w,h);for(const p of [{x:453,y:293},{x:545,y:293},{x:629,y:874},{x:0,y:0},{x:899,y:999}]){const world=sourceToRoom(p),display=mapPoint([world.x,world.y],camera),decoded={x:(display[0]-camera.offsetX)/camera.scale+camera.x,y:(display[1]-camera.offsetY)/camera.scale+camera.y},roundTrip=roomToSource(decoded);assert.ok(Math.abs(roundTrip.x-p.x)<1e-9&&Math.abs(roundTrip.y-p.y)<1e-9);}}
 assert.equal(ROLE_DISPLAY.scale,.64);assert.deepEqual(CATALOG.room.rigOffset,[85,300]);assert.equal(CATALOG.room.rigScale,.681);
});

test('second floor lamp grows around unchanged ground anchor and stays clear of furniture and four camera edges',()=>{
 const lamp=CATALOG.items.find(i=>i.id==='lamp-brass'),g=renderedGeometry(lamp.scene);assert.deepEqual(g.contacts,[[130,1082]]);assert.equal(lamp.scene.display.scale,1);assert.ok(g.visualBounds[2]>184);assert.ok(g.visualBounds[3]>621);validateRoomCatalog(CATALOG);
 for(const [w,h] of [[186,64],[186,145],[387,154],[387,320]]){const camera=roomCamera(w,h);for(const p of [g.visualBounds.slice(0,2),[g.visualBounds[0]+g.visualBounds[2],g.visualBounds[1]+g.visualBounds[3]]]){const mapped=mapPoint(p,camera);assert.ok(mapped[0]>=0&&mapped[0]<=w&&mapped[1]>=0&&mapped[1]<=h);}}
 const bad=structuredClone(CATALOG);bad.items.find(i=>i.id==='lamp-brass').scene.display.scale=1.18;assert.throws(()=>validateRoomCatalog(bad),/范围/);
});
