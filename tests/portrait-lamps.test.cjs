'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {CATALOG}=require('../src/collection.cjs'),{initialState,command}=require('../src/core.cjs');
const {validateArrangement,defaultPositions}=require('../ui/placement-rules.cjs');
test('Default recovery finds a safe table placement without changing the chosen objects or saved state',async()=>{
 const {CollectionDraft}=await import('../ui/collection-draft.mjs');
 for(const [table,plant,chair] of [['side-cabinet-drawer','plant-c-olive','stool'],['side-cabinet-drawer','plant-flower','stool'],['side-table-tall','plant-leaf','chair-d-club']]){
  const s=initialState();command(s,{type:'test-access',enabled:true,requestId:'on'},0);s.collectionCatalog=CATALOG;
  const d=new CollectionDraft();d.begin(s);d.choose('side-furniture',table);d.choose('plant',plant);d.choose('chair',chair);d.choose('tabletop','tabletop-books');
  const original=JSON.stringify(s),equipment=structuredClone(d.equipment);assert.throws(()=>validateArrangement(CATALOG,d.equipment,{},{defaults:true}),/重叠/);
  d.resetAll();assert.doesNotThrow(()=>validateArrangement(CATALOG,d.equipment,d.positions));assert.deepEqual(d.equipment,equipment);assert.equal(JSON.stringify(s),original);
  command(s,{type:'room-set',...d.command(),requestId:'save'},0);assert.doesNotThrow(()=>validateArrangement(CATALOG,s.testAccess.equipment,s.testAccess.positions));assert.equal(s.totalFocusMs,0);assert.deepEqual(s.collection.owned,[]);
 }
 assert.deepEqual(defaultPositions(CATALOG,initialState().equipment),{});
});
test('New variants inherit a customized current slot only in the draft and preserve each already saved transform',async()=>{
 const {CollectionDraft}=await import('../ui/collection-draft.mjs');
 const s=initialState();command(s,{type:'test-access',enabled:true,requestId:'on'},0);s.collectionCatalog=CATALOG;
 s.testAccess.equipment.lamp='lamp-linen';s.testAccess.equipment['wall-art']='wall-owl-mona';
 s.testAccess.positions={'lamp-linen':{x:8,y:0},'wall-owl-mona':{x:-155,y:26,size:[260,325]},'wall-owl-rembrandt':{x:-164,y:30,size:[250,312.5]}};
 const saved=JSON.stringify(s),d=new CollectionDraft();d.begin(s);d.choose('lamp','lamp-lilac-torchiere');d.choose('wall-art','wall-owl-vangogh');
 assert.deepEqual(d.positions['lamp-lilac-torchiere'],s.testAccess.positions['lamp-linen']);assert.deepEqual(d.positions['wall-owl-vangogh'],s.testAccess.positions['wall-owl-mona']);
 d.choose('wall-art','wall-owl-rembrandt');assert.deepEqual(d.positions['wall-owl-rembrandt'],s.testAccess.positions['wall-owl-rembrandt']);assert.equal(JSON.stringify(s),saved);
 command(s,{type:'room-set',...d.command(),requestId:'save'},0);assert.deepEqual(s.testAccess.positions['lamp-linen'],{x:8,y:0});assert.deepEqual(s.testAccess.positions['wall-owl-mona'],{x:-155,y:26,size:[260,325]});assert.deepEqual(s.positions,{});assert.deepEqual(s.collection.owned,[]);
});
