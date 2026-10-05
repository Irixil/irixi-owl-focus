'use strict';
// Only fresh test directories and child processes created here are mutated.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawn}=require('node:child_process'),{once}=require('node:events');
const {FileStore}=require('../src/store.cjs'),{FocusService}=require('../src/service.cjs');
const wait=ms=>new Promise(r=>setTimeout(r,ms));

if(process.argv[2]!=='--owned-crash-writer'){
test('real-clock paused UI-equivalent commands and persisted time remain fixed across heartbeat boundaries',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'owl-pause-boundary-'));
  const service=new FocusService(new FileStore(dir));
  let n=0;const send=(type,extra={})=>service.dispatch({type,requestId:'boundary-'+(++n),sessionId:service.snapshot().active?.id,...extra});
  const heartbeat=setInterval(()=>service.tick(),17),rows=[];
  try{
    send('start',{task:'暂停边界样例',minutes:1});
    for(let i=0;i<12;i++){
      if(i)send('resume');await wait(40+i*3);
      const stale=service.snapshot();await wait(25);
      const paused=send('pause');
      assert.equal(paused.active.status,'paused');
      assert.ok(paused.totalFocusMs>=stale.totalFocusMs,'pause settles real running interval before acknowledgement');
      for(const [slot,item] of [['accessory','red-scarf'],['room','stool']])send('equip',{slot,item});
      await wait(70);
      const after=service.snapshot(),disk=JSON.parse(fs.readFileSync(path.join(dir,'focus-state.json')));
      assert.equal(after.totalFocusMs,paused.totalFocusMs);assert.equal(after.active.elapsedMs,paused.active.elapsedMs);
      assert.equal(disk.totalFocusMs,paused.totalFocusMs);assert.equal(disk.active.status,'paused');
      rows.push({iteration:i,beforePauseSample:stale.totalFocusMs,pauseAcknowledged:paused.totalFocusMs,afterPaused:after.totalFocusMs,persisted:disk.totalFocusMs});
    }
    send('end');const final=service.snapshot();
    assert.equal(final.settledFocusMs,rows.at(-1).pauseAcknowledged);
    console.log(JSON.stringify({method:'real monotonic clock + actual FileStore;12 heartbeat/command pause boundaries',rows,recordFocusMs:final.settledFocusMs}));
  }finally{clearInterval(heartbeat);service.close();fs.rmSync(dir,{recursive:true,force:true});}
});

test('controlled long-gap, forward/backward wall clock and suspend retain only durable running time',()=>{
  const rows=[];
  for(const [name,monoGap,wallGap] of [['long-heartbeat-gap',3600000,3600000],['wall-forward',1000,3600000],['wall-backward',1000,-10000],['suspend',3600000,3600000]]){
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'owl-clock-recovery-'));let sample={mono:0,wall:1790000000000};
    let service=new FocusService(new FileStore(dir),{clock:()=>({...sample})});
    try{
      service.dispatch({type:'start',requestId:'clock-start',task:'受控时钟恢复',minutes:1});
      sample={mono:5000,wall:sample.wall+5000};service.tick();
      if(name==='suspend')service.suspend();
      sample={mono:sample.mono+monoGap,wall:sample.wall+wallGap};service.tick();
      assert.equal(service.snapshot().active.status,'paused');assert.equal(service.snapshot().totalFocusMs,5000);
      const disk=JSON.parse(fs.readFileSync(path.join(dir,'focus-state.json')));assert.equal(disk.totalFocusMs,5000);assert.equal(disk.active.status,'paused');
      service.close();service=new FocusService(new FileStore(dir),{clock:()=>({...sample})});
      assert.equal(service.snapshot().totalFocusMs,5000);assert.equal(service.snapshot().active.status,'paused');
      service.dispatch({type:'resume',requestId:'clock-resume',sessionId:service.snapshot().active.id});
      sample={mono:sample.mono+1000,wall:sample.wall+1000};service.tick();assert.equal(service.snapshot().totalFocusMs,6000);
      rows.push({name,monoGap,wallGap,persistedPausedMs:disk.totalFocusMs,resumedMs:service.snapshot().totalFocusMs});
    }finally{service.close();fs.rmSync(dir,{recursive:true,force:true});}
  }
  console.log(JSON.stringify({method:'controlled clock and direct service.suspend, actual FileStore; not actual whole-machine sleep/powerMonitor delivery',rows}));
});

test('owned real-clock writer killed without close restores exact durable progress and does not credit offline gap',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'owl-real-crash-'));
  const child=spawn(process.execPath,[__filename,'--owned-crash-writer',dir],{stdio:['ignore','ignore','pipe','ipc']});
  let service;
  try{
    let timeout;const ready=once(child,'message');let saved;
    try{[saved]=await Promise.race([ready,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('owned writer readiness timeout')),8000);})]);}
    finally{clearTimeout(timeout);}
    assert.equal(saved.kind,'durable');assert.ok(saved.totalFocusMs>=900);
    const diskBefore=JSON.parse(fs.readFileSync(path.join(dir,'focus-state.json')));
    assert.equal(diskBefore.totalFocusMs,saved.totalFocusMs);assert.equal(diskBefore.active.status,'running');
    const exit=once(child,'exit');assert.equal(child.kill('SIGKILL'),true);const [code,signal]=await exit;
    assert.equal(signal,'SIGKILL');await wait(1100);
    service=new FocusService(new FileStore(dir));const restored=service.snapshot();
    assert.equal(restored.totalFocusMs,diskBefore.totalFocusMs);assert.equal(restored.active.elapsedMs,diskBefore.active.elapsedMs);
    assert.equal(restored.active.id,diskBefore.active.id);assert.equal(restored.active.status,'paused');
    assert.deepEqual(restored.settledFocusMs,diskBefore.settledFocusMs);assert.equal(restored.creditedMinutes,diskBefore.creditedMinutes);assert.match(restored.active.reason,/上次退出/);
    await wait(350);service.tick();assert.equal(service.snapshot().totalFocusMs,diskBefore.totalFocusMs);
    const before=service.snapshot().totalFocusMs;
    service.dispatch({type:'resume',requestId:'resume-after-crash',sessionId:restored.active.id});await wait(300);service.tick();
    const resumed=service.snapshot();assert.ok(resumed.totalFocusMs-before>=250&&resumed.totalFocusMs-before<1000);
    console.log(JSON.stringify({method:'actual SIGKILL of owned Node writer running same FocusService/FileStore; real clock, not Electron/OS crash',childPid:child.pid,exitCode:code,signal,lastDurableMs:diskBefore.totalFocusMs,recoveredPausedMs:restored.totalFocusMs,offlineCreditMs:0,resumedOnlyMs:resumed.totalFocusMs-before}));
  }finally{
    if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');
    service?.close();fs.rmSync(dir,{recursive:true,force:true});
  }
});

}

if(process.argv[2]==='--owned-crash-writer'){
  // Child owns no application/service other than this new temporary writer.
  const svc=new FocusService(new FileStore(process.argv[3]));
  svc.dispatch({type:'start',requestId:'owned-crash-start',task:'真实异常退出样例',minutes:1});
  let count=0;const timer=setInterval(()=>{
    const s=svc.tick();if(++count===5){clearInterval(timer);process.send({kind:'durable',totalFocusMs:s.totalFocusMs});setInterval(()=>{},1000);}
  },200);
}
