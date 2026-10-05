'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const load=()=>import('../ui/motion-clock.mjs');
const active=(kind='focus',status='running')=>({active:{kind,status},preferences:{reducedMotion:false}});
test('focus snapshots do not restart visual time; pause freezes and resume excludes paused time',async()=>{
  const {MotionClock}=await load(),c=new MotionClock(()=>0);
  c.update(active());c.sample(0);for(let t=100;t<=1000;t+=100)c.sample(t);
  assert.ok(Math.abs(c.sample(1100).seconds-1.1)<1e-9);
  c.update(active());assert.ok(Math.abs(c.sample(1200).seconds-1.2)<1e-9);
  c.update(active('focus','paused'));const paused=c.sample(1300);
  assert.equal(c.sample(9000).seconds,paused.seconds);assert.equal(paused.animating,false);
  c.update(active());assert.equal(c.sample(9100).seconds,paused.seconds);
  assert.ok(Math.abs(c.sample(9200).seconds-1.3)<1e-9);
});
test('idle/rest uses finite source clips, random still time and no immediate repeat',async()=>{
  const {MotionClock,CLIPS}=await load(),c=new MotionClock(()=>0);
  c.update(active('break'));let sample=c.sample(0);assert.equal(sample.wakeAfterMs,8000);
  sample=c.sample(8000);assert.equal(sample.name,'tea');assert.equal(sample.focus,false);
  for(let t=8100;t<=17800;t+=100)sample=c.sample(t);
  assert.equal(sample.animating,false);assert.equal(sample.focus,true);assert.equal(sample.wakeAfterMs,8000);
  sample=c.sample(25800);assert.equal(sample.name,'blink');
  assert.ok(CLIPS.every(clip=>clip.start>=0&&clip.end<=24.25&&clip.start<clip.end));
  const varied=new MotionClock(()=>.8);assert.equal(varied.sample(0).wakeAfterMs,20000);
});
test('reduced motion, system preference, fault and visibility never write or advance focus state',async()=>{
  const {MotionClock}=await load(),c=new MotionClock(()=>0),s=active();s.totalFocusMs=500;
  const before=JSON.stringify(s);c.update(s,true);assert.deepEqual(c.sample(5000),{seconds:0,focus:true,animating:false,wakeAfterMs:null});
  c.update({...s,preferences:{reducedMotion:true}});assert.equal(c.sample(9000).animating,false);
  c.update(s);c.sample(10000);c.sample(10100);c.resetWallAnchor();assert.equal(c.sample(30000).seconds,.1);
  c.update({...s,fault:'storage failed'});assert.equal(c.sample(40000).animating,false);
  assert.equal(JSON.stringify(s),before);
});
test('current source supports bounded full-view turns and quiet focus without requiring application launch',async()=>{
  const {createOwlRenderer}=await import('../ui/assets/motion-v7/owl-renderer.mjs');
  const noop=()=>{},ctx=new Proxy({imageSmoothingEnabled:false,createLinearGradient:()=>({addColorStop:noop}),createRadialGradient:()=>({addColorStop:noop})},{get:(o,k)=>k in o?o[k]:noop});
  const makeCanvas=(width,height)=>({width,height,getContext:()=>ctx});
  const renderer=createOwlRenderer(makeCanvas(900,1000),{bodyAtlas:{},headAtlas:{}},{makeCanvas,showLabels:false});
  assert.equal(renderer.duration,24.25);assert.equal(renderer.fps,60);
  const left=renderer.stateAt(12.75);assert.ok(left.yaw<=-59&&left.yaw>=-60);
  const right=renderer.stateAt(15);assert.ok(right.yaw>=59&&right.yaw<=60);
  const focus=renderer.renderAt(50,{focus:true}).state;assert.equal(focus.raise,0);assert.equal(focus.sip,0);assert.ok(Math.abs(focus.q)<=.009);
  assert.ok(renderer.landmarks.landmarks.left60&&renderer.landmarks.landmarks.right60);
});
