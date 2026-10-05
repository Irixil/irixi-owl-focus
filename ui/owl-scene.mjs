import { createOutfitRenderer } from './outfit-renderer.mjs';
import { MotionClock } from './motion-clock.mjs';
import { loadOutfitAssets, OUTFIT_PACK } from './outfit-assets.mjs';
import { resolveAppearance } from './equipment-view.mjs';

const loadImage = src => new Promise((resolve,reject)=>{
  const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('动画素材无法读取'));
  image.src=new URL(src,import.meta.url).href;
});
export function createOwlScene({canvas,fallback,notice,onAppearance=()=>{},outfitPack=OUTFIT_PACK}) {
  const clock=new MotionClock(),media=window.matchMedia('(prefers-reduced-motion: reduce)');
  let renderer,latest,images={},appearance,raf=null,wake=null,disposed=false,failed=false,lastPaint=-Infinity,lastPose;
  const source=document.createElement('canvas');source.width=900;source.height=1000;
  let crop;
  function measureCrop(){
    let left=900,top=1000,right=0,bottom=0;
    const context=source.getContext('2d',{willReadFrequently:true});
    // Union of original poses and both seats; transparent atlas padding is not artwork.
    for(const room of ['stool','reading-chair'])for(let step=0;step<=48;step++){
      renderer.renderAt(step*24.25/48,{appearance:{accessory:'round-glasses',room}});
      const pixels=context.getImageData(0,0,900,1000).data;
      for(let y=0;y<1000;y+=2)for(let x=0;x<900;x+=2)if(pixels[(y*900+x)*4+3]>8){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
    }
    if(right<=left||bottom<=top)throw Error('Empty artwork bounds');
    const margin=12;left=Math.max(0,left-margin);top=Math.max(0,top-margin);right=Math.min(900,right+margin);bottom=Math.min(1000,bottom+margin);
    crop={x:left,y:top,width:right-left,height:bottom-top};canvas.width=crop.width;canvas.height=crop.height;canvas.dataset.sourceCrop=JSON.stringify(crop);
  }
  function cancel(){if(raf!==null)cancelAnimationFrame(raf);if(wake!==null)clearTimeout(wake);raf=wake=null;}
  function publishAppearance(){if(!latest)return;appearance=resolveAppearance(latest,images);onAppearance({...appearance,summary:failed?'画面暂不可用；已保留原始参考形象，装扮选择仍保存在记录中。':appearance.summary});canvas.setAttribute('aria-label',appearance.label);}
  function fail(){failed=true;cancel();canvas.hidden=true;fallback.hidden=false;notice.textContent='动画暂不可用，已保留静态形象。';publishAppearance();}
  function frame(now,initial=false) {
    raf=null;wake=null;if(disposed||failed||!renderer||(!initial&&document.hidden)||!latest)return;
    try {
      const sample=clock.sample(now),pose=[sample.seconds,sample.focus,appearance?.key].join(':');
      const budget=clock.policy.kind==='focus'?1000/30:1000/60;
      if(pose!==lastPose&&(now-lastPaint>=budget||!sample.animating)) {
        renderer.renderAt(sample.seconds,{focus:sample.focus,appearance});
        const display=canvas.getContext('2d');display.clearRect(0,0,canvas.width,canvas.height);display.drawImage(source,crop.x,crop.y,crop.width,crop.height,0,0,canvas.width,canvas.height);lastPaint=now;lastPose=pose;
        canvas.hidden=false;fallback.hidden=true;
      }
      if(document.hidden)return;
      if(sample.animating)raf=requestAnimationFrame(frame);
      else if(sample.wakeAfterMs!==null)wake=setTimeout(()=>{wake=null;raf=requestAnimationFrame(frame);},Math.max(1,sample.wakeAfterMs));
    }catch(error){canvas.dataset.renderError=error.message;fail();}
  }
  function refresh(){cancel();if(!disposed&&!failed&&latest){clock.update(latest,media.matches);frame(performance.now(),true);}}
  function visibility(){cancel();clock.resetWallAnchor();lastPaint=-Infinity;if(!document.hidden)refresh();}
  function preference(){lastPose=undefined;refresh();}
  document.addEventListener('visibilitychange',visibility);media.addEventListener('change',preference);
  Promise.all([loadImage('./assets/motion-v7/body-parts.png'),loadImage('./assets/motion-v7/head-poses.png'),loadImage('./assets/motion-v7/head-up-sip.png'),loadOutfitAssets(loadImage,outfitPack)]).then(([bodyAtlas,headAtlas,pitchHead,pack])=>{
    if(disposed)return;
    try{
      if(bodyAtlas.naturalWidth!==1254||bodyAtlas.naturalHeight!==1254||headAtlas.naturalWidth!==1254||headAtlas.naturalHeight!==1254||pitchHead.naturalWidth!==1254||pitchHead.naturalHeight!==1254)throw new Error('素材尺寸不匹配');
      images=pack.images;renderer=createOutfitRenderer(source,{bodyAtlas,headAtlas,pitchHead},images,{transparentBackground:true,showLabels:false,showGround:false});measureCrop();
      notice.textContent=pack.missing.length?'随专注状态切换动作；减少动效时保持静态。眼镜与椅子素材尚待补齐。':'随专注状态切换动作；减少动效时保持静态。';publishAppearance();refresh();
    }catch(error){canvas.dataset.renderError=error.message;fail();}
  }).catch(fail);
  return {
    update(state){latest=state;publishAppearance();refresh();},
    dispose(){disposed=true;cancel();document.removeEventListener('visibilitychange',visibility);media.removeEventListener('change',preference);renderer=null;}
  };
}
