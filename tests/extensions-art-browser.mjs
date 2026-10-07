// Actual local PNG/browser checks; no generated replacement pixels or uploads.
export async function checkExtensionsArt(){
 const {loadRoomAssets,composeRoom}=await import('../ui/room-assets.mjs');
 const {loadOutfitAssets}=await import('../ui/outfit-assets.mjs');
 const {createOutfitRenderer}=await import('../ui/outfit-renderer.mjs');
 await import('../ui/placement-rules.js');const {bindings,constrainItem,validateArrangement}=globalThis.owlPlacementRules;
 const state=await window.owlFocus.snapshot(),catalog=state.collectionCatalog,pack=await loadRoomAssets(catalog);
 const load=src=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=new URL(src,import.meta.url).href;});
 const check=(v,m)=>{if(!v)throw Error(m);};check(!pack.missing.length,'Room PNG load');
 const canvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
 const scan=(i,threshold)=>{const c=canvas(i.naturalWidth,i.naturalHeight),g=c.getContext('2d',{willReadFrequently:true});g.drawImage(i,0,0);const p=g.getImageData(0,0,c.width,c.height).data;let l=c.width,t=c.height,r=-1,b=-1;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(p[(y*c.width+x)*4+3]>threshold){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);}return[l,t,r-l+1,b-t+1];};
 const assets=[];
 for(const item of catalog.items.filter(i=>i.assetState==='ready'&&i.category!=='accessory')){
  const loaded=pack.items[item.id],s=item.scene,visible=scan(loaded.image||loaded.back,4);
  const expected=s.sourceVisualBounds||s.visualBounds;check(visible.every((n,j)=>Math.abs(n-expected[j])<=1),item.id+' actual visible alpha differs');
  const thumb=await load('../ui/'+item.thumbnail.src);check(thumb.naturalWidth===256&&thumb.naturalHeight===256,item.id+' thumbnail dimensions');
  assets.push({id:item.id,size:[(loaded.image||loaded.back).naturalWidth,(loaded.image||loaded.back).naturalHeight],alphaBounds8Bit:scan(loaded.image||loaded.back,0),visualBounds:visible,declaredVisualBounds:s.sourceVisualBounds,thumbnailLoaded:true});
 }
 check(assets.length>0&&assets.length===catalog.items.filter(i=>i.assetState==='ready'&&i.category!=='accessory').length,'Every current registered real asset checked');
 for(const id of catalog.items.filter(i=>i.scene?.frontIntentionalEmpty).map(i=>i.id)){const front=pack.items[id].front,alpha=scan(front,0);check(alpha[2]<0&&alpha[3]<0,id+' front must be intentionally empty, still loaded');}
 const pendant=catalog.items.find(i=>i.id==='pendant-small'),cord=pack.items[pendant.id].cord;check(cord?.naturalWidth===20&&cord.naturalHeight===80,'Genuine cord missing');
 const eq={...state.testAccess.equipment,'wall-art':'wall-owl-mona',pendant:pendant.id,'foreground-plant':'foreground-plant-small','floor-light':'floor-light-small','side-furniture':'side-table',tabletop:'tabletop-teapot',rug:'rug-cloud'};
 validateArrangement(catalog,eq,{});
 const clamped=constrainItem(catalog,eq,{},pendant.id,{x:0,y:-1000}).position;check(pendant.scene.hanging.attachment[1]+clamped.y>=260,'Cord above ceiling');
 const [bodyAtlas,headAtlas,pitchHead]=await Promise.all(['body-parts.png','head-poses.png','head-up-sip.png'].map(n=>load('../ui/assets/motion-v7/'+n))),outfit=await loadOutfitAssets(src=>load('../ui/'+src));check(!outfit.missing.length,'Role assets');
 const source=canvas(900,1000),world=canvas(1024,1536),baseline=canvas(1024,1536),role=canvas(1024,1536),overlay=canvas(1024,1536);
 const renderer=createOutfitRenderer(source,{bodyAtlas,headAtlas,pitchHead},{...outfit.images,roomItems:pack.items},{transparentBackground:true,showLabels:false,showGround:false,separateSeat:()=>true});
 const tabletopVisibility=[];
 for(const parent of [...catalog.items.filter(i=>i.category==='side-furniture').map(i=>i.id),null]){
  const e={...eq,'side-furniture':parent},common={bodyAtlas,positions:{},catalog},g=world.getContext('2d',{willReadFrequently:true}),h=baseline.getContext('2d',{willReadFrequently:true});
  composeRoom(g,pack.base,pack.items,e,source,common);composeRoom(h,pack.base,pack.items,{...e,tabletop:null},source,common);
  const a=g.getImageData(0,0,1024,1536).data,b=h.getImageData(0,0,1024,1536).data;let different=0;
  for(let i=0;i<a.length;i+=4)if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]||a[i+3]!==b[i+3])different++;
  const supported=Boolean(globalThis.owlPlacementRules.tabletopParent(e,catalog));check(supported?different>0:different===0,'Tabletop actual visibility '+parent);tabletopVisibility.push({parent,supported,changedPixels:different});
 }
 const rows=[],phases=new Set();let maxContactError=0;
 for(const chair of ['stool','reading-chair','chair-lilac','chair-sage'])for(const lamp of ['lamp-linen','lamp-brass'])for(const plant of ['plant-leaf','plant-flower'])for(let n=0;n<=96;n++){
  const seconds=n*24.25/96,equipment={...eq,chair,lamp,plant,room:chair,accessory:'round-glasses'},frame=renderer.renderAt(seconds,{appearance:{accessory:'round-glasses',room:chair},interaction:{x:n%2?1:-1,y:n%2?-1:1,blink:n%3===0?1:0,nod:1}});
  phases.add(frame.state.phase);if(frame.contactError!==null)maxContactError=Math.max(maxContactError,frame.contactError);
  const positions={'foreground-plant-small':{...constrainItem(catalog,equipment,{},'foreground-plant-small',{x:400,y:-14}).position,size:catalog.items.find(i=>i.id==='foreground-plant-small').scene.placement.displaySize}};validateArrangement(catalog,equipment,positions);
  const g=role.getContext('2d',{willReadFrequently:true});g.clearRect(0,0,1024,1536);g.drawImage(source,224,458.2,576,640);const rolePixels=g.getImageData(0,0,1024,1536).data;
  const fg=pack.items['foreground-plant-small'],s=catalog.items.find(i=>i.id==='foreground-plant-small').scene,p=positions['foreground-plant-small'];
  const og=overlay.getContext('2d',{willReadFrequently:true});og.clearRect(0,0,1024,1536);og.drawImage(fg.image,s.placement.position[0]-s.placement.anchor[0]*s.placement.displaySize[0]/512+p.x,s.placement.position[1]-s.placement.anchor[1]*s.placement.displaySize[1]/512+p.y,...s.placement.displaySize);const over=og.getImageData(0,0,1024,1536).data;let overlap=0;
  for(let y=530;y<1110;y++)for(let x=380;x<800;x++){const a=(y*1024+x)*4+3;if(rolePixels[a]>4&&over[a]>4)overlap++;}
  check(overlap===0,'Foreground obscures moving role/cup/feet '+chair+' '+seconds);
  composeRoom(world.getContext('2d'),pack.base,pack.items,equipment,source,{legacyImages:outfit.images,bodyAtlas,roleDisplay:catalog.room.roleDisplay,positions,catalog});
  const plain={...equipment,'wall-art':null,pendant:null,'foreground-plant':null,'floor-light':null,'side-furniture':null,tabletop:null,rug:null};
  composeRoom(baseline.getContext('2d'),pack.base,pack.items,plain,source,{legacyImages:outfit.images,bodyAtlas,roleDisplay:catalog.room.roleDisplay,catalog});
  // Opaque role pixels must remain identical after the actual full compositor.
  const a=world.getContext('2d',{willReadFrequently:true}).getImageData(0,0,1024,1536).data,b=baseline.getContext('2d',{willReadFrequently:true}).getImageData(0,0,1024,1536).data;let changed=0;
  for(let y=530;y<1110;y++)for(let x=380;x<800;x++){const k=(y*1024+x)*4;if(rolePixels[k+3]===255&&[0,1,2].some(j=>a[k+j]!==b[k+j]))changed++;}
  check(changed===0,'Opaque role pixels occluded');rows.push({chair,lamp,plant,seconds,phase:frame.state.phase,foregroundOverlapPixels:overlap,opaqueRoleChangedPixels:changed});
 }
 const tallTableSamples=[];
 if(catalog.items.some(i=>i.id==='side-table-tall')){
  for(const chair of ['stool','reading-chair','chair-lilac','chair-sage'])for(const seconds of [0,2,4,6,8,10,12,14,16,18,20,24.25]){
   const e={...eq,chair,room:chair,plant:null,'foreground-plant':null,pendant:null,'side-furniture':'side-table-tall'};
   validateArrangement(catalog,e,{});
   const frame=renderer.renderAt(seconds,{appearance:{accessory:'round-glasses',room:chair},interaction:{x:1,y:-1,blink:1,nod:1}});
   const g=role.getContext('2d',{willReadFrequently:true});g.clearRect(0,0,1024,1536);g.drawImage(source,224,458.2,576,640);const rp=g.getImageData(0,0,1024,1536).data;
   composeRoom(world.getContext('2d'),pack.base,pack.items,e,source,{legacyImages:outfit.images,bodyAtlas,roleDisplay:catalog.room.roleDisplay,catalog});
   composeRoom(baseline.getContext('2d'),pack.base,pack.items,{...e,'side-furniture':null,tabletop:null},source,{legacyImages:outfit.images,bodyAtlas,roleDisplay:catalog.room.roleDisplay,catalog});
   const a=world.getContext('2d').getImageData(0,0,1024,1536).data,b=baseline.getContext('2d').getImageData(0,0,1024,1536).data;let changed=0;
   for(let y=530;y<1110;y++)for(let x=380;x<800;x++){const k=(y*1024+x)*4;if(rp[k+3]===255&&[0,1,2].some(j=>a[k+j]!==b[k+j]))changed++;}
   check(changed===0,'Tall tabletop obscures moving role/cup/feet');tallTableSamples.push({chair,seconds,phase:frame.state.phase,opaqueRoleChangedPixels:changed,contactError:frame.contactError});
  }
 }
 // Moving the parent adds its exact translation to the child's world bounds.
 const child=pos=>bindings(catalog,eq,pos).find(i=>i.category==='tabletop').worldBounds;
 const a=child({'side-table':{x:0,y:0}}),b=child({'side-table':{x:-16,y:8}});check(b[0]===a[0]-16&&b[1]===a[1]+8,'Attached tabletop movement');
 const preview={...eq,chair:'chair-lilac',room:'chair-lilac',lamp:'lamp-linen',plant:'plant-leaf',rug:'rug-cream',accessory:'red-scarf',pendant:null,'foreground-plant':null};renderer.renderAt(0,{focus:true,appearance:{accessory:'red-scarf',room:'chair-lilac'}});composeRoom(world.getContext('2d'),pack.base,pack.items,preview,source,{legacyImages:outfit.images,bodyAtlas,roleDisplay:catalog.room.roleDisplay,catalog});
 return{result:'passed',assets,tabletopVisibility,tallTableSamples,cord:{size:[20,80],displaySize:[5,20],policy:'repeat-crop',ceilingClamp:clamped},animationSamples:rows.length,phases:[...phases],maxContactError,rows,roomCapture:world.toDataURL('image/png').split(',')[1],physicalOSInput:false,scope:'Actual browser PNGs and compositor; 97 samples across frozen 24.25-second rig for each of sixteen chair/lamp/plant combinations, plus48 tall-table frames with plant omitted to avoid actual furniture collision; permitted gaze/blink/nod and foreground near-clamp. Continuous mathematical maxima and original native embedded mouse acceptance are not certified.'};
}
