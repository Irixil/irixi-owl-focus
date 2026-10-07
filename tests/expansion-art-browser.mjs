// Actual local compositor evidence; no OS input or replacement artwork.
export async function checkExpansionArt(){
 const {loadRoomAssets,composeRoom}=await import('../ui/room-assets.mjs'),{loadOutfitAssets}=await import('../ui/outfit-assets.mjs'),{createOutfitRenderer}=await import('../ui/outfit-renderer.mjs'),{createOwlRenderer}=await import('../ui/renderers/owl-equipped.mjs');
 const state=await window.owlFocus.snapshot(),catalog=state.collectionCatalog,pack=await loadRoomAssets(catalog);
 const load=src=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=new URL(src,import.meta.url).href;});
 const [bodyAtlas,headAtlas,pitchHead]=await Promise.all(['body-parts.png','head-poses.png','head-up-sip.png'].map(n=>load('../ui/assets/motion-v7/'+n))),outfit=await loadOutfitAssets(src=>load('../ui/'+src));
 const check=(v,m)=>{if(!v)throw Error(m);},canvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
 check(!pack.missing.length&&!outfit.missing.length,'All actual assets load');
 const source=canvas(900,1000),world=canvas(1024,1536),plain=canvas(1024,1536),role=canvas(1024,1536),sheet=canvas(2560,1536);
 const renderer=createOutfitRenderer(source,{bodyAtlas,headAtlas,pitchHead},{...outfit.images,roomItems:pack.items},{transparentBackground:true,showLabels:false,showGround:false,separateSeat:()=>true});
 // Locate extrema cheaply on every source60fps instant, then render those
 // exact instants in addition to the97 regular frames. Still a finite proof.
 const curve=createOwlRenderer(canvas(900,1000),{bodyAtlas,headAtlas,pitchHead},{transparentBackground:true,showLabels:false,showGround:false}),extrema={};
 for(let n=0;n<=1455;n++){const seconds=n/60,s=curve.stateAt(seconds);for(const key of ['q','dy','raise','head','cx','tilt','sip','pitch','feet','yaw','sway','swayHead','swayBody'])if(Number.isFinite(s[key])){const e=extrema[key]||{min:{value:Infinity},max:{value:-Infinity}};if(s[key]<e.min.value)e.min={value:s[key],seconds};if(s[key]>e.max.value)e.max={value:s[key],seconds};extrema[key]=e;}}
 const times=[...new Set([...Array.from({length:97},(_,n)=>n*24.25/96),...Object.values(extrema).flatMap(e=>[e.min.seconds,e.max.seconds])])].sort((a,b)=>a-b);
 const chairs=catalog.items.filter(i=>i.category==='chair'&&i.assetState==='ready'),parents=catalog.items.filter(i=>i.supportsTabletop),props=catalog.items.filter(i=>i.category==='tabletop'),foreground=catalog.items.filter(i=>i.category==='foreground-plant'),rows=[],visibility=[];
 const common={bodyAtlas,catalog,legacyImages:outfit.images,roleDisplay:catalog.room.roleDisplay};
 for(const parent of [...parents,catalog.items.find(i=>i.id==='low-bookcase'),null])for(const prop of props){
  const equipment={...state.testAccess.equipment,'side-furniture':parent?.id||null,tabletop:prop.id},g=world.getContext('2d',{willReadFrequently:true}),h=plain.getContext('2d',{willReadFrequently:true});
  globalThis.owlPlacementRules.validateArrangement(catalog,equipment,{});composeRoom(g,pack.base,pack.items,equipment,source,common);composeRoom(h,pack.base,pack.items,{...equipment,tabletop:null},source,common);
  const a=g.getImageData(0,0,1024,1536).data,b=h.getImageData(0,0,1024,1536).data;let changes=0;for(let i=0;i<a.length;i+=4)if([0,1,2,3].some(j=>a[i+j]!==b[i+j]))changes++;
  check(parent?.supportsTabletop?changes>0:changes===0,'Actual tabletop visibility '+parent?.id+' '+prop.id);visibility.push({parent:parent?.id||null,prop:prop.id,changedPixels:changes});
 }
 for(const [index,chair] of chairs.entries())for(const seconds of times){
  const equipment={...state.testAccess.equipment,chair:chair.id,room:chair.id,accessory:'round-glasses','side-furniture':'side-cabinet-drawer',tabletop:props[Math.min(props.length-1,index)].id,'floor-light':'floor-light-tripod','foreground-plant':foreground[index%foreground.length].id,plant:null};
  const positions={};globalThis.owlPlacementRules.validateArrangement(catalog,equipment,positions);
  const frame=renderer.renderAt(seconds,{appearance:{accessory:'round-glasses',room:chair.id},interaction:{x:index%2?1:-1,y:index%2?-1:1,blink:1,nod:1}});
  const r=role.getContext('2d',{willReadFrequently:true});r.clearRect(0,0,1024,1536);r.drawImage(source,224,458.2,576,640);const mask=r.getImageData(0,0,1024,1536).data;
  const g=world.getContext('2d',{willReadFrequently:true}),h=plain.getContext('2d',{willReadFrequently:true});composeRoom(g,pack.base,pack.items,equipment,source,{...common,positions});composeRoom(h,pack.base,pack.items,{...equipment,'foreground-plant':null,'side-furniture':null,tabletop:null,'floor-light':null},source,{...common,positions});
  const a=g.getImageData(0,0,1024,1536).data,b=h.getImageData(0,0,1024,1536).data;let changes=0;for(let i=0;i<a.length;i+=4)if(mask[i+3]===255&&[0,1,2].some(j=>a[i+j]!==b[i+j]))changes++;
  check(changes===0,'Moving owl/cup/feet occlusion '+chair.id+' '+seconds);check(frame.contactError===null||frame.contactError<1e-6,'Cup contact');rows.push({chair:chair.id,seconds,phase:frame.state.phase,opaqueRoleChangedPixels:changes,contactError:frame.contactError});
  if(seconds===0)sheet.getContext('2d').drawImage(world,index*512,0,512,768);
  if(seconds===times.at(-1))sheet.getContext('2d').drawImage(world,index*512,768,512,768);
 }
 return {result:'passed',chairs:chairs.map(i=>i.id),animationFrames:rows.length,regularAndExtremaTimes:times,source60fpsExtrema:extrema,rows,tabletopVisibility:visibility,chairRoomBounds:chairs.map(i=>({id:i.id,visual:i.scene.visualBounds,hardware:i.scene.collisionBounds,contacts:i.scene.contacts})),sheet:sheet.toDataURL('image/png').split(',')[1],scope:'Actual five new-style chairs and compositor at97 regular times plus source60fps curve extrema;all4 supported parents×5 props plus bookcase/none. Finite samples,not mathematical continuous maxima or OS physical acceptance.'};
}
