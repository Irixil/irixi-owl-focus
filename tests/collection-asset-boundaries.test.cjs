'use strict';
// Source-only Node harness. No browser, Electron, network, or real pixels.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const root = path.resolve(__dirname, '..');
const {initialState} = require(path.join(root, 'src/core.cjs'));
const {CATALOG, itemStates} = require(path.join(root, 'src/collection.cjs'));
const {FocusService} = require(path.join(root, 'src/service.cjs'));
const {canvasFixture} = require(path.join(root, 'tests/helpers/canvas.cjs'));
const mod = name => import(pathToFileURL(path.join(root, 'ui', name)).href);
const tag = name => ({tag:name,width:1254,height:1254,naturalWidth:1254,naturalHeight:1254});
function ownedState() {
 const s = initialState(); s.collection.owned = s.unlocked = CATALOG.items.filter(i => !i.starter).map(i => i.id);
 s.preferences.reducedMotion = true;
 s.collectionCatalog = {...structuredClone(CATALOG),items:itemStates(s)};
 return s;
}

test('REGRESSION: unavailable preview preserves current reading-chair instead of replacing it with stool', async () => {
 const {resolveAppearance} = await mod('equipment-view.mjs');
 const s = ownedState(); s.equipment.chair = s.equipment.room = 'reading-chair';
 s.collectionCatalog.items.find(i=>i.id==='chair-lilac').assetState = 'missing';
 const images = {chairBack:tag('old-back'),chairFront:tag('old-front'),roomItems:{}};
 assert.equal(resolveAppearance(s,images).room,'reading-chair');
 const preview = resolveAppearance(s,images,{chair:'chair-lilac'});
 assert.equal(preview.room,'reading-chair','Panel says current equipment remains visible, but preview substitutes stool');
});

test('REGRESSION: front layer remains rendered for new chairs when room background is unavailable', async () => {
 const {createOutfitRenderer} = await mod('outfit-renderer.mjs');
 const f = canvasFixture();
 const renderer = createOutfitRenderer(f.canvas,{bodyAtlas:tag('body'),headAtlas:tag('heads'),pitchHead:tag('pitch')},
  {roomItems:{'chair-lilac':{back:tag('new-back'),front:tag('new-front')}}},
  {makeCanvas:f.makeCanvas,transparentBackground:true,showLabels:false,showGround:false,separateSeat:()=>false});
 renderer.renderAt(0,{focus:true,appearance:{accessory:null,room:'chair-lilac'}});
 assert.ok(f.allDraws.some(d=>d.image==='new-back'));
 assert.ok(f.allDraws.some(d=>d.image==='new-front'),'Loaded new-chair front is silently omitted by the no-room-background renderer');
});


test('unavailable furniture preview retains the old slot, including room-background failure', async () => {
 const {resolveAppearance}=await mod('equipment-view.mjs');
 const state=ownedState();state.equipment.lamp='lamp-brass';
 const images={roomItems:{'lamp-brass':{image:tag('old-lamp')},'lamp-linen':{image:tag('new-lamp')}}};
 const missingBase=resolveAppearance(state,images,{lamp:'lamp-linen'});
 assert.equal(missingBase.previewAvailable,false);assert.equal(missingBase.equipment.lamp,'lamp-brass');
 images.roomBase=tag('base');
 const ready=resolveAppearance(state,images,{lamp:'lamp-linen'});
 assert.equal(ready.previewAvailable,true);assert.equal(ready.equipment.lamp,'lamp-linen');
 delete images.roomItems['lamp-linen'];
 const missingItem=resolveAppearance(state,images,{lamp:'lamp-linen'});
 assert.equal(missingItem.previewAvailable,false);assert.equal(missingItem.equipment.lamp,'lamp-brass');
});

class Element {
 constructor(tag='div') {this.tagName=tag;this.children=[];this.dataset={};this.attrs={};this.events=new Map();this.hidden=false;this.disabled=false;this.textContent='';}
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this.children=nodes;}
 setAttribute(k,v){this.attrs[k]=v;}
 addEventListener(k,f){if(!this.events.has(k))this.events.set(k,[]);this.events.get(k).push(f);}
 removeEventListener(k,f){this.events.set(k,(this.events.get(k)||[]).filter(v=>v!==f));}
 querySelectorAll(selector){const found=[];for(const c of this.children){if(selector==='[data-item]'&&c.dataset.item||selector==='[aria-pressed]'&&'aria-pressed' in c.attrs)found.push(c);found.push(...c.querySelectorAll(selector));}return found;}
 async click(){if(this.disabled)return;for(const fn of this.events.get('click')||[])await fn({target:this});}
}

test('REGRESSION: healthy thumbnail cannot authorize whole save after the main room asset fails', async () => {
 const savedGlobals = Object.fromEntries(['window','document','Image','requestAnimationFrame','cancelAnimationFrame'].map(k=>[k,{exists:k in globalThis,value:globalThis[k]}]));
 const f=canvasFixture(), canvases=[];
 const pixels = new Uint8ClampedArray(900*1000*4);pixels[(100*900+100)*4+3]=255;pixels[(900*900+800)*4+3]=255;
 function makeCanvas(){const el=new Element('canvas'),c=f.makeCanvas(),ctx=c.getContext('2d');ctx.getImageData=()=>({data:pixels});el.width=c.width;el.height=c.height;el.tag=c.tag;el.getContext=()=>ctx;el.ownerDocument={createElement:makeElement};canvases.push(el);return el;}
 function makeElement(tag){return tag==='canvas'?makeCanvas():new Element(tag);}
 const ids=['collection-open','wardrobe-toggle','collection-mode','collection-panel','collection-tabs','collection-cards','collection-preview','collection-preview-name','collection-message','collection-confirm','collection-cancel','owl-canvas','owl-fallback','motion-note','collection-back','collection-retained','collection-defaults'];
 const elements=Object.fromEntries(ids.map(id=>[id,id.endsWith('-canvas')?makeCanvas():new Element()]));
 const details=new Element('details');details.open=true;
 const rootDom={querySelector:selector=>elements[selector.slice(1)]};
 const media={matches:true,addEventListener(){},removeEventListener(){}};
 globalThis.window={matchMedia:()=>media};
 globalThis.document={hidden:false,createElement:makeElement,addEventListener(){},removeEventListener(){}};
 globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};
 const loads=[],delayedFailures=new Map();
 globalThis.Image=class {
  set src(url){this.tag=url.split('/').at(-1);loads.push(this.tag);let w=1254,h=1254;
   if(this.tag.startsWith('glasses-')){w=800;h=520;}
   else if(this.tag.endsWith('-thumb.png')){w=h=256;}
   else if(/^(room-base|lamp-|rug-|plant-)/.test(this.tag)){w=1024;h=1536;}
   this.width=this.naturalWidth=w;this.height=this.naturalHeight=h;
   if(this.tag.startsWith('pending-'))delayedFailures.set(this.tag,()=>this.onerror());else queueMicrotask(()=>['lamp-linen.png','failed-thumb.png'].includes(this.tag)?this.onerror():this.onload());
  }
 };
 let panel,scene;
 try {
  const {bindCollectionPanel}=await mod('collection-panel.mjs');
  const {createOwlScene}=await mod('owl-scene.mjs');
  const initial=ownedState();delete initial.collectionCatalog;initial.equipment.lamp='lamp-brass';let durable=structuredClone(initial),writes=0,requests=0;
  const service=new FocusService({read:()=>structuredClone(durable),write:s=>{durable=structuredClone(s);writes++;},close(){}},{clock:()=>({wall:1000,mono:0})});
  scene=createOwlScene({canvas:elements['owl-canvas'],fallback:elements['owl-fallback'],notice:elements['motion-note'],onAppearance:look=>panel?.setPreviewReady(look.canConfirmPreview)});
  const sync=(state,busy=false)=>{scene.update(state);panel.update(state,busy);};
  panel=bindCollectionPanel({placementBinder:()=>({setMode(){},choose(){},repaint(){},dispose(){}}),root:rootDom,details,onPreview:equipment=>scene.setPreviewEquipment(equipment),onSave:extra=>({ok:true,state:service.dispatch({type:'equip-set',...extra,requestId:'actual-panel-confirm-'+(++requests)})})});
  service.on('change',s=>sync(s));sync(service.snapshot());
  await elements['collection-open'].click();
  await new Promise(resolve=>setImmediate(resolve));
  const card=elements['collection-cards'].children.find(e=>e.dataset.item==='lamp-linen');
  assert.equal(card.dataset.assetFailed,undefined,'Thumbnail is healthy');
  await card.click();await new Promise(resolve=>setImmediate(resolve));
  const assetStatus=JSON.parse(elements['owl-canvas'].dataset.roomAssets);
  assert.ok(assetStatus.missing.includes('布罩落地灯'),'Real room loader observed injected scene failure');
  assert.ok(!assetStatus.loaded.includes('lamp-linen'));
  const enabled=!elements['collection-confirm'].disabled;
  await elements['collection-confirm'].click();
  console.log(JSON.stringify({observedSceneFailure:assetStatus.missing,confirmEnabled:enabled,persistedLamp:durable.equipment.lamp,thumbnailLoaded:loads.includes('lamp-linen-thumb.png')}));
  assert.equal(service.snapshot().equipment.lamp,'lamp-brass','Unavailable scene must leave the previous equipment intact');
  assert.equal(durable.equipment.lamp,'lamp-brass');assert.equal(writes,0,'Unavailable scene must not save');
  assert.equal(enabled,false,'Panel must not allow confirmation after its preview scene reports the selected asset unavailable');
  // Healthy scene + missing thumbnail stays blocked through the same busy
  // update cycle used by app.js; status must survive synchronous redraws.
  service.dispatch({type:'equip',slot:'lamp',item:null,requestId:'clear-for-controls'});writes=0;
  const snapshot=service.snapshot();
  const setThumb=name=>{const next=structuredClone(snapshot);next.collectionCatalog.items.find(i=>i.id==='lamp-brass').thumbnail.src='assets/room-v30/'+name;return next;};
  const selectBrass=async()=>{await elements['collection-cards'].children.find(e=>e.dataset.item==='lamp-brass').click();await new Promise(resolve=>setImmediate(resolve));};
  const failedThumb=setThumb('failed-thumb.png');sync(failedThumb);await selectBrass();
  assert.equal(elements['collection-confirm'].disabled,true,'Failed thumbnail blocks confirmation');
  sync(failedThumb,true);sync(failedThumb,false);
  assert.equal(elements['collection-confirm'].disabled,true,'Busy redraw must not temporarily clear failure');
  await new Promise(resolve=>setImmediate(resolve));assert.equal(elements['collection-confirm'].disabled,true);
  await elements['collection-cancel'].click();assert.equal(writes,0);assert.equal(elements['collection-preview'].hidden,true);

  // An obsolete same-ID thumbnail failure cannot disable a newer successful
  // thumbnail. This models a catalog/asset metadata refresh, not real pixels.
  sync(setThumb('pending-old-thumb.png'));panel.open();await selectBrass();
  assert.equal(elements['collection-confirm'].disabled,true,'Pending thumbnail blocks confirmation');
  assert.ok(delayedFailures.has('pending-old-thumb.png'));
  sync(setThumb('healthy-new-thumb.png'));await new Promise(resolve=>setImmediate(resolve));
  assert.equal(elements['collection-confirm'].disabled,false,'Healthy current thumbnail and scene enable confirmation');
  delayedFailures.get('pending-old-thumb.png')();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(elements['collection-confirm'].disabled,false,'Obsolete same-ID failure must be ignored');
  const refreshedCatalog=setThumb('healthy-new-thumb.png');refreshedCatalog.collectionCatalog.version+='-reload';
  sync(refreshedCatalog);
  assert.equal(elements['collection-confirm'].disabled,true,'New scene catalog must finish loading before confirmation');
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(elements['collection-confirm'].disabled,false,'Resolved current scene catalog restores readiness');

  await elements['collection-confirm'].click();
  assert.equal(writes,1);assert.equal(service.snapshot().equipment.lamp,'lamp-brass');
  assert.equal(elements['collection-preview'].hidden,true,'Successful confirmation closes the preview');

 } finally {panel?.dispose();scene?.dispose();for(const [k,p] of Object.entries(savedGlobals)){if(p.exists)globalThis[k]=p.value;else delete globalThis[k];}}
});
