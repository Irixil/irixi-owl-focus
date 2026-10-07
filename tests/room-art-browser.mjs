// Read the same PNGs and compositor as the live room; never edit source images.
export async function checkRoomArt(){
 const {createOutfitRenderer}=await import('../ui/outfit-renderer.mjs'),{loadOutfitAssets}=await import('../ui/outfit-assets.mjs'),{loadRoomAssets,composeRoom}=await import('../ui/room-assets.mjs');
 const load=src=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=new URL(src,import.meta.url).href;});
 const state=await window.owlFocus.snapshot(),[bodyAtlas,headAtlas,pitchHead]=await Promise.all(['body-parts.png','head-poses.png','head-up-sip.png'].map(n=>load('../ui/assets/motion-v7/'+n))),outfit=await loadOutfitAssets(src=>load('../ui/'+src)),pack=await loadRoomAssets(state.collectionCatalog);
 if(pack.missing.length||outfit.missing.length)throw Error('Actual room assets missing');
 const canvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;},source=canvas(900,1000),world=canvas(1024,1536),sheet=canvas(2048,6144),images={...outfit.images,roomItems:pack.items},renderer=createOutfitRenderer(source,{bodyAtlas,headAtlas,pitchHead},images,{transparentBackground:true,showLabels:false,showGround:false,separateSeat:()=>true}),rows=[];
 const mask=draw=>{const c=canvas(1024,1536),ctx=c.getContext('2d',{willReadFrequently:true});draw(ctx);return ctx.getImageData(0,0,1024,1536).data;};
 const lamps=Object.fromEntries(['lamp-linen','lamp-brass'].map(id=>[id,mask(ctx=>ctx.drawImage(pack.items[id].image,0,0))]));
 const plants=Object.fromEntries(['plant-leaf','plant-flower'].map(id=>[id,mask(ctx=>ctx.drawImage(pack.items[id].image,0,0))]));
 const rugs=Object.fromEntries(['rug-cream','rug-pattern'].map(id=>[id,mask(ctx=>ctx.drawImage(pack.items[id].image,0,0))]));
 const sceneById=Object.fromEntries(state.collectionCatalog.items.map(i=>[i.id,i.scene]));
 for(const chair of ['stool','reading-chair','chair-lilac','chair-sage']){
  const chairMask=mask(ctx=>{ctx.translate(85,300);ctx.scale(.681,.681);if(chair==='stool')ctx.drawImage(bodyAtlas,793,629,450,303,363,874,532,274);else{ctx.drawImage(pack.items[chair]?.back||images.chairBack,0,0);ctx.drawImage(pack.items[chair]?.front||images.chairFront,0,0);}});
  for(const lamp of ['lamp-linen','lamp-brass'])for(const rug of ['rug-cream','rug-pattern'])for(const plant of ['plant-leaf','plant-flower']){
   const equipment={lamp,rug,chair,room:chair,plant,accessory:'round-glasses'},a=lamps[lamp],plantPixels=plants[plant],potTop=sceneById[plant].collisionBounds[1];let overlap=0,lampRight=-1,chairLeft=1024,plantOverlap=0,potOverlap=0,potLeft=1024,chairRight=-1;
   for(let y=0;y<1536;y++)for(let x=0;x<1024;x++){const p=(y*1024+x)*4+3;if(a[p]>4&&chairMask[p]>4)overlap++;if(plantPixels[p]>4&&chairMask[p]>4){plantOverlap++;if(y>=potTop)potOverlap++;}if(y>=potTop){if(plantPixels[p]>4)potLeft=Math.min(potLeft,x);if(chairMask[p]>4)chairRight=Math.max(chairRight,x);}if(y>=970&&y<=1083){if(a[p]>4)lampRight=Math.max(lampRight,x);if(chairMask[p]>4)chairLeft=Math.min(chairLeft,x);}}
   renderer.renderAt(0,{focus:true,appearance:equipment});composeRoom(world.getContext('2d'),pack.base,pack.items,equipment,source,{legacyImages:images,bodyAtlas,roleDisplay:state.collectionCatalog.room.roleDisplay});
   sheet.getContext('2d').drawImage(world,(rows.length%4)*512,Math.floor(rows.length/4)*768,512,768);
   rows.push({chair,lamp,rug,plant,alphaThreshold:4,lampChairOverlapPixels:overlap,lampFloorRight:lampRight,chairFloorLeft:chairLeft,floorGapPixels:chairLeft-lampRight-1,chairPlantOverlapPixels:plantOverlap,chairPotOverlapPixels:potOverlap,potRegionYMin:potTop,chairPotGapPixels:potLeft-chairRight-1});
  }
 }
 const pixelsById={...lamps,...plants,...rugs};
 const boundary=(id,yMin=0)=>{const p=pixelsById[id];let l=1024,t=1536,r=-1,b=-1;for(let y=yMin;y<1536;y++)for(let x=0;x<1024;x++)if(p[(y*1024+x)*4+3]>4){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);}return{x:l,y:t,width:r-l+1,height:b-t+1,bottom:b};};
 const stemScans=Object.fromEntries(Object.keys(lamps).map(id=>[id,[700,850,1000].map(y=>{const runs=[];let start=null;for(let x=75;x<=185;x++){const i=(y*1024+x)*4,p=lamps[id],ink=x<185&&p[i+3]>64&&p[i+1]<215&&p[i]-p[i+1]>20&&p[i+1]-p[i+2]>20;if(ink&&start===null)start=x;if(!ink&&start!==null){runs.push([start,x-1]);start=null;}}return{y,warmStrokeRuns:runs};})]));
 return{rows,lampBounds:Object.fromEntries(Object.keys(lamps).map(id=>[id,boundary(id)])),assetBounds:Object.fromEntries(Object.keys(pixelsById).map(id=>[id,boundary(id)])),hardwareBounds:Object.fromEntries([...Object.keys(lamps),...Object.keys(plants)].map(id=>[id,boundary(id,sceneById[id].collisionBounds[1])])),stemScans,sheet:sheet.toDataURL('image/png').split(',')[1],scope:'Actual Canvas renderer, 32 combinations including both legacy seats; full lamp-chair and chair-plant alpha overlap plus floor hardware gaps; quiet focus pose only. No physical desktop or hover acceptance.'};
}
