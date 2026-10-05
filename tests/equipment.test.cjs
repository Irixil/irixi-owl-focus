'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {canvasFixture}=require('./helpers/canvas.cjs');
const image=(tag,w=1254,h=1254)=>({tag,width:w,height:h,naturalWidth:w,naturalHeight:h});
const base={bodyAtlas:image('base-body'),headAtlas:image('base-heads'),pitchHead:image('base-up')};
async function modules(){return Promise.all([import('../ui/equipment-view.mjs'),import('../ui/outfit-assets.mjs'),import('../ui/outfit-renderer.mjs'),import('../ui/assets/motion-v7/owl-renderer.mjs')]);}
const state=()=>({unlocked:['round-glasses','reading-chair'],equipment:{accessory:'red-scarf',room:'stool'}});
test('missing or incomplete outfit assets preserve honest base display; locked items cannot appear equipped',async()=>{
  const [{resolveAppearance,equipmentOptions},{loadOutfitAssets,OUTFIT_FILES}]=await modules();
  let loads=0;assert.deepEqual((await loadOutfitAssets(()=>{loads++;},{ready:false})).images,{});assert.equal(loads,0);
  const s=state();s.equipment={accessory:'round-glasses',room:'reading-chair'};
  const a=resolveAppearance(s);assert.equal(a.accessory,null);assert.equal(a.room,'stool');assert.match(a.summary,/画面暂未更新/);assert.equal(a.desired.accessory,'round-glasses');assert.match(a.label,/红围巾/);
  const all=Object.fromEntries(Object.entries(OUTFIT_FILES).map(([k,[_n,w,h]])=>[k,image(k,w,h)]));
  assert.equal(resolveAppearance(s,all).accessory,'round-glasses');assert.equal(resolveAppearance(s,all).room,'reading-chair');
  const partial={...all};delete partial.glassesLeft60;delete partial.chairFront;
  assert.equal(resolveAppearance(s,partial).accessory,null);assert.equal(resolveAppearance(s,partial).room,'stool');
  s.unlocked=[];assert.equal(resolveAppearance(s,all).accessory,null);assert.equal(resolveAppearance(s,all).room,'stool');assert.equal(equipmentOptions(s).glasses.disabled,true);
  s.equipment.accessory=null;assert.equal(resolveAppearance(s,all).accessory,null);assert.equal(resolveAppearance(s).accessory,null);assert.match(resolveAppearance(s).label,/红围巾/);
  s.equipment.accessory='red-scarf';assert.equal(resolveAppearance(s).accessory,null);assert.equal(resolveAppearance(s).missing.length,0);
  assert.equal(Object.keys(OUTFIT_FILES).length,8);assert.ok(!Object.keys(OUTFIT_FILES).some(k=>/Bare|reading/.test(k)));
  const loaded=await loadOutfitAssets(src=>{const row=Object.values(OUTFIT_FILES).find(([n])=>src.endsWith(n));return Promise.resolve(image(src,row[1],src.endsWith('reading-chair-front.png')?1:row[2]));},{ready:true});
  assert.deepEqual(loaded.missing,['chairFront']);assert.equal(resolveAppearance({...state(),equipment:{accessory:'round-glasses',room:'reading-chair'}},loaded.images).room,'stool');
});
test('default extension preserves frozen v7 poses and drawing traces, including focus/tea/yaw/sway',async()=>{
  const [{resolveAppearance},,_outfit,original]=await modules(),{createOutfitRenderer}=_outfit;
  const a=canvasFixture(),b=canvasFixture(),old=original.createOwlRenderer(a.canvas,base,{makeCanvas:a.makeCanvas,showLabels:false}),next=createOutfitRenderer(b.canvas,base,{}, {makeCanvas:b.makeCanvas,showLabels:false});
  for(const t of [0,.8,1.4,4.35,6.9,10.6,12.2,14.875,18.25,19.5,20.25,24.25]){
    a.reset();b.reset();const x=old.renderAt(t),y=next.renderAt(t,{appearance:resolveAppearance(state())});assert.deepEqual(y,x);assert.deepEqual(b.rootDraws,a.rootDraws,`base draw ${t}`);
  }
  for(const t of [0,50]){a.reset();b.reset();old.renderAt(t,{focus:true});next.renderAt(t,{focus:true,appearance:resolveAppearance(state())});assert.deepEqual(b.rootDraws,a.rootDraws);}
});
test('only eight ready reward assets display glasses/seat over fixed scarf; focus retains existing tea props',async()=>{
  const [{resolveAppearance},{OUTFIT_FILES},{createOutfitRenderer}]=await modules();
  const assets=Object.fromEntries(Object.entries(OUTFIT_FILES).map(([k,[_n,w,h]])=>[k,image(k,w,h)]));
  const f=canvasFixture(),renderer=createOutfitRenderer(f.canvas,base,assets,{makeCanvas:f.makeCanvas,showLabels:false});
  const s={...state(),equipment:{accessory:'round-glasses',room:'reading-chair'}},appearance=resolveAppearance(s,assets);
  renderer.renderAt(0,{appearance});const draws=f.rootDraws,firstBody=draws.findIndex(d=>d.image==='base-body'),front=draws.findIndex(d=>d.image==='chairFront'),leg=draws.findIndex(d=>d.image==='base-body'&&d.args[0]===67&&d.args[1]===930);
  assert.equal(draws[0].image,'chairBack');assert.ok(front>firstBody&&leg>front);assert.ok(!draws.some(d=>d.image==='base-body'&&d.args[0]===793&&d.args[1]===629));assert.ok(draws.some(d=>d.image==='glassesFront'));assert.ok(draws.some(d=>d.image==='base-body'));
  for(const [t,key] of [[4.35,'glassesUp'],[12.8,'glassesLeft60'],[14.75,'glassesRight60']]){f.reset();renderer.renderAt(t,{appearance});assert.ok(f.allDraws.some(d=>d.image===key),`registered ${key}`);}
  f.reset();renderer.renderAt(50,{focus:true,appearance});assert.ok(f.rootDraws.some(d=>d.image==='glassesFront'));assert.ok(f.rootDraws.some(d=>d.image==='base-body'&&d.args[0]===433&&d.args[1]===984));assert.ok(!f.allDraws.some(d=>/reading|Bare/.test(d.image)));
});
