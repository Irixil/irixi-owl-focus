'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {initialState,command,validateState}=require('../src/core.cjs');
const {SLOTS,DEFAULTS,displayEquipment,CATALOG}=require('../src/collection.cjs');
const {FocusService}=require('../src/service.cjs');
const outfit=s=>Object.fromEntries(SLOTS.map(k=>[k,displayEquipment(s)[k]]));
const set=(s,equipment,requestId='group')=>({type:'equip-set',equipment,expectedEquipment:outfit(s),expectedTestEnabled:Boolean(s.testAccess?.enabled),requestId});
const room={...DEFAULTS,lamp:'lamp-brass',rug:'rug-pattern',chair:'chair-sage',plant:'plant-flower',accessory:'round-glasses'};
test('a rejected final slot leaves the complete normal outfit unchanged and does not consume the save ID',()=>{
 const s=initialState();s.collection.owned=s.unlocked=['lamp-brass','rug-pattern','chair-sage','plant-flower'];const before=structuredClone(s);
 assert.throws(()=>command(s,set(s,room),0),/没有解锁/);assert.deepEqual(s,before);
});
test('trial group saves once, preserves normal rights and paused round, and duplicate requests cannot re-equip',()=>{
 const initial=initialState();command(initial,{type:'start',task:'Synthetic paused group',minutes:25,requestId:'start'},0,()=> 'round');command(initial,{type:'pause',sessionId:'round',requestId:'pause'},0);command(initial,{type:'test-access',enabled:true,requestId:'trial'},0);
 let durable=structuredClone(initial),writes=0;const service=new FocusService({read:()=>structuredClone(durable),write:s=>{durable=structuredClone(s);writes++;},close(){}},{clock:()=>({wall:1000,mono:0})});writes=0;
 const before=service.snapshot(),c=set(before,room);service.dispatch(c);const saved=service.snapshot();assert.equal(writes,1);assert.deepEqual(outfit(saved),room);assert.equal(saved.testAccess.equipment.room,'chair-sage');assert.deepEqual(saved.equipment,before.equipment);assert.deepEqual(saved.collection.owned,[]);assert.equal(saved.totalFocusMs,0);assert.deepEqual(saved.active,before.active);validateState(durable);
 service.dispatch(c);assert.equal(writes,1);assert.deepEqual(outfit(service.snapshot()),room);
 service.dispatch({type:'test-access',enabled:false,requestId:'off'});assert.deepEqual(outfit(service.snapshot()),outfit(initialState()));
});
test('stale group and mode change are rejected; no second view can overwrite a newer outfit or cross the test boundary',()=>{
 const s=initialState();command(s,{type:'test-access',enabled:true,requestId:'on'},0);const c=set(s,room);command(s,{type:'equip',slot:'lamp',item:'lamp-linen',requestId:'other'},0);const before=structuredClone(s);
 assert.throws(()=>command(s,c,0),/其他入口/);assert.deepEqual(s,before);
 const sameMode=set(s,room);command(s,{type:'test-access',enabled:false,requestId:'off'},0);assert.throws(()=>command(s,sameMode,0),/其他入口/);assert.equal(s.equipment.lamp,null);
});
test('missing art or malformed whole outfit cannot partly commit even with all-item access',()=>{
 const s=initialState();command(s,{type:'test-access',enabled:true,requestId:'on'},0);const c=structuredClone(CATALOG);c.items.find(i=>i.id==='plant-flower').assetState='missing';const before=structuredClone(s);
 assert.throws(()=>command(s,set(s,room),0,undefined,c),/素材/);assert.deepEqual(s,before);
 assert.throws(()=>command(s,set(s,{...room,room:'stool'}),0),/格式/);assert.deepEqual(s,before);
});
test('local room draft spans categories, cancels without a command, and notices remote changes',async()=>{
 const {CollectionDraft}=await import('../ui/collection-draft.mjs'),s=initialState(),d=new CollectionDraft();d.begin(s);d.choose('lamp','lamp-brass');d.choose('chair','chair-sage');assert.deepEqual(d.changedSlots,['lamp','chair']);assert.equal(s.equipment.lamp,null);assert.equal(s.equipment.chair,'stool');assert.equal(d.stale(s),false);
 const other=structuredClone(s);other.equipment.lamp='lamp-linen';assert.equal(d.stale(other),true);d.clear();assert.equal(d.changed,false);assert.equal(d.equipment,null);assert.deepEqual(s.equipment,initialState().equipment);
});
