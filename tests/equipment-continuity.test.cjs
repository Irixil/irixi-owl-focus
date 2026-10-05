'use strict';
// Affine/opacity evidence only: no raster pixels, browser or application launch.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {canvasFixture}=require('./helpers/canvas.cjs');
const mix=(a,b,u)=>a+(b-a)*u;
const apply=(m,p)=>[m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]];
test('delivered eight local PNG bytes and dimensions match reviewed manifest and enabled loader contract',async()=>{
  const {OUTFIT_PACK,OUTFIT_FILES}=await import('../ui/outfit-assets.mjs');
  const root=path.join(__dirname,'../ui/assets/outfit'),manifest=JSON.parse(fs.readFileSync(path.join(root,'provenance/manifest.json')));
  assert.equal(OUTFIT_PACK.ready,true);assert.equal(manifest.finalAssets.length,8);
  for(const [name,w,h] of Object.values(OUTFIT_FILES)){
    const data=fs.readFileSync(path.join(root,name)),entry=manifest.files['assets/'+name];
    assert.equal(crypto.createHash('sha256').update(data).digest('hex'),entry.sha256);
    assert.equal(data.readUInt32BE(16),w);assert.equal(data.readUInt32BE(20),h);assert.equal(data[24],8);assert.equal(data[25],6);
  }
});
test('continuous overlay aligns actual rim contours while retaining frozen v7 eye anchors and blend weights',async()=>{
  const {createOwlRenderer}=await import('../ui/renderers/owl-equipped.mjs');
  const {GLASSES_REGISTRATION:registration}=await import('../ui/glasses-registration.mjs');
  const f=canvasFixture(),image=tag=>({tag,width:1254,height:1254}),textures=Object.fromEntries(['front','up','left30','left60','right30','right60'].map(k=>[k,{tag:'glasses-'+k,width:800,height:520}]));
  textures.registration=registration;let sample;
  const renderer=createOwlRenderer(f.canvas,{bodyAtlas:image('body'),headAtlas:image('heads'),pitchHead:image('up')},{makeCanvas:f.makeCanvas,showLabels:false,drawHeadOverlay(_ctx,_state,draw){draw(textures,sample);}});
  const yaw=renderer.landmarks,pitch=renderer.pitchLandmarks;
  let count=0,intermediate=0,maxError=0,flippedTriangles=0;
  function inspect(state){
    sample={...renderer.stateAt(0),...state};f.reset();renderer.renderAt(0);count++;
    const angle=Math.abs(sample.yaw||0),up=sample.pitch||0;
    if(up<=.000001&&angle<=.00001){assert.ok(f.rootDraws.some(d=>d.image==='glasses-front'));return;}
    const sign=sample.yaw<0?'left':'right',a=up>.000001?'front':angle<=30?'front':sign+'30',b=up>.000001?'up':sign+(angle<=30?'30':'60'),u=up>.000001?up:Math.min(1,angle<=30?angle/30:(angle-30)/30);
    const A=registration.poses[a],B=registration.poses[b],triangles=registration.pairs[a+'_'+b];
    const eyeCenters=points=>[[(points[21][0]+points[24][0])/2,(points[21][1]+points[24][1])/2],[(points[29][0]+points[32][0])/2,(points[29][1]+points[32][1])/2]];
    const headA=eyeCenters(up>.000001?pitch.front:yaw.landmarks[a]),headB=eyeCenters(up>.000001?pitch.target:yaw.landmarks[b]);
    for(let eye=0;eye<2;eye++)for(let axis=0;axis<2;axis++){const i=registration.eyeCenterIndices[eye];assert.ok(Math.abs(A[i][axis]-headA[eye][axis])<1e-8);assert.ok(Math.abs(B[i][axis]-headB[eye][axis])<1e-8);}
    const target=A.map((p,i)=>p.map((v,j)=>mix(v,B[i][j],u)));
    if(u>0&&u<1)intermediate++;
    const rowsA=f.allDraws.filter(d=>d.image==='glasses-'+a),rowsB=f.allDraws.filter(d=>d.image==='glasses-'+b);
    assert.equal(rowsA.length,triangles.length);assert.equal(rowsB.length,triangles.length);
    for(let i=0;i<triangles.length;i++){
      const tri=triangles[i];
      for(const [rows,source] of [[rowsA,A],[rowsB,B]]){
        const row=rows[i];assert.ok(row.matrix.every(Number.isFinite));
        for(const k of tri){const actual=apply(row.matrix,source[k]),expected=target[k];for(let j=0;j<2;j++){const error=Math.abs(actual[j]-expected[j]);maxError=Math.max(maxError,error);assert.ok(error<1e-8,`triangle ${i}, yaw ${sample.yaw}, pitch ${up}`);}}
      }
      const m=rowsA[i].matrix;if(m[0]*m[3]-m[1]*m[2]<0)flippedTriangles++;
    }
    const compositions=f.allDraws.filter(d=>d.image===rowsA[0].target||d.image===rowsB[0].target);
    assert.equal(compositions.length,2);assert.equal(compositions[0].alpha,1-u);assert.equal(compositions[1].alpha,u);assert.equal(compositions[0].composite,'source-over');assert.equal(compositions[1].composite,'lighter');
    const world=f.rootDraws.at(-1);assert.ok(world.matrix.every(Number.isFinite));assert.equal(world.alpha,1);assert.equal(world.composite,'source-over');
  }
  for(let i=-240;i<=240;i++)inspect({yaw:i/4,pitch:0});
  for(let i=0;i<=240;i++)inspect({yaw:0,pitch:i/240});
  // Sample the actual tea and look state curves, rather than just six endpoint poses.
  for(let i=0;i<=1950;i++)inspect(renderer.stateAt(i/120));
  const centers=(points)=>[[(points[21][0]+points[24][0])/2,(points[21][1]+points[24][1])/2],[(points[29][0]+points[32][0])/2,(points[29][1]+points[32][1])/2]];
  for(const sign of ['left','right']){
    const A=yaw.landmarks.front,B=yaw.landmarks[sign+'30'],C=yaw.landmarks[sign+'60'];
    const before=A.map((p,i)=>p.map((v,j)=>mix(v,B[i][j],1-1e-7))),after=B.map((p,i)=>p.map((v,j)=>mix(v,C[i][j],1e-7)));
    const x=centers(before),y=centers(after);for(let i=0;i<2;i++)for(let j=0;j<2;j++)assert.ok(Math.abs(x[i][j]-y[i][j])<.00003);
    inspect({yaw:(sign==='left'?-1:1)*(30-1e-7),pitch:0});inspect({yaw:(sign==='left'?-1:1)*(30+1e-7),pitch:0});
  }
  assert.ok(intermediate>1000);assert.equal(flippedTriangles,0,'No added triangle inversion on sampled frozen v7 mappings');
  console.log(JSON.stringify({method:'memory affine/opacity trace; empty Canvas; no continuous pixel or native proof',samples:count,intermediate_blends:intermediate,max_vertex_error:maxError,flipped_triangles:flippedTriangles}));
});
