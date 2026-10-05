'use strict';
// Records drawing arguments and affine transforms. No real pixels or browser.
function canvasFixture(){
  const allDraws=[],rootDraws=[];let index=0;
  const mul=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
  function makeCanvas(width=900,height=1000,root=false){
    const tag=root?'root':`buffer-${index++}`;let matrix=[1,0,0,1,0,0];const stack=[];
    const target={globalAlpha:1,globalCompositeOperation:'source-over',createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}}),getImageData:()=>({data:new Uint8ClampedArray(800*520*4)}),
      save(){stack.push({matrix:[...matrix],alpha:this.globalAlpha,composite:this.globalCompositeOperation});},restore(){const previous=stack.pop();matrix=previous.matrix;this.globalAlpha=previous.alpha;this.globalCompositeOperation=previous.composite;},translate(x,y){matrix=mul(matrix,[1,0,0,1,x,y]);},scale(x,y){matrix=mul(matrix,[x,0,0,y,0,0]);},
      rotate(x){matrix=mul(matrix,[Math.cos(x),Math.sin(x),-Math.sin(x),Math.cos(x),0,0]);},transform(...m){matrix=mul(matrix,m);},setTransform(...m){matrix=m;},
      drawImage(image,...args){const draw={target:tag,image:image.tag||'image',args,matrix:[...matrix],alpha:this.globalAlpha,composite:this.globalCompositeOperation};allDraws.push(draw);if(root)rootDraws.push(draw);},
    };
    return {tag,width,height,getContext:()=>new Proxy(target,{get:(o,k)=>k in o?o[k]:()=>{}})};
  }
  const canvas=makeCanvas(900,1000,true);
  return {canvas,makeCanvas,allDraws,rootDraws,reset(){allDraws.length=rootDraws.length=0;}};
}
module.exports={canvasFixture};
