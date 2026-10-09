// テスト用の記録データ。以前アプリに入っていた「サンプル」と同じ作り方で、2026-06-20 から今日までの記録を作る。
// アプリ本体にはもう含めていない。テストのときだけ、端末内の保存場所へ先に入れておく。
const Calc = require('../src/calc.js');
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const uid = () => 'r' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const CARD_MAIN = '';
function rng32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function sampleDB() {
  let r = rng32(SEED);
  const stores = [
    { id: 's1', name: 'デラックスセブン', lendPer1000: 47, exchX10: 50, dailyLimit: 470, initSaved: 0, main: true, card: typeof CARD_MAIN === 'string' ? CARD_MAIN : '' }
  ];
  const machines = [
    { id: 'm1', name: 'スマスロ北斗の拳', maker: 'サミー', type: 'スマスロ・AT', fav: true },
    { id: 'm2', name: 'L 東京喰種', maker: 'スパイキー', type: 'スマスロ・AT', fav: true },
    { id: 'm3', name: 'パチスロ 甲鉄城のカバネリ', maker: 'サミー', type: '6.5号機・AT', fav: false },
    { id: 'm4', name: 'スマスロ モンキーターンV', maker: '山佐', type: 'スマスロ・AT', fav: false },
    { id: 'm5', name: 'マイジャグラーV', maker: '北電子', type: '6号機・ノーマル', fav: true },
    { id: 'm6', name: 'Lパチスロ 革命機ヴァルヴレイヴ', maker: 'SANKYO', type: 'スマスロ・AT', fav: false }
  ];
  const memos = ['朝イチ、リセット狙いで着席。前日の最終ゲーム数を確認してから座った。', '天井まで残り200G台を拾う。AT終了後は即やめ。', '終了画面で高設定示唆が出たので続行。小役は設定4の近似値。', '夕方から。ゾーン手前の空き台を2台はしご。', '予算上限に達したので撤退。深追いしない。'];
  const bal = { s1: 0 }, sessions = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d0 = new Date(2026, 5, 20), nDays = Math.round((today - d0) / 864e5);
  for (let k = 0; k < nDays; k++) {
    const d = new Date(d0); d.setDate(d.getDate() + k); r = rng32(SEED * 7919 + k);
    const wd = d.getDay();
    if (r() > (wd === 0 || wd === 6 ? 0.7 : 0.28)) continue;
    r(); const st = stores[0];
    const want = r() < 0.5 ? 1 : r() < 0.75 ? 2 : 3;
    let avail = 0, usedSaved = 0; const plays = [];
    for (let i = 0; i < want; i++) {
      const mc = machines[Math.floor(r() * r() * machines.length * 1.6) % machines.length];
      let carryIn = 0, savedIn = 0, cash = 0;
      if (i > 0 && avail > 0) carryIn = avail;
      else if (bal[st.id] >= 150 && r() < 0.6) { savedIn = Math.min(bal[st.id], 50 * Math.ceil(r() * 10), st.dailyLimit - usedSaved); bal[st.id] -= savedIn; usedSaved += savedIn; }
      if (carryIn + savedIn < 300 || r() < 0.3) cash = 1000 * Math.ceil(r() * r() * 22 + 1);
      const inM = Calc.lent(cash, st.lendPer1000) + carryIn + savedIn;
      const q0 = r(), u = r();
      const out = Math.round(inM * (q0 < 0.40 ? 0 : q0 < 0.60 ? 0.2 + u * 0.7 : q0 < 0.82 ? 0.9 + u * 0.9 : q0 < 0.95 ? 1.8 + u * 1.7 : 3.5 + u * 3));
      avail = avail - carryIn + out;
      plays.push({ machineId: mc.id, cash, savedIn, carryIn, out, minutes: 30 + Math.round(r() * 17) * 10 });
      if (out === 0 && r() < 0.4) break;
    }
    let deposit = 0;
    if (avail > 0) { const q = r(); if (q < 0.3) deposit = avail; else if (q < 0.45 && avail > 300) deposit = Math.floor(avail / 100) * 50; }
    bal[st.id] += deposit;
    sessions.push({
      id: uid(), date: ymd(d), storeId: st.id, lendPer1000: st.lendPer1000, exchX10: st.exchX10, plays, deposit,
      cashOut: Calc.autoCashOut(avail, deposit, st.exchX10), expense: r() < 0.35 ? 440 : 0, memo: r() < 0.3 ? memos[Math.floor(r() * memos.length)] : ''
    });
  }
  const big = sessions.filter(x => x.cashOut >= 6000).slice(-2)[0];
  if (big) big.cashOut -= 1500;                       // 換金額が計算より少ない例
  const last = sessions[sessions.length - 1];
  if (last) { const before = JSON.parse(JSON.stringify(last)); before.plays[0].cash = Math.max(0, before.plays[0].cash - 1000); delete before.history; last.history = [{ at: new Date(last.date + 'T21:40:00').getTime(), before }]; }
  return { stores, machines, sessions };
}
const SEED = 46;

const KEY = 'dx7-shushi.v1';
exports.KEY = KEY;
exports.mine = () => { const d = sampleDB(); d.stores[0].card = ''; d.stores[0].cardDefault = true; return d; };
// ブラウザの保存場所に、記録を先に入れておく（そのタブで最初に開いたときの1回だけ。再読み込みでは入れ直さない）
exports.seed = (context, data = exports.mine(), budget = 80000) => context.addInitScript(([key, body]) => {
  if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.setItem(key, body);
}, [KEY, JSON.stringify({ savedAt: Date.now(), backupAt: 0, body: JSON.stringify({ v: 1, settings: { budget }, mine: data }) })]);
