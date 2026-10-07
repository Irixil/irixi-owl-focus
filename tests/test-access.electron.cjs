'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
exports.run=async({app,views,service,activity,root,data,openView,phase})=>{
 const out=path.join(root,'.runtime/test-access31/ui');fs.mkdirSync(out,{recursive:true});const rows=[];let failure;
 const js=(w,s)=>w.webContents.executeJavaScript(s,true),until=async(fn,label)=>{const end=Date.now()+12000;while(Date.now()<end){if(await fn())return;await wait(40);}throw Error(label+' timeout');};
 const click=async(w,selector)=>{const p=await js(w,`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e||e.disabled||e.closest('[hidden]'))throw Error('not clickable');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);for(const type of ['mouseMove','mouseDown','mouseUp'])w.webContents.sendInputEvent({type,x:Math.round(p.x),y:Math.round(p.y),button:'left',clickCount:1});await wait(100);};
 const ready=w=>until(()=>js(w,"document.querySelector('#owl-canvas').dataset.roomMode==='portrait'&&!document.querySelector('#owl-canvas').hidden"),'room loaded');
 const safe=()=>{const s=service.snapshot();assert.equal(s.totalFocusMs,0);assert.equal(s.creditedMinutes,0);assert.equal(s.active,null);assert.deepEqual(s.collection.owned,[]);assert.deepEqual(s.unlocked,[]);assert.equal(s.equipment.chair,'stool');assert.equal(s.equipment.accessory,'red-scarf');assert.equal(activity.snapshot().enabled,false);return s;};
 try{
  const w=views.get('standalone');await ready(w);const initial=safe();
  if(phase==='test-access'){
   assert.equal(initial.testAccess.enabled,true);assert(initial.collectionCatalog.items.every(i=>i.canEquip));
   await click(w,'#more > summary');assert(await js(w,"document.querySelector('#test-access').checked"));await click(w,'#collection-open');
   for(const category of initial.collectionCatalog.categories){for(const item of initial.collectionCatalog.items.filter(i=>i.category===category.id&&!i.starter)){
    if(await js(w,"document.querySelector('#collection-panel').hidden"))await click(w,'#wardrobe-toggle');await click(w,`[data-category="${category.id}"]`);const before=safe();await click(w,`[data-item="${item.id}"]`);await until(()=>js(w,"!document.querySelector('#collection-confirm').disabled"),'test preview ready '+item.id);assert.deepEqual(safe(),before);await click(w,'#collection-confirm');await until(()=>service.snapshot().testAccess.equipment[category.id]===item.id,'test equip '+item.id);safe();
   }}
   rows.push({claim:'Real hidden Chromium cards/scene/native Electron input equip all ten nonstarter items at zero focus; no permanent ownership or normal equipment changed'});
   await click(w,'#more > summary');await click(w,'#test-access');await until(()=>!service.snapshot().testAccess.enabled,'trial off');safe();await until(()=>js(w,"document.querySelector('#equipment-summary').textContent.includes('初始凳子')&&!document.querySelector('#equipment-summary').textContent.includes('圆眼镜')"),'normal appearance restored');
   await click(w,'#test-access');await until(()=>service.snapshot().testAccess.enabled,'trial on');safe();
   const widget=openView('widget');await ready(widget);await click(widget,'#more > summary');assert(await js(widget,"document.querySelector('#test-access').checked"));await click(widget,'#collection-open');
   for(const [name,width,height] of [['mini',186,124],['small',186,262],['medium',387,262],['large',386,538]]){
    widget.setContentSize(width,height);await wait(180);if(await js(widget,"document.querySelector('#collection-panel').hidden"))await click(widget,'#wardrobe-toggle');await click(widget,'[data-category="chair"]');const target=service.snapshot().testAccess.equipment.chair==='chair-sage'?'chair-lilac':'chair-sage',before=safe();await click(widget,`[data-item="${target}"]`);await until(()=>js(widget,"!document.querySelector('#collection-confirm').disabled"),'four-size preview ready');await click(widget,'#collection-cancel');assert.deepEqual(safe(),before);rows.push({claim:'Actual hidden renderer original viewport trial preview/cancel accessible, no save',name,width,height});
   }
   await click(widget,'#more > summary');await click(widget,'#test-access');await until(()=>js(w,"!document.querySelector('#test-access').checked"),'shared toggle off');assert.equal(safe().testAccess.enabled,false);await click(widget,'#test-access');await until(()=>js(w,"document.querySelector('#test-access').checked"),'shared toggle on');safe();
   fs.writeFileSync(path.join(out,'before-reopen.json'),JSON.stringify({dataDir:data,testAccess:service.snapshot().testAccess,equipment:service.snapshot().equipment,totalFocusMs:0,owned:[]},null,2));
   rows.push({claim:'Two actual hidden views share one toggle and trial equipment; final enabled choice saved for process reopen'});
  }else{
   const expected=JSON.parse(fs.readFileSync(path.join(out,'before-reopen.json')));assert.equal(expected.dataDir,data);assert.deepEqual(initial.equipment,expected.equipment);assert.deepEqual(initial.testAccess.equipment,expected.testAccess.equipment);
   if(phase==='test-access-reopen'){
    assert(initial.testAccess.enabled);await click(w,'#more > summary');assert(await js(w,"document.querySelector('#test-access').checked"));await click(w,'#test-access');await until(()=>!service.snapshot().testAccess.enabled,'reopen disable');safe();rows.push({claim:'New actual Electron process retains enabled test selection and zero earned time/ownership; native UI off restores normal outfit and saves disabled choice'});
   }else{assert.equal(initial.testAccess.enabled,false);await click(w,'#more > summary');assert.equal(await js(w,"document.querySelector('#test-access').checked"),false);await click(w,'#collection-open');await click(w,'[data-category="chair"]');await click(w,'[data-item="chair-sage"]');await wait(500);assert(await js(w,"document.querySelector('#collection-confirm').disabled"));assert.throws(()=>service.dispatch({type:'equip',slot:'chair',item:'chair-sage',requestId:'locked-after-off'}),/没有解锁/);safe();rows.push({claim:'Third actual Electron process keeps disabled choice even with startup test flag; normal lock restored, previous trial chair not normal equipment'});}
  }
 }catch(e){failure=e;rows.push({claim:'FAILED',error:e.stack});}
 fs.writeFileSync(path.join(out,phase+'.json'),JSON.stringify({result:failure?'failed':'passed',phase,pid:process.pid,dataDir:data,windowVisible:[...views.values()].some(w=>w.isVisible()),physicalOSInput:false,desktopActivationPolicy:'prohibited on macOS verification',screenshotsCaptured:false,productionChanged:false,rows},null,2));console.log(JSON.stringify({phase,result:failure?'failed':'passed'}));process.exitCode=failure?1:0;app.quit();
};
