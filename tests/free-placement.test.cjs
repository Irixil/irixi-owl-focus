'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {CATALOG}=require('../src/collection.cjs'),{initialState,command}=require('../src/core.cjs'),{bindings,constrainItem,arrangementWarnings}=require('../ui/placement-rules.cjs'),{FileStore}=require('../src/store.cjs'),{FocusService}=require('../src/service.cjs');
test('Actual default floor and wall items have broad vertical range, keep a findable piece at every edge',()=>{
 const eq={...initialState().equipment,lamp:'lamp-linen',rug:'rug-cream',chair:'chair-lilac',plant:'plant-leaf','floor-light':'floor-light-small','side-furniture':'side-table','wall-art':'wall-owl-mona'};
 for(const r of bindings(CATALOG,eq,{})){
  const top=constrainItem(CATALOG,eq,{},r.id,{x:r.offset.x,y:-1536}).position,bottom=constrainItem(CATALOG,eq,{},r.id,{x:r.offset.x,y:1536}).position;assert(bottom.y-top.y>=400,r.id+' useful Y range');
  for(const p of [top,bottom,constrainItem(CATALOG,eq,{},r.id,{x:-1024,y:r.offset.y}).position,constrainItem(CATALOG,eq,{},r.id,{x:1024,y:r.offset.y}).position]){const [x,y,w,h]=r.bounds;assert(Math.min(x+p.x+w,1024)-Math.max(x+p.x,0)>=Math.min(96,w)-1e-6);assert(Math.min(y+p.y+h,1260)-Math.max(y+p.y,260)>=Math.min(96,h)-1e-6);}
 }
});
test('Overlap cannot freeze movement of another object, table and child translate together without corrupting their local offset',async()=>{
 const s=initialState();command(s,{type:'test-access',enabled:true,requestId:'on'},0);s.collectionCatalog=CATALOG;const {CollectionDraft}=await import('../ui/collection-draft.mjs'),d=new CollectionDraft();d.begin(s);d.choose('chair','chair-lilac');d.choose('lamp','lamp-linen');d.choose('plant','plant-leaf');d.choose('side-furniture','side-table');d.choose('tabletop','tabletop-books');
 d.choose('side-furniture','side-cabinet-drawer');d.choose('plant','plant-c-olive');assert(arrangementWarnings(CATALOG,d.equipment,d.positions).length);d.choose('side-furniture','side-table');d.move('lamp-linen',{x:200,y:300});assert.equal(d.positions['lamp-linen'].y,300);
 const a=bindings(CATALOG,d.equipment,d.positions).find(r=>r.category==='tabletop');d.move('side-table',{x:-400,y:-400});const b=bindings(CATALOG,d.equipment,d.positions).find(r=>r.category==='tabletop');assert.deepEqual(b.offset,a.offset);assert.equal(b.worldBounds[1]-a.worldBounds[1],-408);assert.equal(b.worldBounds[0]-a.worldBounds[0],-240);
});
test('Large saved overlap survives real disk reopen; normal rights and old unused coordinates remain intact',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'owl-free-reopen-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));let svc=new FocusService(new FileStore(dir),{startWithAllItems:true,clock:()=>({wall:1000,mono:0})});const before=svc.snapshot(),{CollectionDraft}=await import('../ui/collection-draft.mjs'),d=new CollectionDraft();d.begin(before);d.choose('lamp','lamp-linen');d.choose('chair','chair-lilac');d.move('lamp-linen',{x:300,y:100});svc.dispatch({type:'room-set',...d.command(),requestId:'free'});const saved=svc.snapshot();assert(arrangementWarnings(CATALOG,saved.testAccess.equipment,saved.testAccess.positions).length);svc.close();svc=new FocusService(new FileStore(dir),{clock:()=>({wall:9000000,mono:0})});assert.deepEqual(svc.snapshot().testAccess,saved.testAccess);assert.deepEqual(svc.snapshot().equipment,before.equipment);assert.deepEqual(svc.snapshot().collection,before.collection);assert.equal(svc.snapshot().totalFocusMs,before.totalFocusMs);svc.close();
});
