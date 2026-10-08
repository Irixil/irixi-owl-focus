'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
exports.run=async({app,views,service,activity,root,data,openView,dragEvents})=>{
 const out=path.join(root,'.runtime/room-check');fs.mkdirSync(out,{recursive:true});const rows=[];let failed=false;
 const js=(w,s)=>w.webContents.executeJavaScript(s,true);
 const until=async(fn,label)=>{const end=Date.now()+60000;while(Date.now()<end){try{if(await fn())return;}catch{}await wait(80);}throw Error(label+' timed out');};
 const ready=async w=>{await until(()=>js(w,"document.querySelector('#owl-canvas').dataset.roomMode==='portrait'&&Boolean(document.querySelector('#owl-canvas').dataset.roleDisplay)&&Boolean(document.querySelector('#owl-canvas').dataset.ground)&&!document.querySelector('#owl-canvas').hidden&&document.querySelector('#owl-fallback').hidden"),'real local art');await js(w,'document.fonts.ready.then(()=>true)');};
 const input=(w,type,p)=>w.webContents.sendInputEvent({type,x:Math.round(p.x),y:Math.round(p.y),button:'left',clickCount:1});
 // The rig is 900x1000, the room is 1024x1536, and the canvas backing is
 // rounded for DPR. Decode the published room camera in CSS pixels, then
 // apply the original rig registration, exactly as real role hits do.
 const point=async(w,sourceX=453,sourceY=293)=>js(w,`(()=>{const c=document.querySelector('#owl-canvas'),r=c.getBoundingClientRect(),crop=JSON.parse(c.dataset.sourceCrop),d=JSON.parse(c.dataset.roleDisplay),scale=Math.min(r.width/crop.width,r.height/crop.height);return{x:r.left+(r.width-crop.width*scale)/2+(d.offset[0]+${sourceX}*d.scale-crop.x)*scale,y:r.top+(r.height-crop.height*scale)/2+(d.offset[1]+${sourceY}*d.scale-crop.y)*scale}})()`);
 // Preserve the original alpha-measured leg checks. Portrait ground metadata
 // describes world/catalog coordinates, not the old source-rig pixel scan.
 const seatMetrics=w=>js(w,`(async()=>{const {measureSeatGround}=await import('./seat-ground.mjs'),{loadOutfitAssets}=await import('./outfit-assets.mjs');const load=src=>new Promise((ok,bad)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=bad;i.src=src});const [body,pack]=await Promise.all([load('./assets/motion-v7/body-parts.png'),loadOutfitAssets(load)]);return measureSeatGround(body,pack.images.chairFront,(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c})})()`);
 const portrait=w=>js(w,`(()=>{const c=document.querySelector('#owl-canvas'),crop=JSON.parse(c.dataset.sourceCrop),d=JSON.parse(c.dataset.roleDisplay),r=c.getBoundingClientRect(),scale=Math.min(r.width/crop.width,r.height/crop.height);return{mode:c.dataset.roomMode,ground:JSON.parse(c.dataset.ground),role:d,seatWorld:[d.offset[0]+450*d.scale,d.offset[1]+745*d.scale],crop,cssScale:scale,backing:[c.width,c.height],viewport:[r.width,r.height],renderError:c.dataset.renderError||null}})()`);
 const click=async(w,selector)=>{const p=await js(w,`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();if(!e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)))throw Error('covered');return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);input(w,'mouseMove',p);input(w,'mouseDown',p);input(w,'mouseUp',p);await wait(200);};
 const count=w=>js(w,"Number(document.querySelector('#owl-interaction').dataset.responses||0)");
 const attention=w=>js(w,"JSON.parse(document.querySelector('#owl-canvas').dataset.attention)");
 const capture=async(w,name)=>{
  const paint=new Promise((resolve,reject)=>{const timer=setTimeout(()=>{w.webContents.removeListener('paint',onPaint);reject(Error('paint timeout'));},6000);function onPaint(_e,_r,image){if(image.isEmpty())return;clearTimeout(timer);w.webContents.removeListener('paint',onPaint);fs.writeFileSync(path.join(out,name+'.png'),image.toPNG());resolve();}w.webContents.on('paint',onPaint);w.webContents.invalidate();});
  await paint;
 };
 try{
  const main=views.get('standalone');await ready(main);
  const pixels=await js(main,"(()=>{const c=document.querySelector('#owl-canvas'),a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<a.length;i+=4)if(a[i]>100)n++;return{opaque:n,crop:c.dataset.sourceCrop,visibility:document.visibilityState,ground:JSON.parse(c.dataset.ground)}})()");assert.ok(pixels.opaque>10000);
  const initialPortrait=await portrait(main),measured=await seatMetrics(main);assert.equal(initialPortrait.mode,'portrait');assert.equal(initialPortrait.ground.world,true);assert.equal(initialPortrait.ground.groundY,service.snapshot().collectionCatalog.room.floorY);assert.equal(initialPortrait.renderError,null);assert.deepEqual(initialPortrait.seatWorld,[512,935]);assert.ok(measured.stool.contacts.length>=2,'Actual original stool PNG leg contacts remain present');
  rows.push({claim:'Portrait world floor and exact original seated-role anchor; legacy stool legs still alpha-measured from actual source PNG, not empty catalog metadata',initialPortrait,measured});
  await js(main,"document.querySelector('#task').value='仅本地交互验证';document.querySelector('#minutes').value='25'");await click(main,'#primary-action');await until(()=>service.snapshot().active?.status==='running','start');await click(main,'#primary-action');assert.equal(service.snapshot().active.status,'paused');
  const before=service.snapshot(),p=await point(main,545,293);input(main,'mouseMove',p);await wait(600);let a=await attention(main);assert.ok(a.yaw>1&&a.yaw<=3.5);assert.ok(Math.abs(a.head)<4);
  const face=await point(main);input(main,'mouseMove',face);await wait(140);const initialCount=await count(main);input(main,'mouseDown',face);await wait(50);input(main,'mouseUp',face);await wait(210);assert.equal(await count(main),initialCount+1);assert.ok((await attention(main)).blink>.9);await wait(650);assert.deepEqual(service.snapshot(),before);
  input(main,'mouseMove',{x:5,y:5});await wait(150);a=await attention(main);assert.equal(a.x,0);assert.equal(a.y,0);assert.equal(a.blink,0);
  rows.push({claim:'Real local owl pixels rendered; native hover/pat, pause remains exact, exit resets',...pixels});
  await capture(main,'main-stool');
  // Controlled synthetic elapsed samples unlock existing equipment; not ten real minutes.
  const originalClock=service.clock,sample=originalClock();let virtual={...sample};service.clock=()=>virtual;service.last=virtual;service.dispatch({type:'resume',sessionId:before.active.id,requestId:randomUUID()});
  for(let n=0;n<60;n++){virtual={mono:virtual.mono+10000,wall:virtual.wall+10000};service.tick();}
  service.dispatch({type:'pause',sessionId:before.active.id,requestId:randomUUID()});service.clock=originalClock;service.last=originalClock();assert.ok(service.snapshot().unlocked.includes('reading-chair'));
  for(const [category,id] of [['chair','reading-chair'],['accessory','round-glasses']]){await click(main,'#wardrobe-toggle');await click(main,`[data-category="${category}"]`);await click(main,`[data-item="${id}"]`);await until(()=>js(main,"!document.querySelector('#collection-confirm').disabled"),'real outfit preview ready');await click(main,'#collection-confirm');await until(()=>service.snapshot().equipment[category]===id,'graphical equip '+id);}
  await wait(300);const chair=(await seatMetrics(main))['reading-chair'],chairPortrait=await portrait(main);assert.equal(chair.contacts.length,4);assert.ok(chair.contacts.some(p=>p.y<chair.groundY-40));assert.deepEqual(chairPortrait.seatWorld,[512,935]);assert.equal(chairPortrait.renderError,null);assert.equal(await js(main,"JSON.parse(document.querySelector('#owl-canvas').dataset.equipment).chair"),'reading-chair');assert.equal(await js(main,"JSON.parse(document.querySelector('#owl-canvas').dataset.equipment).accessory"),'round-glasses');await capture(main,'main-chair');
  rows.push({claim:'Actual original chair still has four alpha-measured fixed leg contacts and original seated anchor; graphical chair/glasses equip, controlled unlock only',ground:chair,chairPortrait});
  const widget=openView('widget');await ready(widget);const frozen=service.snapshot(),head=await point(widget);input(widget,'mouseMove',head);const old=await count(widget);
  input(widget,'mouseDown',head);await wait(520);assert.ok(dragEvents.some(e=>e.type==='begin'));input(widget,'mouseUp',head);await wait(180);assert.equal(await count(widget),old);assert.ok(dragEvents.some(e=>e.type==='end'));
  input(widget,'mouseDown',head);input(widget,'mouseMove',{x:head.x+12,y:head.y});input(widget,'mouseUp',{x:head.x+12,y:head.y});await wait(180);assert.equal(await count(widget),old);
  await js(widget,"window.__checkPointerDownSeen=false;document.addEventListener('pointerdown',()=>{window.__checkPointerDownSeen=true},{once:true});true");
  input(widget,'mouseDown',head);await until(()=>js(widget,'window.__checkPointerDownSeen'),'native pointerdown before synthetic cancel');await js(widget,"document.dispatchEvent(new PointerEvent('pointercancel',{pointerId:1,bubbles:true}))");input(widget,'mouseUp',head);await wait(180);assert.equal(await count(widget),old);assert.deepEqual(service.snapshot(),frozen);
  await js(widget,"document.querySelector('#owl-interaction').focus()");widget.webContents.sendInputEvent({type:'keyDown',keyCode:'Return'});widget.webContents.sendInputEvent({type:'keyUp',keyCode:'Return'});await wait(200);assert.equal(await count(widget),old+1);
  rows.push({claim:'Native long press forwards begin/end to synthetic drag endpoint without pat; moved/cancelled press excluded; keyboard pat works; no timer mutation',dragEvents});
  await click(widget,'#more > summary');await js(widget,"document.querySelector('#reduced-motion').scrollIntoView({block:'center'})");await click(widget,'#reduced-motion');await until(()=>service.snapshot().preferences.reducedMotion,'reduced motion');await click(widget,'#more > summary');
  const reduced=await count(widget),p2=await point(widget,545,293);input(widget,'mouseMove',p2);input(widget,'mouseDown',p2);input(widget,'mouseUp',p2);await wait(250);a=await attention(widget);assert.equal(a.yaw,0);assert.equal(a.blink,0);assert.equal(await count(widget),reduced);
  rows.push({claim:'App reduced motion disables attention; open panel resets and makes role inert'});
  // End only the isolated synthetic round, then reproduce the user's exact blank-task path.
  await click(widget,'#more > summary');await click(widget,'#end');await click(widget,'#more > summary');
  for(const [name,width,height] of [['mini',189,126],['small',286,256],['medium',326,306],['large',386,538]]){
   widget.setContentSize(width,height);await wait(300);await js(widget,"document.querySelector('#task').value='';document.querySelector('#minutes').value='90';document.querySelector('#minutes').dispatchEvent(new Event('input',{bubbles:true}))");
   await click(widget,'#primary-action');assert.equal(await js(widget,"document.querySelector('#more').open"),true);await click(widget,'#more > summary');
   const layout=await js(widget,"(()=>{const e=document.querySelector('#error'),b=document.querySelector('#primary-action'),r=e.getBoundingClientRect(),t=b.getBoundingClientRect(),c=document.querySelector('#owl-canvas');const range=document.createRange();range.selectNodeContents(b);const text=range.getBoundingClientRect();return{prompt:e.textContent,verticalGap:t.top-r.bottom,textOverlap:Math.max(0,Math.min(r.bottom,text.bottom)-Math.max(r.top,text.top)),clickable:b.contains(document.elementFromPoint(t.x+t.width/2,t.y+t.height/2)),artVisible:!c.hidden,ground:JSON.parse(c.dataset.ground),roomTransform:getComputedStyle(document.querySelector('.room-window')).transform}})()");
   assert.match(layout.prompt,/先写下/);assert.ok(layout.verticalGap>=4);assert.equal(layout.textOverlap,0);assert.ok(layout.clickable&&layout.artVisible);assert.equal(layout.roomTransform,'none');await capture(widget,'widget-'+name);rows.push({claim:'Responsive local widget and exact blank-task-return prompt',name,width,height,...layout});
  }
  assert.equal(activity.snapshot().enabled,false);assert.equal(typeof activity.foreground,'undefined');
 }catch(e){failed=true;rows.push({error:e.stack});console.error(e.stack);}
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({result:failed?'failed':'passed',surface:'Offscreen Electron with real local PNGs/native input; synthetic drag host/elapsed unlock; no OS mouse, desktop or true embedded proof',data,productionUpdated:false,referenceImagesUploaded:false,rows},null,2));
 if(failed)app.exit(1);else app.quit();
};
