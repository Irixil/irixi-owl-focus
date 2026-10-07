'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {FocusService}=require('../src/service.cjs'),{FocusController}=require('../src/focus-controller.cjs'),{initialState,validateState}=require('../src/core.cjs');
class MemoryStore{constructor(saved=initialState()){this.saved=structuredClone(saved);}read(){return structuredClone(this.saved);}write(s){this.saved=structuredClone(s);}close(){}}
function fixture(saved){
  const store=new MemoryStore(saved);let mono=0,wall=1790000000000,ids=0,requests=0;
  const service=new FocusService(store,{clock:()=>({mono,wall}),makeId:()=>`session-${++ids}`}),controller=new FocusController(service);
  const view=()=>({mainFrame:{},messages:[],isDestroyed:()=>false,send(channel,s){this.messages.push({channel,state:s});}});
  const a=view(),b=view();const detachA=controller.registerView(a);controller.registerView(b);
  const event=v=>({sender:v,senderFrame:v.mainFrame});
  const send=(type,extra={},v=a)=>controller.command(event(v),{type,requestId:`request-${++requests}`,sessionId:service.snapshot().active?.id,...extra});
  const run=seconds=>{for(let i=0;i<seconds;i++){mono+=1000;wall+=1000;service.tick();}};
  return {service,controller,store,a,b,view,event,send,run,detachA};
}
test('shared bridge rejects unregistered/child frames, clones broadcasts, and never creates or stops a second core',()=>{
  const f=fixture(),unknown=f.view();assert.throws(()=>f.controller.snapshot(f.event(unknown)),/未授权/);
  assert.deepEqual(f.controller.command(f.event(unknown),{type:'start'}),{ok:false,error:'未授权窗口'});
  assert.equal(f.controller.allowed({sender:f.a,senderFrame:{}}),false);assert.equal(f.controller.allowed({sender:f.a}),false);
  assert.throws(()=>new FocusController(f.service),/重复注册/);
  assert.equal(f.send('start',{task:'同一次专注',minutes:25}).ok,true);f.run(1);
  f.a.messages.at(-1).state.equipment.room='fake';assert.equal(f.b.messages.at(-1).state.equipment.room,'stool');assert.equal(f.service.snapshot().equipment.room,'stool');
  f.detachA();const count=f.a.messages.length;f.run(1);assert.equal(f.a.messages.length,count);assert.equal(f.controller.allowed(f.event(f.a)),false);assert.equal(f.service.snapshot().totalFocusMs,2000);
  f.b.send=()=>{throw Error('view closed');};assert.doesNotThrow(()=>f.run(1));assert.equal(f.service.snapshot().totalFocusMs,3000);
  f.controller.dispose();f.run(1);assert.equal(f.service.snapshot().totalFocusMs,4000);assert.equal(f.controller.allowed(f.event(f.b)),false);
});
test('reward→equip→pause/resume→chair→reopen feeds scene choices through the same core, without disk IO',async()=>{
  const {resolveAppearance,equipmentOptions}=await import('../ui/equipment-view.mjs');
  const f=fixture();assert.equal(f.send('equip',{slot:'accessory',item:'round-glasses'}).ok,false);
  f.send('start',{task:'读一节书',minutes:25});f.run(300);
  assert.equal(equipmentOptions(f.controller.snapshot(f.event(f.b))).glasses.disabled,false);
  assert.equal(f.send('equip',{slot:'accessory',item:'round-glasses'},f.b).ok,true);
  f.send('pause');f.run(60);assert.equal(f.service.snapshot().creditedMinutes,5);f.send('resume');f.run(300);
  assert.equal(f.send('equip',{slot:'room',item:'reading-chair'}).ok,true);f.send('end');
  const saved=f.store.read();validateState(saved);assert.equal(saved.creditedMinutes,10);assert.equal('records' in saved,false);assert.equal(saved.settledFocusMs,600000);
  const reopened=fixture(saved),s=reopened.controller.snapshot(reopened.event(reopened.b));
  assert.deepEqual(s.equipment,{...require('../src/collection.cjs').DEFAULTS,accessory:'round-glasses',room:'reading-chair',chair:'reading-chair'});assert.equal(s.creditedMinutes,10);
  const pending=resolveAppearance(s);assert.match(pending.summary,/画面暂未更新/);
  const images={chairBack:{},chairFront:{},glassesFront:{},glassesUp:{},glassesLeft30:{},glassesLeft60:{},glassesRight30:{},glassesRight60:{}};
  const ready=resolveAppearance(s,images);assert.equal(ready.accessory,'round-glasses');assert.equal(ready.room,'reading-chair');assert.equal(ready.missing.length,0);
  f.controller.dispose();reopened.controller.dispose();
});
