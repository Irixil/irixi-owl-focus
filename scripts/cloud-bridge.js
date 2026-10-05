'use strict';
// Synthetic browser test bridge; never included in production HTML/preload.
const stream=new EventSource('/test/events'),listeners={focus:new Set(),activity:new Set()};
for(const kind of Object.keys(listeners))stream.addEventListener(kind,event=>{const value=JSON.parse(event.data);for(const fn of listeners[kind])fn(value);});
const get=async route=>{const res=await fetch(route);const v=await res.json();if(!res.ok)throw Error(v.error);return v;};
const post=async(route,value)=>{const res=await fetch(route,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(value)});const v=await res.json();if(!res.ok)throw Error(v.error);return v;};
const subscribe=(kind,fn)=>{listeners[kind].add(fn);return ()=>listeners[kind].delete(fn);};let seconds=1500;
window.owlFocus={snapshot:()=>get('/test/snapshot'),command:v=>post('/test/command',v),subscribe:fn=>subscribe('focus',fn),activitySnapshot:()=>get('/test/activity-snapshot'),activityCommand:v=>post('/test/activity-command',v),subscribeActivity:fn=>subscribe('activity',fn),defaults:async v=>{if(v)seconds=v.seconds;return {seconds};},resizeWidget:async()=>false,drag:async()=>false,onDragReset:()=>()=>{},openOtherView:()=>{throw Error('Native entry unavailable in synthetic browser test');}};
window.owlCloudTest={advance:ms=>post('/test/advance',{ms}),app:app=>post('/test/synthetic-app',{app}),nativeMacVerification:false,realAppQueries:0};
window.addEventListener('DOMContentLoaded',()=>{
 document.body.dataset.testEnvironment='synthetic-cloud';document.getElementById('other-view').hidden=true;document.getElementById('widget-size').disabled=true;
 const note=document.createElement('p');note.id='cloud-synthetic-notice';note.className='rule';note.textContent='合成云端测试：APP 均为模拟数据，不读取这台电脑的真实活动；原生收起须在 Mac 验收。';document.getElementById('app-records').prepend(note);
});
window.addEventListener('beforeunload',()=>stream.close());
