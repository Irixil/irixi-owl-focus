'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { initialState, validateState } = require('../src/core.cjs');
const { FocusService } = require('../src/service.cjs');

class MemoryStore {
  constructor(state = initialState()) { this.state = structuredClone(state); this.fail = false; }
  read() { return structuredClone(this.state); }
  write(s) { if (this.fail) throw new Error('simulated disk full'); this.state = structuredClone(s); }
  close() {}
}
function fixture(saved) {
  const store = new MemoryStore(saved);
  let sample = { mono: 0, wall: 1_790_000_000_000 }, sequence = 0;
  const service = new FocusService(store, { clock: () => ({ ...sample }), makeId: () => `session-${++sequence}` });
  let requests = 0;
  const send = (type, extra = {}) => service.dispatch({ type, requestId: `req-${++requests}`, sessionId: service.snapshot().active?.id, ...extra });
  const step = (ms, wall = ms) => { sample.mono += ms; sample.wall += wall; return service.tick(); };
  const run = seconds => { for (let i = 0; i < seconds; i++) step(1000); };
  return { store, service, send, step, run };
}

test('暂停60秒不计时；恢复只累计实际运行，读快照不驱动计时', () => {
  const f = fixture(); f.send('start', { task: '读一节书', minutes: 25 }); f.run(30);
  f.send('pause'); f.run(60);
  assert.equal(f.service.snapshot().totalFocusMs, 30_000);
  f.send('resume'); f.run(30);
  assert.equal(f.service.snapshot().creditedMinutes, 1);
  for (let i = 0; i < 100; i++) f.service.snapshot();
  assert.equal(f.service.snapshot().totalFocusMs, 60_000);
});

test('两客户端共享状态，重复命令与旧局的结束不能重复计时/发奖或结束新局', () => {
  const f = fixture(); const a = f.send('start', { task: '双窗口同一轮', minutes: 1 });
  assert.throws(() => f.send('start', { task: '不能另开一轮', minutes: 1 }), /已有一轮/);
  const pause = { type: 'pause', requestId: 'client-a-pause', sessionId: a.active.id };
  f.run(20); f.service.dispatch(pause); f.run(20);
  assert.equal(f.service.snapshot().active.elapsedMs, 20_000);
  f.service.dispatch(pause); f.send('resume'); f.run(40);
  const completed = f.service.snapshot();
  assert.equal(completed.settledFocusMs, 60000); assert.equal(completed.creditedMinutes, 1);
  assert.equal(completed.lastOutcome.outcome, 'completed');
  assert.throws(() => f.service.dispatch({ type: 'end', requestId: 'late-end', sessionId: a.active.id }), /状态已改变/);
  const next = f.send('start', { task: '下一轮', minutes: 1 });
  assert.throws(() => f.service.dispatch({ type: 'end', requestId: 'late-end-2', sessionId: a.active.id }), /状态已改变/);
  assert.equal(f.service.snapshot().active.id, next.active.id);
});

test('短局按累计有效分钟，重复结束不加奖；5/10分钟解锁可装备且保存', () => {
  const f = fixture();
  for (let i = 0; i < 20; i++) { f.send('start', { task: `短局${i}`, minutes: 25 }); f.run(30); f.send('end'); }
  const s = f.service.snapshot();
  assert.equal(s.totalFocusMs, 600_000); assert.equal(s.creditedMinutes, 10);
  assert.deepEqual(s.unlocked, ['round-glasses', 'reading-chair']);
  assert.equal(s.settledFocusMs, 600000);
  const last = { type: 'end', requestId: 'replayed-end', sessionId: 'already-ended' };
  assert.throws(() => f.service.dispatch(last), /状态已改变/);
  f.send('equip', { slot: 'accessory', item: 'round-glasses' });
  f.send('equip', { slot: 'room', item: 'reading-chair' });
  const reopened = fixture(f.store.read()).service.snapshot();
  assert.equal(reopened.equipment.accessory, 'round-glasses');
  assert.equal(reopened.equipment.room, 'reading-chair'); assert.equal(reopened.creditedMinutes, 10);
});

test('休息结束不加成长，也不自动开启下一轮', () => {
  const f = fixture(); f.send('break', { minutes: 1 }); f.run(60);
  const s = f.service.snapshot();
  assert.equal(s.active, null); assert.equal(s.creditedMinutes, 0); assert.equal(s.settledFocusMs, 0);
  assert.equal(s.lastOutcome.kind, 'break'); assert.equal(s.lastOutcome.outcome, 'completed');
});

test('异常重开保留最后落盘的活动状态，离线两小时不计入且先暂停', () => {
  const f = fixture(); const start = f.send('start', { task: '恢复阅读', minutes: 25 }); f.run(63);
  const reopened = new FocusService(f.store, { clock: () => ({ mono: 0, wall: f.store.state.lastSavedAt + 7_200_000 }) });
  const s = reopened.snapshot();
  assert.equal(s.active.id, start.active.id); assert.equal(s.active.status, 'paused');
  assert.equal(s.active.elapsedMs, 63_000); assert.equal(s.totalFocusMs, 63_000);
  assert.equal(s.creditedMinutes, 1); assert.match(s.active.reason, /上次退出/);
  reopened.dispatch({ type: 'start', task: 'duplicate', minutes: 25, requestId: 'req-1' });
  assert.equal(reopened.snapshot().active.id, start.active.id);
});

test('休眠/心跳长间隔/墙钟前后跳均保守暂停，不补记整个间隔', () => {
  for (const [monoDelta, wallDelta] of [[3_600_000, 3_600_000], [1000, 3_600_000], [1000, -10_000]]) {
    const f = fixture(); f.send('start', { task: '不补离线时间', minutes: 25 }); f.run(10);
    const s = f.step(monoDelta, wallDelta);
    assert.equal(s.active.status, 'paused'); assert.equal(s.totalFocusMs, 10_000); assert.match(s.active.reason, /中断/);
    f.send('resume'); f.run(10); assert.equal(f.service.snapshot().totalFocusMs, 20_000);
  }
  const f = fixture(); f.send('start', { task: '睡前', minutes: 25 }); f.run(5); f.service.suspend(); f.step(60_000);
  assert.equal(f.service.snapshot().active.status, 'paused'); assert.equal(f.service.snapshot().totalFocusMs, 5000);
});

test('保存失败不宣称成功；计时停住，禁止继续累计，最后存档可恢复', () => {
  const f = fixture(); f.send('start', { task: '存储失败', minutes: 25 }); f.run(59);
  f.store.fail = true;
  assert.throws(() => f.step(1000), /disk full/);
  assert.equal(f.service.snapshot().totalFocusMs, 59_000); assert.match(f.service.snapshot().fault, /保存失败/);
  f.run(60); assert.equal(f.service.snapshot().creditedMinutes, 0);
  assert.throws(() => f.send('resume'), /保存失败/);
  f.store.fail = false;
  const reopened = fixture(f.store.read()).service.snapshot();
  assert.equal(reopened.active.status, 'paused'); assert.equal(reopened.totalFocusMs, 59_000);
});

test('自然完成恰一次，终点多余时间不记入；操作边界与未解锁物品被拒绝', () => {
  const f = fixture();
  assert.throws(() => f.send('start', { task: ' ', minutes: 25 }), /一件事/);
  for (const minutes of [0, -1, 181, NaN, 1.5]) assert.throws(() => f.send('start', { task: 'bad', minutes }), /时长/);
  assert.throws(() => f.send('equip', { slot: 'accessory', item: 'round-glasses' }), /没有解锁/);
  f.send('start', { task: '完成', minutes: 1 }); f.run(59); f.step(3000); f.run(30);
  const s = f.service.snapshot(); assert.equal(s.totalFocusMs, 60_000); assert.equal(s.settledFocusMs, 60000);
  assert.equal(s.creditedMinutes, 1); assert.equal('records' in s, false); validateState(s);
});

test('任意操控序列保持累计时间/历史/成长一致', () => {
  const f = fixture(); let seed = 777;
  const random = () => { seed = (seed * 48271) % 2147483647; return seed % 100; };
  for (let i = 0; i < 2000; i++) {
    const s = f.service.snapshot(), n = random();
    if (!s.active) f.send(n < 10 ? 'break' : 'start', { task: '随机状态路径', minutes: 1 });
    else if (n < 4) f.send('end');
    else if (n < 8) f.send(s.active.status === 'running' ? 'pause' : 'resume');
    else f.step(1000 + n);
    validateState(f.service.snapshot());
  }
});

test('旧番茄钟秒数原样保留；不足一分钟的真实专注不会造一枚奖励',()=>{
 const f=fixture();const first=f.send('start',{task:'保留5分30秒',seconds:330});assert.equal(first.active.durationMs,330000);f.run(1);f.send('end');
 const short=f.send('start',{task:'原秒钟设置',seconds:2});assert.equal(short.active.durationMs,2000);f.run(2);assert.equal(f.service.snapshot().totalFocusMs,3000);assert.equal(f.service.snapshot().creditedMinutes,0);assert.equal(f.service.snapshot().settledFocusMs,3000);
 assert.throws(()=>f.send('start',{task:'无效',seconds:0}));assert.throws(()=>f.send('start',{task:'无效',seconds:10801}));
});
