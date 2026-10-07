'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {CATALOG,validateCatalog,DEFAULTS}=require('../src/collection.cjs');
const {bindings,validateArrangement,tabletopParent}=require('../ui/placement-rules.cjs');
const {FileStore}=require('../src/store.cjs'),{FocusService}=require('../src/service.cjs');
function multipleParents(){
 // Synthetic metadata reuses an existing PNG in this test only, not new art.
 const c=structuredClone(CATALOG),p=structuredClone(c.items.find(i=>i.id==='side-table'));
 p.id='contract-table-high';p.name='Synthetic table contract';
 const s=p.scene,a=s.placement,k=a.displaySize[0]/s.size[0],point=v=>v.map((n,j)=>a.position[j]+(n-a.anchor[j])*k);
 s.sourceTabletopArea=[100,160,300,80];s.sourceTabletopAnchor=[230,185];
 s.tabletopArea=[...point(s.sourceTabletopArea.slice(0,2)),300*k,80*k];s.tabletopAnchor=point(s.sourceTabletopAnchor);
 c.items.push(p);return validateCatalog(c);
}
test('Each supported table requires its own valid source and world tabletop contact',()=>{
 assert.equal(tabletopParent(DEFAULTS),null);
 for(const edit of [s=>delete s.sourceTabletopAnchor,s=>s.tabletopAnchor[0]++,s=>s.sourceTabletopAnchor=[0,0],s=>delete s.sourceTabletopArea]){
  const c=multipleParents();edit(c.items.find(i=>i.id==='contract-table-high').scene);assert.throws(()=>validateCatalog(c),/接点|注册坐标/);
 }
});
test('Tall table overlap warns but permits an atomic save without changing the existing plant or real rewards',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'owl-tall-conflict-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const service=new FocusService(new FileStore(dir),{startWithAllItems:true,clock:()=>({wall:1000,mono:0})});
 try{
  const before=service.snapshot(),file=path.join(dir,'focus-state.json'),bytes=fs.readFileSync(file);
  const {CollectionDraft}=await import('../ui/collection-draft.mjs'),d=new CollectionDraft();d.begin(before);
  d.choose('plant','plant-leaf');d.choose('side-furniture','side-table-tall');
  assert(require('../ui/placement-rules.cjs').arrangementWarnings(CATALOG,d.equipment,d.positions).some(s=>s.includes('重叠')));
  service.dispatch({type:'room-set',...d.command(),requestId:'tall-conflict'});const saved=service.snapshot();assert.equal(saved.testAccess.equipment.plant,'plant-leaf');assert.equal(saved.testAccess.equipment['side-furniture'],'side-table-tall');assert.deepEqual(saved.testAccess.positions,before.testAccess.positions);assert.deepEqual(saved.equipment,before.equipment);assert.deepEqual(saved.collection,before.collection);assert.equal(saved.totalFocusMs,before.totalFocusMs);assert.equal(saved.revision,before.revision+1);
 }finally{service.close();}
});
test('Real tall table uses124 contact and preserves high/low customized rooms through disk reopen',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'owl-real-tall-table-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 let service=new FocusService(new FileStore(dir),{startWithAllItems:true,clock:()=>({wall:1000,mono:0})});
 try{
  const {CollectionDraft}=await import('../ui/collection-draft.mjs'),d=new CollectionDraft();d.begin(service.snapshot());
  d.choose('side-furniture','side-table');d.choose('tabletop','tabletop-teapot');d.move('tabletop-teapot',{x:8,y:0});
  const old=structuredClone(d.positions);
  d.choose('side-furniture','side-table-tall');
  const rows=bindings(CATALOG,d.equipment,d.positions),table=rows.find(r=>r.id==='side-table-tall'),child=rows.find(r=>r.category==='tabletop');
  assert.deepEqual(table.scene.sourceTabletopAnchor,[256,124]);assert.deepEqual(child.scene.placement.position,[925,1070.171875]);
  assert.equal(child.translation.x,-105);assert.equal(child.translation.y,8);
  assert.deepEqual(d.positions,old);
  d.move('side-table-tall',{x:table.offset.x+16,y:table.offset.y+4});d.move('tabletop-teapot',{x:-8,y:0});
  d.choose('side-furniture','low-bookcase');assert.equal(d.equipment.tabletop,'tabletop-teapot');assert(!bindings(CATALOG,d.equipment,d.positions).some(r=>r.category==='tabletop'));
  d.choose('side-furniture',null);assert.equal(d.equipment.tabletop,'tabletop-teapot');
  d.choose('side-furniture','side-table');assert.equal(bindings(CATALOG,d.equipment,d.positions).find(r=>r.category==='tabletop').offset.x,8);
  d.choose('side-furniture','side-table-tall');assert.equal(bindings(CATALOG,d.equipment,d.positions).find(r=>r.category==='tabletop').offset.x,-8);
  const expected=structuredClone(d.positions);service.dispatch({type:'room-set',...d.command(),requestId:'real-tall-save'});
  service.close();service=new FocusService(new FileStore(dir),{clock:()=>({wall:9999999,mono:0})});
  const s=service.snapshot();assert.deepEqual(s.testAccess.positions,expected);assert.equal(s.testAccess.equipment['side-furniture'],'side-table-tall');assert.equal(s.testAccess.equipment.tabletop,'tabletop-teapot');assert.equal(s.totalFocusMs,0);assert.deepEqual(s.collection.owned,[]);assert.deepEqual(s.positions,{});
 }finally{service.close();}
});
test('Multiple parents restore distinct anchors and offsets after cabinet,empty and reopen',async t=>{
 const catalog=multipleParents(),dir=fs.mkdtempSync(path.join(os.tmpdir(),'owl-multiple-tables-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 let service=new FocusService(new FileStore(dir),{catalog,startWithAllItems:true,clock:()=>({wall:1000,mono:0})});
 try{
  const {CollectionDraft}=await import('../ui/collection-draft.mjs'),d=new CollectionDraft();d.begin(service.snapshot());
  d.choose('side-furniture','side-table');d.choose('tabletop','tabletop-teapot');d.move('tabletop-teapot',{x:8,y:0});
  const find=()=>bindings(catalog,d.equipment,d.positions).find(r=>r.category==='tabletop'),first=find();
  d.choose('side-furniture','contract-table-high');const other=find();assert.notDeepEqual(other.scene.placement.position,first.scene.placement.position);
  const p=catalog.items.find(i=>i.id==='contract-table-high').scene;assert.deepEqual(other.scene.placement.position,p.tabletopAnchor);d.move('tabletop-teapot',{x:-8,y:0});
  d.choose('side-furniture','low-bookcase');assert.equal(d.equipment.tabletop,'tabletop-teapot');assert.equal(find(),undefined);
  d.choose('side-furniture',null);assert.equal(find(),undefined);d.choose('side-furniture','side-table');assert.equal(find().offset.x,8);
  d.choose('side-furniture','contract-table-high');assert.equal(find().offset.x,-8);assert.doesNotThrow(()=>validateArrangement(catalog,d.equipment,d.positions));
  const expected=structuredClone(d.positions);service.dispatch({type:'room-set',...d.command(),requestId:'multi-parent-save'});assert.equal(service.snapshot().totalFocusMs,0);assert.deepEqual(service.snapshot().collection.owned,[]);
  service.close();service=new FocusService(new FileStore(dir),{catalog,clock:()=>({wall:9999999,mono:0})});
  assert.deepEqual(service.snapshot().testAccess.positions,expected);assert.equal(service.snapshot().testAccess.equipment.tabletop,'tabletop-teapot');
 }finally{service.close();}
});
