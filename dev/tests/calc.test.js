const assert = require('assert');
const C = require('../src/calc.js');
let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log('ok  ' + name); };
const A = { lendPer1000: 46, exchX10: 56 };   // 46枚貸し・5.6枚交換
const B = { lendPer1000: 47, exchX10: 50 };   // 47枚貸し・5.0枚交換
const S = (rate, plays, extra = {}) => ({ id: 'x', date: '2026-10-01', storeId: 's1', ...rate, plays, deposit: 0, cashOut: 0, expense: 0, ...extra });

t('貸出枚数: 10,000円 → 460枚 / 470枚', () => {
  assert.strictEqual(C.lent(10000, 46), 460);
  assert.strictEqual(C.lent(10000, 47), 470);
});
t('1台・全部換金: 差枚と現金収支', () => {
  const s = S(A, [{ machineId: 'm', cash: 10000, out: 800 }]);
  s.cashOut = C.autoCashOut(800, 0, 56);          // 800/5.6*100 = 14,285 → 14,200
  const c = C.session(s);
  assert.strictEqual(s.cashOut, 14200);
  assert.strictEqual(c.plays[0].diff, 340);
  assert.strictEqual(c.cashResult, 4200);
  assert.strictEqual(c.evalResult, 4200);
  assert.strictEqual(c.plays[0].yen, 4286);        // 800枚×(100/5.6) − 10,000
  assert.strictEqual(c.gap, -86);                  // 端数差で必ず突き合う
  assert.strictEqual(c.machineSum + c.gap, c.evalResult);
});
t('交換条件が違う店: 同じ800枚でも収支が変わる', () => {
  const s = S(B, [{ machineId: 'm', cash: 10000, out: 800 }]);
  s.cashOut = C.autoCashOut(800, 0, 50);
  assert.strictEqual(s.cashOut, 16000);
  assert.strictEqual(C.session(s).cashResult, 6000);
});
t('3台を持ちメダルで移動: 台別と日合計が二重計上にならない', () => {
  const s = S(A, [
    { machineId: 'a', cash: 10000, out: 800 },
    { machineId: 'b', cash: 0, carryIn: 800, out: 300 },
    { machineId: 'c', cash: 5000, carryIn: 300, out: 0 }
  ]);
  const c = C.session(s);
  assert.deepStrictEqual(c.plays.map(p => p.diff), [340, -500, -530]);
  assert.strictEqual(c.hand, 0);
  assert.strictEqual(c.cash, 15000);               // 現金は実際に出した分だけ
  assert.strictEqual(c.cashResult, -15000);
  assert.strictEqual(c.diff, 0 - c.lent);          // 差枚合計 = 手元 − 貸出 − 貯メダル使用
  assert.strictEqual(c.machineSum, c.evalResult);  // 台別合計 = 日合計
});
t('貯メダル: 預けた日はプラス評価、使った日は現金支出ゼロ', () => {
  const d1 = S(A, [{ machineId: 'a', cash: 10000, out: 1120 }], { deposit: 1120, cashOut: 0 });
  const c1 = C.session(d1);
  assert.strictEqual(c1.cashResult, -10000);       // 財布は1万円減っただけ
  assert.strictEqual(c1.savedDelta, 1120);
  assert.strictEqual(c1.evalResult, 10000);        // 1120枚 = 20,000円相当
  const d2 = S(A, [{ machineId: 'a', cash: 0, savedIn: 560, out: 0 }], { date: '2026-10-02' });
  const c2 = C.session(d2);
  assert.strictEqual(c2.cash, 0);                  // 持ちメダルを現金支出にしない
  assert.strictEqual(c2.cashResult, 0);
  assert.strictEqual(c2.evalResult, -10000);
  const bal = C.balances([{ id: 's1', initSaved: 100 }], [d1, d2]);
  assert.strictEqual(bal.s1, 100 + 1120 - 560);
});
t('一部だけ預ける: 換金額と端数', () => {
  const s = S(A, [{ machineId: 'a', cash: 3000, out: 1000 }], { deposit: 500 });
  s.cashOut = C.autoCashOut(1000, 500, 56);        // 500枚 → 8,928 → 8,900
  const c = C.session(s);
  assert.strictEqual(s.cashOut, 8900);
  assert.strictEqual(c.leftover, 1);               // 500 − 8900×5.6/100 = 1.6 → 1枚
  assert.strictEqual(c.cashResult, 5900);
  assert.strictEqual(c.evalResult, 5900 + 8929);
});
t('集計: 日単位の勝敗・勝率・連勝連敗・経費', () => {
  const mk = (date, cash, cashOut, extra = {}) => S(A, [{ machineId: 'a', cash, out: 0, minutes: 60 }], { date, cashOut, ...extra });
  const list = [
    mk('2026-10-01', 10000, 0), mk('2026-10-01', 2000, 20000),   // 同じ日に2件 → 1日として +8,000
    mk('2026-10-02', 5000, 5000),                                  // 引き分け
    mk('2026-10-03', 5000, 0), mk('2026-10-04', 5000, 0, { expense: 500 }),
    mk('2026-10-05', 1000, 3000)
  ];
  const st = C.stats(list, 'cash');
  assert.strictEqual(st.dayCount, 5);
  assert.deepStrictEqual([st.wins, st.loses, st.draws], [2, 2, 1]);
  assert.strictEqual(st.winRate, 0.4);
  assert.strictEqual(st.streakLose, 2);
  assert.strictEqual(st.result, 8000 + 0 - 5000 - 5000 + 2000);
  assert.strictEqual(st.finalResult, st.result - 500);
  assert.strictEqual(st.maxWin.date, '2026-10-01');
  assert.strictEqual(st.hourly, st.result / 6);
  assert.strictEqual(C.byMonth(st.days)[0].result, st.result);
  assert.strictEqual(C.byWeekday(st.days).reduce((a, w) => a + w.result, 0), st.result);
});
t('集計: 台別合計 + 端数差 = 日合計（評価）', () => {
  const list = [
    S(A, [{ machineId: 'a', cash: 10000, out: 800 }, { machineId: 'b', carryIn: 800, cash: 0, out: 1337 }], { deposit: 300, cashOut: C.autoCashOut(1337, 300, 56) }),
    S(B, [{ machineId: 'b', cash: 7000, savedIn: 120, out: 91 }], { cashOut: C.autoCashOut(91, 0, 50) })
  ];
  const st = C.stats(list, 'eval');
  const mSum = C.byMachine(list).reduce((a, m) => a + m.yen, 0);
  const gap = list.reduce((a, s) => a + C.session(s).gap, 0);
  assert.strictEqual(mSum + gap, st.evalResult);
});
t('入力チェック', () => {
  let v = C.validate(S(A, [{ machineId: 'a', cash: 1000, out: 100 }, { machineId: '', carryIn: 200, out: 0 }], { deposit: 0 }));
  assert.ok(v.errors.some(e => e.includes('機種')));
  assert.ok(v.errors.some(e => e.includes('持ちメダル投入')));
  v = C.validate(S(A, [{ machineId: 'a', cash: 1000, out: 100 }], { deposit: 200 }));
  assert.ok(v.errors.some(e => e.includes('預け入れ')));
  v = C.validate(S(A, [{ machineId: 'a', cash: 0, savedIn: 500, out: 0 }]), { balance: 100 });
  assert.ok(v.warnings.some(e => e.includes('残高')));
  v = C.validate(S(A, [{ machineId: 'a', cash: 1000, out: 100 }], { cashOut: 1700 }));
  assert.strictEqual(v.errors.length, 0);
});
const DX = { lendPer1000: 47, exchX10: 50 };  // デラックスセブン: 1,000円=47枚 / 50枚=1,000円
t('デラックスセブンの条件: 現金で借りて増減なしなら6%目減り', () => {
  const s = S(DX, [{ machineId: 'm', cash: 10000, out: 470 }]);
  s.cashOut = C.autoCashOut(470, 0, 50);
  const c = C.session(s);
  assert.strictEqual(c.lent, 470);
  assert.strictEqual(c.plays[0].diff, 0);
  assert.strictEqual(s.cashOut, 9400);
  assert.strictEqual(c.cashResult, -600);
  assert.strictEqual(c.gap, 0);                    // 50枚=1,000円なので端数差なし
  assert.strictEqual(C.autoCashOut(1337, 0, 50), 26700); // 1337枚 → 26,740円 → 100円単位で切り捨て
});
t('貯メダルの1日上限470枚: 同じ日の他の記録も合算して判定', () => {
  const mk = savedIn => S(DX, [{ machineId: 'm', cash: 0, savedIn, out: 0 }]);
  assert.strictEqual(C.validate(mk(470), { balance: 1000, dailyLimit: 470, usedToday: 0 }).errors.length, 0);
  assert.ok(C.validate(mk(471), { balance: 1000, dailyLimit: 470, usedToday: 0 }).errors.some(e => e.includes('1日の上限')));
  assert.ok(C.validate(mk(200), { balance: 1000, dailyLimit: 470, usedToday: 300 }).errors.some(e => e.includes('合計 500枚')));
  assert.strictEqual(C.validate(mk(170), { balance: 1000, dailyLimit: 470, usedToday: 300 }).errors.length, 0);
  assert.strictEqual(C.validate(mk(900), { balance: 1000, dailyLimit: 0 }).errors.length, 0);   // 0 = 上限なし
  const two = S(DX, [{ machineId: 'a', cash: 0, savedIn: 300, out: 0 }, { machineId: 'b', cash: 0, savedIn: 200, out: 0 }]);
  assert.ok(C.validate(two, { balance: 1000, dailyLimit: 470 }).errors.some(e => e.includes('1日の上限')));
});
const codes = r => r.issues.map(x => x.code).sort().join(',');
t('二重チェック: 問題のない記録は「一致」', () => {
  const s = S(DX, [{ machineId: 'a', cash: 10000, out: 800 }, { machineId: 'b', carryIn: 800, out: 1337 }], { deposit: 300, cashOut: C.autoCashOut(1337, 300, 50) });
  const r = C.audit(s, { balance: 0, dailyLimit: 470 });
  assert.strictEqual(r.issues.length, 0);
  assert.strictEqual(r.recon.matched, true);
  assert.strictEqual(r.recon.consistent, true);
  assert.strictEqual(r.recon.diff, -40);            // 端数2枚＝40円ぶんだけ台別合計より少ない
  assert.strictEqual(r.recon.frac, 40);
  assert.strictEqual(r.recon.cashGap, 0);
});
t('二重チェック: 換金額と計算上の金額の差', () => {
  const base = { deposit: 0 };
  let r = C.audit(S(DX, [{ machineId: 'a', cash: 5000, out: 1000 }], { ...base, cashOut: 18000 }), {});   // 計算上 20,000円
  assert.strictEqual(r.recon.calcOut, 20000); assert.strictEqual(r.recon.cashGap, -2000);
  assert.strictEqual(r.recon.matched, false); assert.strictEqual(codes(r), 'cashout');
  assert.strictEqual(r.recon.diff, r.recon.cashGap - r.recon.frac);
  r = C.audit(S(DX, [{ machineId: 'a', cash: 5000, out: 1000 }], { ...base, cashOut: 19500 }), {});        // 500円の差は警告しない
  assert.strictEqual(r.issues.length, 0); assert.strictEqual(r.recon.cashGap, -500);
  r = C.audit(S(DX, [{ machineId: 'a', cash: 5000, out: 1000 }], { ...base, cashOut: 21000 }), {});        // 計算より多い
  assert.ok(r.issues.some(x => x.msg.includes('上回って')));
});
t('二重チェック: 現金投資と持ちメダルの二重計上の疑い', () => {
  // 1台目の800枚を持ったまま、2台目を現金で打ったことになっている
  let r = C.audit(S(DX, [{ machineId: 'a', cash: 10000, out: 800 }, { machineId: 'b', cash: 10000, out: 0 }], { cashOut: 16000 }), {});
  assert.ok(r.issues.some(x => x.code === 'double' && x.msg.includes('800枚残ったまま')));
  // 持ちメダル470枚と現金10,000円（=470枚）の両方が入っている
  r = C.audit(S(DX, [{ machineId: 'a', cash: 10000, out: 470 }, { machineId: 'b', cash: 10000, carryIn: 470, out: 0 }]), {});
  assert.ok(r.issues.some(x => x.code === 'double' && x.msg.includes('同じ470枚')));
  // 貯メダル470枚と現金10,000円の両方
  r = C.audit(S(DX, [{ machineId: 'a', cash: 10000, savedIn: 470, out: 0 }]), { balance: 1000, dailyLimit: 470 });
  assert.ok(r.issues.some(x => x.code === 'double' && x.msg.includes('貯メダル使用')));
  // 持ちメダルを全部入れて、足りない分を現金で追加するのは正常
  r = C.audit(S(DX, [{ machineId: 'a', cash: 10000, out: 200 }, { machineId: 'b', cash: 5000, carryIn: 200, out: 0 }]), {});
  assert.strictEqual(r.issues.length, 0);
});
t('二重チェック: 記録漏れ・入力の矛盾', () => {
  let r = C.audit(S(DX, [{ machineId: 'a', cash: 0, out: 500 }], { cashOut: 10000 }), {});
  assert.ok(r.issues.some(x => x.code === 'missing'));
  r = C.audit(S(DX, [{ machineId: 'a', cash: 1500, out: 0 }]), {});
  assert.ok(r.issues.some(x => x.code === 'unit'));
  r = C.audit(S(DX, [{ machineId: 'a', cash: 0, savedIn: 300, out: 0 }]), { balance: 100, dailyLimit: 470 });
  assert.ok(r.issues.some(x => x.msg.includes('記録漏れ')));
  r = C.audit(S(DX, [{ machineId: 'a', cash: 1000, out: 100 }], { deposit: 500 }), {});
  assert.strictEqual(r.errors, 1);
});
t('二重チェック: 全記録を日付順に検算（残高の追跡・同日の上限・重複）', () => {
  const st = [{ id: 's1', initSaved: 100, dailyLimit: 470 }];
  const mk = (id, date, plays, extra = {}) => ({ ...S(DX, plays, extra), id, date });
  const list = [
    mk('c', '2026-10-03', [{ machineId: 'a', cash: 0, savedIn: 400, out: 0 }]),                       // 直前の残高 100+600=700 → OK
    mk('a', '2026-10-01', [{ machineId: 'a', cash: 10000, out: 600 }], { deposit: 600 }),
    mk('b', '2026-10-02', [{ machineId: 'a', cash: 0, savedIn: 300, out: 0 }]),                       // 残高700 → 使用300 OK
    mk('d', '2026-10-04', [{ machineId: 'a', cash: 0, savedIn: 300, out: 0 }]),                       // 残高0 → 記録漏れの疑い
    mk('e', '2026-10-05', [{ machineId: 'a', cash: 3000, out: 0 }]), mk('f', '2026-10-05', [{ machineId: 'a', cash: 3000, out: 0 }])   // 重複
  ];
  const r = C.auditAll(st, list);
  assert.strictEqual(r.get('a').issues.length, 0);
  assert.strictEqual(r.get('b').issues.length, 0);
  assert.strictEqual(r.get('c').issues.length, 0);
  assert.ok(r.get('d').issues.some(x => x.msg.includes('残高（0枚）')));
  assert.ok(r.get('e').issues.some(x => x.code === 'dup') && r.get('f').issues.some(x => x.code === 'dup'));
  const lim = C.auditAll(st, [mk('x', '2026-10-01', [{ machineId: 'a', cash: 10000, out: 900 }], { deposit: 900 }), mk('y', '2026-10-02', [{ machineId: 'a', savedIn: 300, out: 0 }]), mk('z', '2026-10-02', [{ machineId: 'a', savedIn: 300, out: 0 }])]);
  assert.strictEqual(lim.get('y').errors + lim.get('z').errors, 2);                                   // 同じ日の合計600枚 > 470枚
});
t('変更履歴: 修正前後の違いを行で出す', () => {
  const a = S(DX, [{ machineId: 'm1', cash: 10000, out: 800 }], { cashOut: 16000, memo: '' });
  const b = S(DX, [{ machineId: 'm1', cash: 12000, out: 800 }, { machineId: 'm2', carryIn: 800, out: 0 }], { cashOut: 0, memo: 'x' });
  const d = C.diffSession(a, b, id => ({ m1: '北斗', m2: '喰種' }[id]));
  assert.deepStrictEqual(d, ['1台目 現金投資：10,000円 → 12,000円', '2台目を追加（喰種）', '換金額：16,000円 → 0円', 'メモを変更']);
  assert.deepStrictEqual(C.diffSession(a, a), []);
});
console.log(`\n${pass} tests passed`);
