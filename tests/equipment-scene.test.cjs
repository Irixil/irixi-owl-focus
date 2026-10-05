'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {canvasFixture}=require('./helpers/canvas.cjs');
test('scene redraws an equipment change while paused/reduced without running visual time or changing timer state',async()=>{
  const {OUTFIT_FILES}=await import('../ui/outfit-assets.mjs');
  const previous=Object.fromEntries(['window','document','Image','requestAnimationFrame','cancelAnimationFrame'].map(k=>[k,{exists:k in globalThis,value:globalThis[k]}]));
  const raf=new Map(),docListeners=new Map(),mediaListeners=new Map();let ids=0;
  const media={matches:true,addEventListener:(k,f)=>mediaListeners.set(k,f),removeEventListener:k=>mediaListeners.delete(k)};
  const f=canvasFixture(),attrs={};f.canvas.ownerDocument={createElement:()=>f.makeCanvas()};f.canvas.setAttribute=(k,v)=>attrs[k]=v;
  f.canvas.dataset={};let sourceCreated=false;
  // Geometry-only fixture: two opaque points provide crop bounds, not real artwork pixels.
  const makeCanvas=()=>{const c=f.makeCanvas();c.ownerDocument={createElement:makeCanvas};if(!sourceCreated){sourceCreated=true;const ctx=c.getContext('2d');ctx.clearRect=()=>f.reset();ctx.getImageData=()=>{const data=new Uint8ClampedArray(900*1000*4);data[(100*900+100)*4+3]=255;data[(900*900+800)*4+3]=255;return {data};};}return c;};
  globalThis.window={matchMedia:()=>media};globalThis.document={hidden:false,createElement:makeCanvas,addEventListener:(k,fn)=>docListeners.set(k,fn),removeEventListener:k=>docListeners.delete(k)};
  globalThis.requestAnimationFrame=fn=>{const id=++ids;raf.set(id,fn);return id;};globalThis.cancelAnimationFrame=id=>raf.delete(id);
  globalThis.Image=class {
    set src(url){this.tag=url.split('/').at(-1);const row=Object.values(OUTFIT_FILES).find(([n])=>n===this.tag);this.width=this.naturalWidth=row?.[1]||1254;this.height=this.naturalHeight=row?.[2]||1254;queueMicrotask(()=>this.onload());}
  };
  const fallback={hidden:false},notice={},summaries=[];let scene;
  const paint=()=>{assert.equal(raf.size,0);const result=f.allDraws.map(d=>d.image);f.reset();return result;};
  try{
    const {createOwlScene}=await import('../ui/owl-scene.mjs');
    scene=createOwlScene({canvas:f.canvas,fallback,notice,onAppearance:v=>summaries.push(v)});
    let state={revision:1,unlocked:['round-glasses','reading-chair'],equipment:{accessory:'red-scarf',room:'stool'},preferences:{reducedMotion:true},active:{kind:'focus',status:'paused'},totalFocusMs:300000};
    scene.update(state);await new Promise(resolve=>setImmediate(resolve));
    const initial=paint();assert.ok(initial.includes('body-parts.png'));assert.ok(!initial.includes('glasses-front.png'));
    state=structuredClone(state);state.revision++;state.equipment={accessory:'round-glasses',room:'reading-chair'};const before=JSON.stringify(state);scene.update(state);
    const dressed=paint();assert.ok(dressed.includes('reading-chair-back.png'));assert.ok(dressed.includes('glasses-front.png'));assert.match(attrs['aria-label'],/圆眼镜/);assert.equal(JSON.stringify(state),before);
    state=structuredClone(state);state.revision++;state.equipment={accessory:null,room:'stool'};scene.update(state);const noGlasses=paint();assert.ok(noGlasses.includes('body-parts.png'));assert.ok(!noGlasses.includes('glasses-front.png'));assert.ok(!noGlasses.includes('reading-chair-back.png'));
    assert.match(summaries.at(-1).summary,/红围巾/);assert.match(summaries.at(-1).summary,/不戴眼镜/);assert.equal(fallback.hidden,true);assert.equal(f.canvas.hidden,false);
    media.matches=false;mediaListeners.get('change')();paint();assert.equal(state.totalFocusMs,300000);
    scene.dispose();assert.equal(raf.size,0);assert.equal(docListeners.size,0);assert.equal(mediaListeners.size,0);
    // Exercise failed local-image loading through the real scene entry point.
    const ReadyImage=globalThis.Image;
    sourceCreated=false;
    globalThis.Image=class extends ReadyImage {set src(url){if(url.endsWith('glasses-left30.png')||url.endsWith('reading-chair-front.png'))queueMicrotask(()=>this.onerror());else super.src=url;}};
    state=structuredClone(state);state.equipment={accessory:'round-glasses',room:'reading-chair'};const missingBefore=JSON.stringify(state);
    scene=createOwlScene({canvas:f.canvas,fallback,notice,onAppearance:v=>summaries.push(v)});scene.update(state);await new Promise(resolve=>setImmediate(resolve));
    const missing=paint();assert.ok(missing.includes('body-parts.png'));assert.ok(!missing.includes('glasses-front.png'));assert.ok(!missing.includes('reading-chair-back.png'));
    assert.match(summaries.at(-1).summary,/画面暂不可用/);assert.equal(fallback.hidden,false);assert.equal(f.canvas.hidden,true);assert.equal(JSON.stringify(state),missingBefore);
    scene.dispose();assert.equal(raf.size,0);assert.equal(docListeners.size,0);assert.equal(mediaListeners.size,0);
  }finally{scene?.dispose();for(const [k,p] of Object.entries(previous)){if(p.exists)globalThis[k]=p.value;else delete globalThis[k];}}
});
