'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {CATALOG,DEFAULTS}=require('../src/collection.cjs'),rules=require('../ui/placement-rules.cjs'),{initialState,command,migrateState}=require('../src/core.cjs'),{FileStore}=require('../src/store.cjs');
const trial=()=>{const s=initialState();command(s,{type:'test-access',enabled:true,requestId:'on'},0);s.collectionCatalog=CATALOG;return s;};
const near=(a,b,label)=>assert(Math.abs(a-b)<1e-7,label+': '+a+' vs '+b);
test('Every applicable real item at 400/500 percent reflects around its registered anchor with matching true bounds and restored orientation',()=>{
 for(const item of CATALOG.items.filter(rules.supportsSize)){
  const e={...DEFAULTS,[item.category]:item.id};if(item.category==='tabletop')e['side-furniture']='side-table';
  for(const factor of [4,5]){
   const p=rules.resizeItem(CATALOG,e,{},item.id,factor),before=rules.bindings(CATALOG,e,p).find(r=>r.id===item.id),m=rules.mirrorItem(CATALOG,e,p,item.id),after=rules.bindings(CATALOG,e,m).find(r=>r.id===item.id),anchor=before.scene.placement?.position||before.scene.display.anchor;
   near(after.bounds[0],2*(anchor[0]+before.parent.x)-before.bounds[0]-before.bounds[2],item.id+' reflected left');near(after.bounds[1],before.bounds[1],item.id+' top');near(after.bounds[2],before.bounds[2],item.id+' width');assert.deepEqual(after.offset,before.offset);
   assert.equal(Boolean(after.scene.placement?.mirrorX||after.scene.display?.mirrorX),!Boolean(before.scene.placement?.mirrorX||before.scene.display?.mirrorX));
   const back=rules.mirrorItem(CATALOG,e,m,item.id);assert.equal(back[before.key].mirrorX,false);assert.deepEqual(rules.bindings(CATALOG,e,back).find(r=>r.id===item.id).worldBounds,before.worldBounds);
  }
 }
});
test('Mirror and scaling a table reflect its real surface/anchor and child layout together, twice restoring the exact effective pose',()=>{
 for(const table of CATALOG.items.filter(i=>i.supportsTabletop)){
  const e={...DEFAULTS,'side-furniture':table.id,tabletop:'tabletop-books'},p=rules.resizeItem(CATALOG,e,{},table.id,4),key=table.id+'--tabletop-books';p[key]={...p[key],x:7,y:-11};
  const rows=rules.bindings(CATALOG,e,p),parent=rows.find(r=>r.id===table.id),child=rows.find(r=>r.category==='tabletop'),next=rules.mirrorItem(CATALOG,e,p,table.id),after=rules.bindings(CATALOG,e,next),a=after.find(r=>r.id===table.id),b=after.find(r=>r.category==='tabletop');
  near(a.scene.tabletopAnchor[0],2*parent.scene.placement.position[0]-parent.scene.tabletopAnchor[0],'surface anchor');assert.deepEqual(b.scene.placement.position,a.scene.tabletopAnchor);assert.equal(b.offset.x,-7);assert.equal(b.offset.y,-11);assert.deepEqual(b.scene.placement.displaySize,child.scene.placement.displaySize);
  const twice=rules.mirrorItem(CATALOG,e,next,table.id);assert.deepEqual(rules.bindings(CATALOG,e,twice).map(r=>r.worldBounds),rows.map(r=>r.worldBounds));
 }
});
test('Offscreen selection/recover preserves explicit size and mirror; unload/re-equip preserves transforms/ownership and cancel writes nothing',async()=>{
 const {CollectionDraft}=await import('../ui/collection-draft.mjs'),s=trial(),baseline=structuredClone(s),d=new CollectionDraft();d.begin(s);d.choose('lamp','lamp-linen');d.resize('lamp-linen',5);d.mirror('lamp-linen');d.move('lamp-linen',{x:5000,y:-5000});assert.equal(d.positions['lamp-linen'].mirrorX,true);assert.equal(rules.sizeInfo(CATALOG,d.equipment,d.positions,'lamp-linen').factor,5);
 const transform=structuredClone(d.positions['lamp-linen']);d.remove('lamp-linen');assert.equal(d.equipment.lamp,null);d.choose('lamp','lamp-linen');assert.deepEqual(d.positions['lamp-linen'],transform);d.recover('lamp-linen');assert.deepEqual(d.positions['lamp-linen'],{...transform,x:0,y:0});d.choose('chair','chair-lilac');d.remove('chair-lilac');assert.equal(d.equipment.chair,'stool');assert.throws(()=>d.mirror('stool'),/原坐姿/);d.clear();assert.deepEqual(s,baseline);
});
test('A mirror-only remote change prevents stale save; combined mirror/size/offscreen/remove saves atomically and survives real disk reopen',async t=>{
 const {CollectionDraft}=await import('../ui/collection-draft.mjs'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'owl-layout9-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const store=new FileStore(dir),s=trial(),d=new CollectionDraft();s.testAccess.equipment.rug='rug-cream';d.begin(s);d.resize('rug-cream',4);d.mirror('rug-cream');d.move('rug-cream',{x:-3000,y:2500});d.moveLayer('rug-cream',1);command(s,{type:'room-set',...d.command(),requestId:'combined'},0);store.write(s);const saved=structuredClone(s);d.begin(s);s.testAccess.positions['rug-cream'].mirrorX=false;assert(d.stale(s));assert.throws(()=>command(s,{type:'room-set',...d.command(),requestId:'stale'},0),/其他入口/);store.close();const reopen=new FileStore(dir);assert.deepEqual(reopen.read(),saved);reopen.close();
});
test('Schema8 valid bytes migrate additively; unknown mirror/large old coordinates/unsupported old scale reject without replacing any bytes',t=>{
 for(const bad of [null,{mirrorX:true},{x:5000},{size:[4096,4096]}]){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'owl-old8-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const old=trial();delete old.collectionCatalog;old.schema=8;old.testAccess.equipment.lamp='lamp-linen';old.testAccess.positions['lamp-linen']={x:20,y:10,...bad};const bytes=Buffer.from(JSON.stringify(old,null,2)+'\n'),f=path.join(dir,'focus-state.json');fs.writeFileSync(f,bytes);const store=new FileStore(dir);
  try{if(bad){assert.throws(()=>store.read());assert(fs.readFileSync(f).equals(bytes));}else{const s=store.read();assert.equal(s.schema,9);assert.deepEqual({...s,schema:8},old);const backup=path.join(dir,'focus-state.schema8-'+crypto.createHash('sha256').update(bytes).digest('hex')+'.json');assert(fs.readFileSync(backup).equals(bytes));}}finally{store.close();}
 }
});
test('All four viewports contain the same full portrait world without a hidden inner crop',()=>{
 const {roomCamera,mapPoint,WORLD}=require('../ui/room-geometry.cjs');for(const [w,h]of[[186,126],[186,264],[387,264],[387,538]]){const c=roomCamera(w,h);near(c.width*c.scale,w,'fill width');near(c.height*c.scale,h,'fill height');const center=mapPoint([WORLD[0]/2,WORLD[1]/2],c);near(center[0],w/2,'center X');near(center[1],h/2,'center Y');for(const p of [[0,0],WORLD]){const q=mapPoint(p,c);assert(q[0]>=-1e-7&&q[0]<=w+1e-7);assert(q[1]>=-1e-7&&q[1]<=h+1e-7);}}
});

test('The drawer contains the same world; control-row height cannot change artwork size or registration',()=>{
 const {roomCamera,mapPoint,WORLD}=require('../ui/room-geometry.cjs');for(const [w,h]of[[186,126],[186,264],[387,264],[387,538]]){const pane={x:0,y:54,width:w*.56,height:Math.max(1,h-54)},a=roomCamera(w,h,pane),b=roomCamera(w,h,{...pane,height:Math.max(1,h-129)});assert.deepEqual(a,b);for(const p of [[0,0],WORLD]){const q=mapPoint(p,a);assert(q[0]>=-1e-7&&q[0]<=pane.width+1e-7);assert(q[1]>=-1e-7&&q[1]<=h+1e-7);}}
});
