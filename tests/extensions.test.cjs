'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {CATALOG,validateCatalog,DEFAULTS}=require('../src/collection.cjs');
const {constrainItem,validateArrangement}=require('../ui/placement-rules.cjs');
const {initialState,command,validateState}=require('../src/core.cjs');
test('Real extension registration rejects mismatched bounds, aspect ratio, table surface and untrusted cord path',()=>{
 for(const change of [c=>c.items.find(i=>i.id==='wall-owl-mona').scene.visualBounds[0]++,c=>c.items.find(i=>i.id==='side-table').scene.tabletopArea[0]++,c=>c.items.find(i=>i.id==='pendant-small').scene.placement.displaySize[0]++,c=>c.items.find(i=>i.id==='pendant-small').scene.hanging.src='assets/../private.png']){
  const c=structuredClone(CATALOG);change(c);assert.throws(()=>validateCatalog(c));
 }
});
test('Editing extends beyond the old ceiling/floor windows while preserving findable edges and overlap warnings',()=>{
 const s=initialState(),e={...s.equipment,pendant:'pendant-small','foreground-plant':'foreground-plant-small'};
 const pendant=constrainItem(CATALOG,e,{},'pendant-small',{x:0,y:-1000});assert(pendant.position.y < -20);validateArrangement(CATALOG,e,{[pendant.key]:{...pendant.position,size:CATALOG.items.find(i=>i.id===pendant.key).scene.placement.displaySize}});
 const plant=constrainItem(CATALOG,e,{},'foreground-plant-small',{x:400,y:-600});assert(plant.position.y < -400);assert.doesNotThrow(()=>validateArrangement(CATALOG,e,{[plant.key]:{...plant.position,size:CATALOG.items.find(i=>i.id===plant.key).scene.placement.displaySize}}));
 assert(require('../ui/placement-rules.cjs').arrangementWarnings(CATALOG,e,{[plant.key]:{...plant.position,size:CATALOG.items.find(i=>i.id===plant.key).scene.placement.displaySize}}).some(s=>s.includes('挡住')));
});
test('Every current registered item is trial-only until earned; whole real arrangement revalidates on reopen',()=>{
 const s=initialState();command(s,{type:'test-access',enabled:true,requestId:'on'},0);
 const real=CATALOG.items.filter(i=>i.scene?.placement);assert(real.length>0);
 for(const i of real){const candidate=structuredClone(s);candidate.testAccess.equipment=structuredClone(initialState().equipment);candidate.testAccess.positions={};if(i.category==='tabletop')command(candidate,{type:'equip',slot:'side-furniture',item:'side-table',requestId:'table-'+i.id},0);command(candidate,{type:'equip',slot:i.category,item:i.id,requestId:i.id},0);validateState(candidate);}
 command(s,{type:'equip',slot:'pendant',item:'pendant-small',requestId:'final-pendant'},0);
 validateState(s);assert.equal(s.totalFocusMs,0);assert.deepEqual(s.collection.owned,[]);
 const bad=structuredClone(s);bad.testAccess.positions['pendant-small']={x:0,y:-1000};assert.throws(()=>validateState(bad),/超出/);
 command(s,{type:'test-access',enabled:false,requestId:'off'},0);assert.equal(s.equipment.pendant,null);validateState(s);
});
test('New defaults fill the left/right room areas, saved custom offsets including zero take precedence without writes',()=>{
 const {bindings}=require('../ui/placement-rules.cjs');const e={...initialState().equipment,'wall-art':'wall-owl-mona','floor-light':'floor-light-small','side-furniture':'side-table',tabletop:'tabletop-teapot'};
 const rows=p=>bindings(CATALOG,e,p),find=(p,id)=>rows(p).find(r=>r.id===id);
 assert(find({},'wall-owl-mona').worldBounds[0]<300);assert(find({},'floor-light-small').worldBounds[0]<100);assert(find({},'side-table').worldBounds[0]+find({},'side-table').worldBounds[2]/2>740);
 const saved={'wall-owl-mona':{x:0,y:0},'side-table':{x:-20,y:0},'side-table--tabletop-teapot':{x:5,y:0}};const bytes=JSON.stringify(saved);
 assert.deepEqual(find(saved,'wall-owl-mona').offset,{x:0,y:0});assert.deepEqual(find(saved,'side-table').offset,{x:-20,y:0});assert.equal(find(saved,'tabletop-teapot').translation.x,-15);assert.equal(JSON.stringify(saved),bytes);
 assert.notDeepEqual(find({},'wall-owl-mona').worldBounds,find(saved,'wall-owl-mona').worldBounds);
});
test('Reopen retains existing customized normal/trial offsets while untouched objects use new defaults',t=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{FileStore}=require('../src/store.cjs'),{FocusService}=require('../src/service.cjs');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'owl-default-custom-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const state=initialState();command(state,{type:'test-access',enabled:true,requestId:'on'},0);command(state,{type:'equip',slot:'wall-art',item:'wall-owl-mona',requestId:'paint'},0);
 state.testAccess.positions={'wall-owl-mona':{x:0,y:0}};state.positions={stool:{x:0,y:-8}};validateState(state);const file=path.join(dir,'focus-state.json'),raw=JSON.stringify(state);fs.writeFileSync(file,raw);
 const service=new FocusService(new FileStore(dir),{clock:()=>({wall:1000,mono:0})});try{assert.deepEqual(service.snapshot().positions,state.positions);assert.deepEqual(service.snapshot().testAccess.positions,state.testAccess.positions);assert.equal(fs.readFileSync(file,'utf8'),raw);}finally{service.close();}
});
test('Schema5 original bytes are backed up; legacy custom positions keep old physical size and attached surface',t=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{FileStore}=require('../src/store.cjs'),{bindings}=require('../ui/placement-rules.cjs');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'owl-v5-custom-size-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const s=initialState();command(s,{type:'test-access',enabled:true,requestId:'on'},0);Object.assign(s.testAccess.equipment,{'wall-art':'wall-owl-mona','side-furniture':'side-table',tabletop:'tabletop-teapot'});s.testAccess.positions={'wall-owl-mona':{x:0,y:0},'side-table':{x:0,y:0},'side-table--tabletop-teapot':{x:5,y:0}};s.schema=5;const raw=JSON.stringify(s),file=path.join(dir,'focus-state.json');fs.writeFileSync(file,raw);const store=new FileStore(dir);
 try{const next=store.read();assert.equal(next.schema,8);assert.deepEqual(next.testAccess.positions,s.testAccess.positions);const backup=fs.readdirSync(dir).find(n=>n.startsWith('focus-state.schema5-'));assert.equal(fs.readFileSync(path.join(dir,backup),'utf8'),raw);const rows=bindings(CATALOG,next.testAccess.equipment,next.testAccess.positions);assert.deepEqual(rows.find(r=>r.id==='wall-owl-mona').scene.placement.displaySize,[190,237.5]);assert.deepEqual(rows.find(r=>r.id==='side-table').scene.placement.displaySize,[164,164]);assert.deepEqual(rows.find(r=>r.id==='tabletop-teapot').scene.placement.position,[925,1157.515625]);assert.doesNotThrow(()=>validateState(next));const fresh=bindings(CATALOG,next.testAccess.equipment,{});assert.deepEqual(fresh.find(r=>r.id==='side-table').scene.placement.displaySize,[250,250]);}finally{store.close();}
});
test('Moving a new default freezes its actual size in the draft; cancel/default do not rewrite the stored old arrangement',async()=>{
 const {CollectionDraft}=await import('../ui/collection-draft.mjs'),s=initialState();command(s,{type:'test-access',enabled:true,requestId:'on'},0);s.testAccess.equipment['wall-art']='wall-owl-mona';s.collectionCatalog=CATALOG;const d=new CollectionDraft();d.begin(s);const row=require('../ui/placement-rules.cjs').bindings(CATALOG,d.equipment,d.positions).find(r=>r.id==='wall-owl-mona');d.move(row.id,{x:row.offset.x+8,y:row.offset.y});assert.deepEqual(d.positions[row.key].size,CATALOG.items.find(i=>i.id===row.id).scene.placement.displaySize);assert.deepEqual(s.testAccess.positions,{});d.resetAll();assert.deepEqual(d.positions,{});d.clear();assert.deepEqual(s.testAccess.positions,{});
});
test('Uncustomized lamp gives room to an existing customized front plant; saved positions remain byte-for-byte intact',()=>{
 const {bindings,validateArrangement}=require('../ui/placement-rules.cjs'),s=initialState(),e={...s.equipment,'foreground-plant':'foreground-plant-small','floor-light':'floor-light-small'},positions={'foreground-plant-small':{x:0,y:0}},bytes=JSON.stringify(positions);
 const rows=validateArrangement(CATALOG,e,positions);assert.notEqual(rows.find(r=>r.id==='floor-light-small').offset.x,CATALOG.items.find(i=>i.id==='floor-light-small').scene.defaultOffset.x);assert.deepEqual(rows.find(r=>r.id==='foreground-plant-small').offset,{x:0,y:0});assert.equal(JSON.stringify(positions),bytes);
 const both={...positions,'floor-light-small':{x:0,y:0}};assert.equal(bindings(CATALOG,e,both).find(r=>r.id==='floor-light-small').offset.x,0);assert.doesNotThrow(()=>validateArrangement(CATALOG,e,both));
});

test("saved schema6 v38 size remains unchanged under v39 defaults",()=>{const e={...DEFAULTS,"wall-art":"wall-owl-mona"},p={"wall-owl-mona":{x:-147,y:25,size:[280,350]}};const row=validateArrangement(CATALOG,e,p).find(r=>r.id==="wall-owl-mona");assert.deepEqual(row.scene.placement.displaySize,[280,350]);assert.deepEqual(row.offset,{x:-147,y:25});assert.deepEqual(p["wall-owl-mona"].size,[280,350]);});

test("catalog expands past initial batch without a thirteen-item cap",()=>{const c=structuredClone(CATALOG),template=c.items.find(i=>i.id==="wall-owl-mona");for(let n=0;n<25;n++)c.items.push({...structuredClone(template),id:"contract-only-wall-"+n,name:"Synthetic contract entry "+n});assert.doesNotThrow(()=>validateCatalog(c));assert(c.items.length>35);});
