// 同期の合わせ込みのテスト:  node tests/merge.test.js
const assert = require('assert'); const M = require('../src/merge.js');
let n = 0; const test = (name, fn) => { fn(); n++; console.log('ok ', name); };
const rec = (id, at, out = 100, extra = {}) => ({ id, date: '2026-10-0' + (1 + (at % 9)), storeId: 's1', lendPer1000: 47, exchX10: 50, plays: [{ machineId: 'm1', cash: 1000, savedIn: 0, carryIn: 0, out, minutes: 0 }], deposit: 0, cashOut: 0, expense: 0, memo: '', createdAt: at, ...extra });
const st = (sessions = [], o = {}) => ({ v: 1, sessions, machines: o.machines || [{ id: 'm1', name: '北斗', fav: false }], store: o.store === undefined ? { lendPer1000: 47, exchX10: 50, dailyLimit: 470, initSaved: 0 } : o.store, budget: o.budget === undefined ? 80000 : o.budget });
const ids = s => s.sessions.map(x => x.id).join(',');
const clone = v => JSON.parse(JSON.stringify(v));

test('クラウドが空なら、この端末の内容がそのまま残る', () => { const l = st([rec('a', 1), rec('b', 2)]); const m = M.merge(l, null, null); assert.ok(M.same(m.state, l)); });
test('クラウドが空なら、控えが残っていても何も消さない', () => { const l = st([rec('a', 1)]); const base = M.snapshot(st([rec('a', 1), rec('z', 9)])); assert.strictEqual(ids(M.merge(l, null, base).state), 'a'); });
test('初めての同期は、両方を足し合わせる', () => { const m = M.merge(st([rec('a', 1)]), st([rec('b', 2)]), null); assert.strictEqual(ids(m.state), 'a,b'); assert.deepStrictEqual(m.conflicts, []); });
test('この端末で足した記録は残り、クラウドで足された記録は入ってくる', () => { const b0 = st([rec('a', 1)]), base = M.snapshot(b0); const m = M.merge(st([rec('a', 1), rec('b', 2)]), st([rec('a', 1), rec('c', 3)]), base); assert.strictEqual(ids(m.state), 'a,b,c'); });
test('この端末で消した記録は、クラウドからも消える', () => { const b0 = st([rec('a', 1), rec('b', 2)]); assert.strictEqual(ids(M.merge(st([rec('a', 1)]), clone(b0), M.snapshot(b0)).state), 'a'); });
test('クラウドで消された記録は、この端末からも消える', () => { const b0 = st([rec('a', 1), rec('b', 2)]); assert.strictEqual(ids(M.merge(clone(b0), st([rec('a', 1)]), M.snapshot(b0)).state), 'a'); });
test('片方が消して片方が編集したら、編集を残す', () => {
  const b0 = st([rec('a', 1), rec('b', 2)]), base = M.snapshot(b0), edited = rec('b', 2, 999, { updatedAt: 50 });
  assert.strictEqual(M.merge(st([rec('a', 1)]), st([rec('a', 1), edited]), base).state.sessions.find(x => x.id === 'b').plays[0].out, 999);
  assert.strictEqual(M.merge(st([rec('a', 1), edited]), st([rec('a', 1)]), base).state.sessions.find(x => x.id === 'b').plays[0].out, 999);
});
test('片方だけが編集したら、その編集を採る', () => {
  const b0 = st([rec('a', 1)]), base = M.snapshot(b0), e = rec('a', 1, 555, { updatedAt: 9 });
  assert.strictEqual(M.merge(st([e]), clone(b0), base).state.sessions[0].plays[0].out, 555);
  assert.strictEqual(M.merge(clone(b0), st([e]), base).state.sessions[0].plays[0].out, 555);
});
test('両方が編集したら新しい方を残し、負けた方は変更履歴に入る（どちらの端末で合わせても同じ結果）', () => {
  const v1 = rec('a', 1, 100), b0 = st([v1]), base = M.snapshot(b0);
  const A = rec('a', 1, 200, { updatedAt: 10, history: [{ at: 10, before: clone(v1) }] }), B = rec('a', 1, 300, { updatedAt: 20, history: [{ at: 20, before: clone(v1) }] });
  const onA = M.merge(st([A]), st([B]), base), onB = M.merge(st([B]), st([A]), base);
  assert.deepStrictEqual(onA.conflicts, ['a']); assert.ok(M.same(onA.state, onB.state));
  const s = onA.state.sessions[0]; assert.strictEqual(s.plays[0].out, 300);
  assert.deepStrictEqual(s.history.map(e => [e.at, e.before.plays[0].out]), [[10, 100], [20, 200]]);
  // もう一方の端末が、その結果を受け取ったときに履歴が増えつづけない
  const again = M.merge(st([B]), clone(onA.state), base); assert.ok(M.same(again.state, onA.state));
});
test('同じ内容どうしを合わせても何も変わらない', () => { const s = st([rec('a', 1), rec('b', 2, 5, { history: [{ at: 3, before: rec('b', 2) }] })]); const m = M.merge(clone(s), clone(s), M.snapshot(s)); assert.ok(M.same(m.state, s)); assert.deepStrictEqual(m.conflicts, []); });
test('指紋はキーの並び順に左右されない', () => { assert.strictEqual(M.fp({ a: 1, b: [1, { x: 1, y: 2 }] }), M.fp({ b: [1, { y: 2, x: 1 }], a: 1 })); assert.notStrictEqual(M.fp({ a: 1 }), M.fp({ a: 2 })); });
test('条件と上限額: 片方だけが変えたらそれを採る。両方が変えたらいまの端末の値', () => {
  const b0 = st([]), base = M.snapshot(b0);
  assert.strictEqual(M.merge(st([], { budget: 50000 }), clone(b0), base).state.budget, 50000);
  assert.strictEqual(M.merge(clone(b0), st([], { budget: 60000 }), base).state.budget, 60000);
  assert.strictEqual(M.merge(st([], { budget: 50000 }), st([], { budget: 60000 }), base).state.budget, 50000);
  assert.strictEqual(M.merge(clone(b0), st([], { store: { lendPer1000: 46, exchX10: 50, dailyLimit: 470, initSaved: 0 } }), base).state.store.lendPer1000, 46);
});
test('機種: 両方で足した機種はどちらも残り、並びはクラウドの順にそろう', () => {
  const b0 = st([]), base = M.snapshot(b0), mA = { id: 'x1', name: 'A機', fav: false }, mB = { id: 'x2', name: 'B機', fav: false };
  const onA = M.merge(st([], { machines: [...b0.machines, mA] }), st([], { machines: [...b0.machines, mB] }), base);
  assert.deepStrictEqual(onA.state.machines.map(m => m.id), ['m1', 'x2', 'x1']);
  const onB = M.merge(st([], { machines: [...b0.machines, mB] }), clone(onA.state), base); assert.ok(M.same(onB.state, onA.state));
});
test('2台でばらばらに操作して同期をくり返しても、最後は同じ内容にそろう（500通り）', () => {
  let seed = 12345; const rnd = k => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed % k; };
  for (let round = 0; round < 500; round++) {
    let clock = 100, nid = 0, cloud = null; const dev = [0, 1].map(() => ({ local: st([]), base: null }));
    const sync = d => { const m = M.merge(d.local, cloud && clone(cloud), d.base); cloud = clone(m.state); d.local = clone(m.state); d.base = M.snapshot(m.state); };
    for (let step = 0; step < 30; step++) {
      const d = dev[rnd(2)], k = rnd(10), ss = d.local.sessions; clock += 1 + rnd(5);
      if (k < 3) ss.push(rec('r' + (nid++), clock));
      else if (k < 5 && ss.length) { const i = rnd(ss.length), old = ss[i], next = { ...coreless(old), plays: [{ ...old.plays[0], out: rnd(2000) }], updatedAt: clock }; next.history = [...(old.history || []), { at: clock, before: coreless(old) }].slice(-20); ss[i] = next; }
      else if (k < 6 && ss.length) ss.splice(rnd(ss.length), 1);
      else if (k < 7) d.local.budget = 10000 * (1 + rnd(9));
      else if (k < 8) d.local.machines.push({ id: 'k' + (nid++), name: 'k', fav: false });
      else sync(d);
    }
    sync(dev[0]); sync(dev[1]); sync(dev[0]);
    assert.ok(M.same(dev[0].local, dev[1].local) && M.same(dev[0].local, cloud), 'round ' + round);
    const again = M.merge(dev[1].local, clone(cloud), dev[1].base); assert.ok(M.same(again.state, cloud), 'stable ' + round);
  }
  function coreless(s) { const c = clone(s); delete c.history; return c; }
});
console.log(`\n${n} tests passed`);
