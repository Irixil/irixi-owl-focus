'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {CATALOG,validateCatalog}=require('../src/collection.cjs'),{bindings}=require('../ui/placement-rules.cjs');
const {FileStore}=require('../src/store.cjs'),{FocusService}=require('../src/service.cjs');
test('Real collection retains landscapes and legacy rights with five independent tall lamps and five portraits',()=>{
 const groups=[['wall-art'],['lamp','floor-light','pendant'],['plant','foreground-plant'],['chair'],['rug'],['side-furniture'],['tabletop']];
 assert.deepEqual(groups.map(g=>CATALOG.items.filter(i=>g.includes(i.category)&&i.assetState==='ready').length),[8,8,5,5,6,5,5]);
 assert.equal(CATALOG.items.filter(i=>i.category==='lamp').length,5);
 assert.equal(CATALOG.items.filter(i=>i.id.startsWith('wall-owl-')).length,5);
 assert.equal(CATALOG.items.filter(i=>i.id.startsWith('wall-landscape-')).length,3);
 assert.equal(CATALOG.items.filter(i=>i.id==='side-table-tall').length,1);
 for(const id of ['stool','reading-chair','round-glasses'])assert(CATALOG.items.some(i=>i.id===id));
 const m=require('../ui/assets/expansion-v43/collection-expansion-manifest.json');
 for(const a of m.assets){const bytes=fs.readFileSync(path.join(__dirname,'../ui/assets/expansion-v43',a.file));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),a.sha256);}
 const chair=CATALOG.items.find(i=>i.id==='chair-d-club');assert.deepEqual(chair.scene.visualBounds.map(n=>Number(n.toFixed(6))),[241.63,619.389,542.076,463.761]);
 const bad=structuredClone(CATALOG);bad.items.find(i=>i.id==='chair-d-club').scene.collisionBounds[0]-=2;assert.throws(()=>validateCatalog(bad),/范围/);
});
test('All four actual parents carry five actual props and retain distinct offsets and sizes through file reopen/off-on',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'owl-expansion-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 let service=new FocusService(new FileStore(dir),{startWithAllItems:true,clock:()=>({wall:1000,mono:0})});
 try{
  const {CollectionDraft}=await import('../ui/collection-draft.mjs'),d=new CollectionDraft();d.begin(service.snapshot());
  const parents=CATALOG.items.filter(i=>i.supportsTabletop),props=CATALOG.items.filter(i=>i.category==='tabletop');assert.equal(parents.length,4);assert.equal(props.length,5);
  for(const parent of parents){
   d.choose('side-furniture',parent.id);
   const p=bindings(CATALOG,d.equipment,d.positions).find(r=>r.id===parent.id);d.move(parent.id,{x:p.offset.x+8,y:p.offset.y+4});
   // Saved actual parent scale changes its own surface, never copies the low contact.
   d.positions[parent.id].size=[225,225];
   for(const prop of props){
    d.choose('tabletop',prop.id);const child=bindings(CATALOG,d.equipment,d.positions).find(r=>r.category==='tabletop');
    const s=parent.scene,a=s.placement,k=225/512;assert.deepEqual(child.scene.placement.position,s.sourceTabletopAnchor.map((v,j)=>a.position[j]+(v-a.anchor[j])*k));
    d.move(prop.id,{x:2,y:0});assert.deepEqual(d.positions[parent.id+'--'+prop.id].size,[100,100]);
   }
  }
  const expected=structuredClone(d.positions);
  for(const parent of parents)for(const prop of props){d.choose('side-furniture',parent.id);d.choose('tabletop',prop.id);assert.equal(bindings(CATALOG,d.equipment,d.positions).find(r=>r.category==='tabletop').offset.x,expected[parent.id+'--'+prop.id].x);}
  for(const parent of ['low-bookcase',null]){d.choose('side-furniture',parent);assert(!bindings(CATALOG,d.equipment,d.positions).some(r=>r.category==='tabletop'));assert.equal(d.equipment.tabletop,props.at(-1).id);}
  d.choose('side-furniture','side-cabinet-drawer');service.dispatch({type:'room-set',...d.command(),requestId:'all-parent-save'});service.close();
  service=new FocusService(new FileStore(dir),{clock:()=>({wall:9999999,mono:0})});assert.deepEqual(service.snapshot().testAccess.positions,expected);assert.equal(service.snapshot().totalFocusMs,0);assert.deepEqual(service.snapshot().collection.owned,[]);assert.deepEqual(service.snapshot().positions,{});
  service.dispatch({type:'test-access',enabled:false,requestId:'off'});service.dispatch({type:'test-access',enabled:true,requestId:'on'});assert.deepEqual(service.snapshot().testAccess.positions,expected);
 }finally{service.close();}
});
