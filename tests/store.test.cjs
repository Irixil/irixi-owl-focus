'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { FileStore } = require('../src/store.cjs');
const { FocusService } = require('../src/service.cjs');
const { initialState, command, advance } = require('../src/core.cjs');

test('unexpected legacy backup content blocks migration without replacing original progress',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'owl-backup-conflict-')),s=initialState();
  s.schema=1;delete s.positions;delete s.collection;s.equipment={accessory:s.equipment.accessory,room:s.equipment.room};s.records=[];delete s.settledFocusMs;delete s.preferences;s.equipment.room=null;
  const bytes=JSON.stringify(s),hash=require('node:crypto').createHash('sha256').update(bytes).digest('hex');
  const file=path.join(dir,'focus-state.json');fs.writeFileSync(file,bytes);
  fs.writeFileSync(path.join(dir,`focus-state.schema1-${hash}.json`),'unexpected backup bytes');
  const store=new FileStore(dir);
  try{assert.throws(()=>store.read(),/备份内容不一致/);assert.equal(fs.readFileSync(file,'utf8'),bytes);}
  finally{store.close();fs.rmSync(dir,{recursive:true,force:true});}
});

test('schema1 engineering progress migrates plant to chair with byte-identical backup; preference persists',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'owl-migrate-')), file=path.join(dir,'focus-state.json');
  const s=initialState(); command(s,{type:'start',task:'migration fixture',minutes:10,requestId:'a'},1000,()=> 'fixture');
  advance(s,600000,601000); command(s,{type:'equip',slot:'room',item:'reading-chair',requestId:'b'},601000);
  s.schema=1;delete s.positions;delete s.collection;s.equipment={accessory:s.equipment.accessory,room:s.equipment.room};s.records=[{id:'fixture',task:'migration fixture',startedAt:1000,endedAt:601000,durationMs:600000,focusMs:600000,outcome:'completed',marksEarned:10}];delete s.settledFocusMs;delete s.preferences;s.unlocked=s.unlocked.map(id=>id==='reading-chair'?'desk-plant':id);s.equipment.room='desk-plant';
  const bytes=JSON.stringify(s,null,2);fs.writeFileSync(file,bytes);
  const store=new FileStore(dir);
  try {
    const migrated=store.read();assert.equal(migrated.schema,8);assert.equal(migrated.equipment.room,'reading-chair');
    assert.equal(migrated.totalFocusMs,600000);assert.equal('records' in migrated,false);assert.equal(migrated.settledFocusMs,600000);
    const backup=fs.readdirSync(dir).find(name=>name.startsWith('focus-state.schema1-'));
    assert.equal(fs.readFileSync(path.join(dir,backup),'utf8'),bytes);
    command(migrated,{type:'preferences',reducedMotion:true,requestId:'pref'},602000);store.write(migrated);
    assert.equal(store.read().preferences.reducedMotion,true);
  } finally{store.close();fs.rmSync(dir,{recursive:true,force:true});}
});

test('真实文件原子保存/重开/双写保护；半写临时文件不替代正式存档', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'owl-focus-test-'));
  let store = new FileStore(dir), s = initialState();
  try {
    s.lastSavedAt = Date.now(); store.write(s);
    assert.throws(() => new FileStore(dir), /已有写入进程/);
    fs.writeFileSync(path.join(dir, 'focus-state.json.tmp'), '{partial');
    assert.deepEqual(store.read(), s);
    store.close(); store = new FileStore(dir); assert.deepEqual(store.read(), s);
    store.write(s); assert.equal(fs.existsSync(path.join(dir, 'focus-state.json.tmp')), false);
  } finally { store.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('损坏或未来格式的存档失败关闭，不覆盖原始字节', () => {
  for (const content of ['{corrupt', JSON.stringify({ schema: 99 }), JSON.stringify({ ...initialState(), creditedMinutes: 4 })]) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'owl-focus-test-')), store = new FileStore(dir);
    const file = path.join(dir, 'focus-state.json'); fs.writeFileSync(file, content);
    try { assert.throws(() => new FocusService(store), /存档/); assert.equal(fs.readFileSync(file, 'utf8'), content); }
    finally { store.close(); fs.rmSync(dir, { recursive: true, force: true }); }
  }
});

test('真实子进程异常终止后可回收死写入锁并恢复到暂停；未结束时间保留', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'owl-focus-crash-test-'));
  const storeModule = path.resolve(__dirname, '../src/store.cjs');
  const serviceModule = path.resolve(__dirname, '../src/service.cjs');
  const child = spawn(process.execPath, ['-e', `
    const {FileStore}=require(${JSON.stringify(storeModule)});
    const {FocusService}=require(${JSON.stringify(serviceModule)});
    let mono=0;
    const svc=new FocusService(new FileStore(${JSON.stringify(dir)}),{clock:()=>({mono,wall:1790000000000+mono})});
    svc.dispatch({type:'start',requestId:'start-crash',task:'异常退出样例',minutes:25});
    mono=1000;svc.tick();
    process.send('saved');setInterval(()=>{},10000);
  `], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
  let store;
  try {
    await once(child, 'message');
    const exited = once(child, 'exit'); child.kill('SIGKILL'); await exited;
    store = new FileStore(dir);
    const reopened = new FocusService(store, { clock: () => ({ mono: 0, wall: 1790007200000 }) });
    assert.equal(reopened.snapshot().active.status, 'paused');
    assert.equal(reopened.snapshot().totalFocusMs, 1000);
    assert.match(reopened.snapshot().active.reason, /上次退出/);
    reopened.close(); store = undefined;
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    if (store) store.close(); fs.rmSync(dir, { recursive: true, force: true });
  }
});
