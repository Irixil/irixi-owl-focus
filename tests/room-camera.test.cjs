'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {roomCamera,mapPoint,unmapPoint}=require('../ui/room-geometry.cjs');

test('Rendering and CSS hit decoding agree at fractional viewport sizes and independent high-DPI backing sizes',async()=>{
 const {canvasRoomPoint}=await import('../ui/room-viewport.mjs');
 for(const [width,height]of[[186,126],[186,264],[387,264],[387,538],[386.25,537.5]]){
  const c=roomCamera(width,height,{x:0,y:50,width:width*.56,height:height-80});
  for(const dpr of [1,1.25,2]){
   const canvas={width:Math.round(width*dpr),height:Math.round(height*dpr),dataset:{sourceCrop:JSON.stringify(c)},getBoundingClientRect:()=>({left:17.25,top:33.5,width,height})};
   for(const p of [[512,935],[0,0],[-4000,4000],[1800,-900]]){
    const q=mapPoint(p,c),back=unmapPoint(q,c),hit=canvasRoomPoint(canvas,q[0]+17.25,q[1]+33.5);
    assert(Math.abs(back[0]-p[0])<1e-8&&Math.abs(back[1]-p[1])<1e-8);
    assert(Math.abs(hit.x-p[0])<1e-8&&Math.abs(hit.y-p[1])<1e-8);
   }
  }
 }
});

test('Invalid viewport geometry stops decoding instead of writing bad placement coordinates',async()=>{
 const {canvasRoomPoint}=await import('../ui/room-viewport.mjs');
 for(const size of [[0,538],[387,0],[NaN,126]])assert.throws(()=>roomCamera(...size),/视口/);
 assert.throws(()=>roomCamera(387,538,{x:0,y:0,width:0,height:50}),/视口/);
 assert.equal(canvasRoomPoint({dataset:{sourceCrop:'{}'},width:0,height:0,getBoundingClientRect:()=>({left:0,top:0,width:0,height:0})},1,1),null);
});
