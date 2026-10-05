'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
exports.run=async({app,views,service,activity,root,data,phase})=>{
 const out=path.join(root,'.runtime');fs.mkdirSync(out,{recursive:true});const rows=[];let failed=false;
 const js=(w,s)=>w.webContents.executeJavaScript(s,true),until=async f=>{const end=Date.now()+12000;while(Date.now()<end){try{if(await f())return;}catch{}await wait(70);}throw Error('Independent UI verification timeout');};
 const ready=async w=>{await until(()=>!w.webContents.isLoading());await until(()=>js(w,"Boolean(document.getElementById('primary-action')?.dataset.action)"));await js(w,'document.fonts.ready.then(()=>true)');};
 const click=async(w,selector)=>{const p=await js(w,`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2),hit:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}})()`);assert.ok(p.hit,selector+' covered');for(const type of ['mouseMove','mouseDown','mouseUp'])w.webContents.sendInputEvent({type,x:p.x,y:p.y,button:'left',clickCount:1});await wait(250);};
 const log=(claim,value={})=>rows.push({claim,...value});const expectedFile=path.join(out,'verification-expected.json');
 try{
  const main=views.get('standalone');await ready(main);
  const status=await js(main,'window.owlFocus.activitySnapshot()');assert.equal(status.available,false);assert.equal(status.enabled,false);assert.equal(await js(main,"document.getElementById('activity-toggle').disabled"),true);assert.equal(typeof activity.foreground,'undefined');
  await assert.rejects(js(main,"window.owlFocus.activityCommand({type:'start'})"),/暂不支持/);assert.equal(activity.snapshot().enabled,false);
  assert.equal('records' in service.snapshot(),false);log('Independent shell loaded, safe IPC available, APP unavailable and off, no legacy history');
  if(phase==='reopen'){
   const expected=JSON.parse(fs.readFileSync(expectedFile)),state=service.snapshot();assert.equal(state.active.id,expected.id);assert.equal(state.active.status,'paused');assert.equal(state.totalFocusMs,expected.totalFocusMs);assert.deepEqual(state.equipment,expected.equipment);assert.equal(state.configuredFocusSeconds,expected.seconds);await wait(1200);assert.equal(service.snapshot().totalFocusMs,expected.totalFocusMs);log('Actual process reopen preserves paused round, settings/equipment and credits no offline time');
  }else{
   assert.equal(service.snapshot().active,null,'Use fresh isolated verification data');
   await js(main,`document.getElementById('task').value=${JSON.stringify('本地独立版验证：读完这一节并整理笔记。'.repeat(8))};document.getElementById('minutes').value='1'`);
   await click(main,'#primary-action');await until(()=>service.snapshot().active?.status==='running');const id=service.snapshot().active.id;await wait(1200);assert.ok(service.snapshot().totalFocusMs>0);
   await click(main,'#other-view');await until(()=>views.has('compact'));const compact=views.get('compact');await ready(compact);assert.equal((await js(compact,'window.owlFocus.snapshot()')).active.id,id);assert.equal(views.size,2);
   await click(main,'#primary-action');await until(()=>service.snapshot().active?.status==='paused');const total=service.snapshot().totalFocusMs;await wait(1200);assert.equal(service.snapshot().totalFocusMs,total);assert.equal((await js(compact,'window.owlFocus.snapshot()')).active.status,'paused');log('Native input starts long task and pauses; main and small views share the same round/writer');
   await click(compact,'#primary-action');await until(()=>service.snapshot().active?.status==='running');await click(compact,'#primary-action');await until(()=>service.snapshot().active?.status==='paused');
   await click(main,'#more > summary');await js(main,"document.getElementById('activity-toggle').scrollIntoView({block:'center'})");assert.equal(await js(main,"document.getElementById('activity-toggle').disabled"),true);await click(main,'#more > summary');log('Small view can resume/pause; records explain unavailable collection and do not start it');
   main.webContents.reload();await ready(main);assert.equal((await js(main,'window.owlFocus.snapshot()')).active.id,id);assert.equal(service.snapshot().active.status,'paused');
   const state=service.snapshot();fs.writeFileSync(expectedFile,JSON.stringify({id,totalFocusMs:state.totalFocusMs,equipment:state.equipment,seconds:state.configuredFocusSeconds},null,2));log('Trusted local UI reload preserves the round; durable paused sample saved for actual next-process check');
  }
 }catch(e){failed=true;rows.push({error:e.stack});console.error(e.stack);}
 fs.writeFileSync(path.join(out,'verification-'+phase+'.json'),JSON.stringify({result:failed?'failed':'passed',phase,surface:'offscreen Electron, native input; no desktop interaction',data,realAppProviderAvailable:false,rows},null,2));
 if(failed)app.exit(1);else app.quit();
};
