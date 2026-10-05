'use strict';

// Product rules only: no renderer clock, IO, network or user-activity inference.
const MINUTE = 60_000;
const CATALOG = Object.freeze([
  { id: 'round-glasses', name: '圆眼镜', slot: 'accessory', minutes: 5 },
  // Reversible engineering threshold, not an owner-approved fixed economy.
  { id: 'reading-chair', name: '阅读椅', slot: 'room', minutes: 10 },
]);

function initialState() {
  return { schema: 3, revision: 0, totalFocusMs: 0, creditedMinutes: 0,
    unlocked: [], equipment: { accessory: 'red-scarf', room: 'stool' },
    active: null, settledFocusMs: 0, processed: [], lastOutcome: null, lastSavedAt: null,
    preferences: { reducedMotion: false } };
}

function validateState(s, allowLegacy = false) {
  const int = n => Number.isSafeInteger(n) && n >= 0;
  if (!s || !(s.schema === 3 || (allowLegacy && s.schema === 2)) || !int(s.revision) || !int(s.totalFocusMs)
    || !int(s.creditedMinutes) || s.creditedMinutes !== Math.floor(s.totalFocusMs / MINUTE)
    || (s.schema === 2 ? !Array.isArray(s.records) : (!int(s.settledFocusMs) || Object.hasOwn(s,'records')))
    || !Array.isArray(s.processed) || s.processed.length > 128
    || !s.processed.every(id => typeof id === 'string')
    || new Set(s.processed).size !== s.processed.length || !Array.isArray(s.unlocked)
    || new Set(s.unlocked).size !== s.unlocked.length || !s.equipment
    || !(s.lastSavedAt === null || Number.isFinite(s.lastSavedAt))
    || !s.preferences || typeof s.preferences.reducedMotion !== 'boolean') {
    throw new Error('保存格式不正确；原文件已保留，不能用空白进度覆盖。');
  }
  const expected = CATALOG.filter(item => s.creditedMinutes >= item.minutes).map(item => item.id);
  if (s.unlocked.length !== expected.length || !expected.every(id => s.unlocked.includes(id)))
    throw new Error('成长与解锁记录不一致；停止写入以保护存档。');
  if (![null, 'red-scarf', 'round-glasses'].includes(s.equipment.accessory)
    || !['stool', 'reading-chair'].includes(s.equipment.room)
    || (s.equipment.accessory === 'round-glasses' && !s.unlocked.includes('round-glasses'))
    || (s.equipment.room === 'reading-chair' && !s.unlocked.includes('reading-chair')))
    throw new Error('装扮记录不正确；停止写入以保护存档。');
  const ids = new Set();
  let recorded = s.schema === 3 ? s.settledFocusMs : 0;
  for (const r of s.schema === 2 ? s.records : []) {
    if (!r || typeof r.id !== 'string' || ids.has(r.id) || !int(r.focusMs)
      || !int(r.durationMs) || r.focusMs > r.durationMs
      || !['completed', 'ended'].includes(r.outcome) || typeof r.task !== 'string'
      || !int(r.marksEarned) || !Number.isFinite(r.startedAt) || !Number.isFinite(r.endedAt))
      throw new Error('专注记录不正确；原文件已保留。');
    ids.add(r.id); recorded += r.focusMs;
  }
  const a = s.active;
  if (a) {
    if (typeof a.id !== 'string' || ids.has(a.id) || !['focus', 'break'].includes(a.kind)
      || !['running', 'paused'].includes(a.status) || !int(a.durationMs) || a.durationMs < 1000
      || !int(a.elapsedMs) || a.elapsedMs >= a.durationMs || typeof a.task !== 'string'
      || !int(a.startCreditedMinutes) || a.startCreditedMinutes > s.creditedMinutes || !Number.isFinite(a.startedAt))
      throw new Error('活动计时记录不正确；原文件已保留。');
    if (a.kind === 'focus') recorded += a.elapsedMs;
  }
  if (recorded !== s.totalFocusMs) throw new Error('累计时间与逐次记录不一致；停止写入。');
  return s;
}

function award(s) {
  s.creditedMinutes = Math.floor(s.totalFocusMs / MINUTE);
  s.unlocked = CATALOG.filter(item => s.creditedMinutes >= item.minutes).map(item => item.id);
}

function finish(s, now, outcome) {
  const a = s.active;
  if (a.kind === 'focus') s.settledFocusMs += a.elapsedMs;
  s.lastOutcome = { kind: a.kind, outcome, at: now,
    message: a.kind === 'focus' ? (outcome === 'completed' ? '本轮专注完成，可以开始休息。' : '本轮已提前结束，实际计入的时间已保存。')
      : (outcome === 'completed' ? '休息结束；准备好后手动开始下一轮。' : '休息已结束。') };
  s.active = null;
}

function advance(s, deltaMs, now) {
  if (!s.active || s.active.status !== 'running' || deltaMs <= 0) return false;
  const a = s.active;
  const counted = Math.min(Math.floor(deltaMs), a.durationMs - a.elapsedMs);
  if (!counted) return false;
  a.elapsedMs += counted;
  if (a.kind === 'focus') { s.totalFocusMs += counted; award(s); }
  if (a.elapsedMs >= a.durationMs) finish(s, now, 'completed');
  return true;
}

function interrupt(s, reason, now) {
  if (!s.active) return false;
  s.active.status = 'paused';
  s.active.reason = reason;
  s.lastOutcome = { kind: s.active.kind, outcome: 'interrupted', at: now, message: reason };
  return true;
}

function command(s, c, now, makeId) {
  if (!c || typeof c.requestId !== 'string' || !/^[\w-]{1,100}$/.test(c.requestId))
    throw new Error('操作标识无效。');
  if (s.processed.includes(c.requestId)) return false;
  if (['pause', 'resume', 'end'].includes(c.type)
    && (!s.active || c.sessionId !== s.active.id)) throw new Error('这轮状态已改变，请使用当前窗口显示的这一轮。');
  switch (c.type) {
    case 'start':
    case 'break': {
      if (s.active) throw new Error('已有一轮进行中；两个窗口共用这一轮，请先结束。');
      const minutes = c.minutes ?? (c.type === 'break' ? 5 : 25);
      if (!Number.isInteger(minutes) || minutes < 1 || minutes > (c.type === 'break' ? 60 : 180))
        if (c.seconds === undefined) throw new Error('专注时长为1–180分钟，休息时长为1–60分钟。');
      const durationSeconds = c.seconds ?? minutes * 60;
      if (!Number.isInteger(durationSeconds) || durationSeconds < 1 || durationSeconds > (c.type === 'break' ? 3600 : 10800))
        throw new Error('时长为1秒至180分钟；休息最多60分钟。');
      const task = c.type === 'break' ? '休息' : (typeof c.task === 'string' ? c.task.trim().slice(0, 200) : '');
      if (!task) throw new Error('先写下这次想做的一件事。');
      s.active = { id: makeId(), kind: c.type === 'break' ? 'break' : 'focus', status: 'running',
        task, durationMs: durationSeconds * 1000, elapsedMs: 0, startedAt: now,
        startCreditedMinutes: s.creditedMinutes, reason: null };
      s.lastOutcome = null;
      break;
    }
    case 'pause': s.active.status = 'paused'; s.active.reason = '你已暂停；暂停时间不计入成长。'; break;
    case 'resume': s.active.status = 'running'; s.active.reason = null; s.lastOutcome = null; break;
    case 'end': finish(s, now, 'ended'); break;
    case 'preferences':
      if (typeof c.reducedMotion !== 'boolean') throw new Error('动效偏好无效。');
      s.preferences.reducedMotion = c.reducedMotion;
      break;
    case 'equip': {
      if (!['accessory', 'room'].includes(c.slot)) throw new Error('装扮位置无效。');
      const available = c.slot === 'accessory' ? [null, 'red-scarf', ...s.unlocked.filter(id => id === 'round-glasses')]
        : ['stool', ...s.unlocked.filter(id => id === 'reading-chair')];
      if (!available.includes(c.item)) throw new Error('这件物品还没有解锁。');
      s.equipment[c.slot] = c.item;
      break;
    }
    default: throw new Error('不支持的操作。');
  }
  s.processed.push(c.requestId);
  s.processed = s.processed.slice(-128);
  return true;
}

function migrateState(s) {
  if (s?.schema === 3) return validateState(s);
  if (s?.schema === 2) {
    validateState(s, true);
    const migrated = structuredClone(s);
    migrated.schema = 3;
    migrated.settledFocusMs = s.records.reduce((total,r) => total+r.focusMs,0);
    delete migrated.records;
    return validateState(migrated);
  }
  if (s?.schema !== 1) return validateState(s);
  if (!s.equipment || ![null, 'desk-plant'].includes(s.equipment.room)
    || !Array.isArray(s.unlocked) || s.unlocked.some(id => !['round-glasses', 'desk-plant'].includes(id)))
    throw new Error('旧工程装扮记录无法识别，原文件必须保留。');
  const migrated = structuredClone(s);
  migrated.schema = 2;
  migrated.preferences = { reducedMotion: false };
  migrated.unlocked = migrated.unlocked.map(id => id === 'desk-plant' ? 'reading-chair' : id);
  migrated.equipment.room = migrated.equipment.room === 'desk-plant' ? 'reading-chair' : 'stool';
  return migrateState(validateState(migrated, true));
}
module.exports = { MINUTE, CATALOG, initialState, validateState, migrateState, advance, interrupt, command };
