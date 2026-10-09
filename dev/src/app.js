(() => {
'use strict';
/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nfm = new Intl.NumberFormat('ja-JP');
const nf = v => nfm.format(Math.round(v));
const WD = ['日', '月', '火', '水', '木', '金', '土'];
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const pdate = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const TODAY = () => ymd(new Date());
const addMonth = (m, k) => { const [y, mo] = m.split('-').map(Number); const d = new Date(y, mo - 1 + k, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const uid = () => 'r' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const norm = s => String(s).normalize('NFKC').toLowerCase().replace(/[\s・\-‐－]/g, '');
const sg = v => (v > 0 ? 'pos' : v < 0 ? 'neg' : 'zero');
const sign = v => (v > 0 ? '+' : v < 0 ? '−' : '±');
const Y = (v, o = {}) => { v = Math.round(v); return `<span class="num ${sg(v)}">${o.arrow ? `<span class="arw" aria-hidden="true">${v > 0 ? '▲' : v < 0 ? '▼' : '■'}</span>` : ''}<span class="nv"><span class="sg">${sign(v)}</span>${nf(Math.abs(v))}</span><i>${o.unit || '円'}</i></span>`; };
const N = (v, unit = '円') => `<span class="num"><span class="nv">${nf(v)}</span><i>${unit}</i></span>`;
const pct = v => (v == null ? '<span class="muted">—</span>' : `<span class="num"><span class="nv">${(v * 100).toFixed(1)}</span><i>%</i></span>`);
const exStr = x10 => (x10 / 10).toFixed(1);
const fin = v => (Calc.n(v) ? nf(Calc.n(v)) : '');
const compact = v => { const a = Math.abs(v); return (v > 0 ? '+' : v < 0 ? '−' : '') + (a >= 10000 ? (a / 10000).toFixed(1).replace(/\.0$/, '') + '万' : nf(a)); };
const ICON = {
  home: '<path d="M4 11.2 12 5l8 6.2V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z"/>',
  cal: '<rect x="4" y="6" width="16" height="14" rx="2.5"/><path d="M4 10.5h16M9 4v4M15 4v4"/>',
  plus: '<path d="M12 6v12M6 12h12"/>',
  stats: '<path d="M5 20v-8M12 20V5M19 20v-5"/>',
  more: '<path d="M5 7h14M5 12h14M5 17h14"/>',
  left: '<path d="m15 6-6 6 6 6"/>', right: '<path d="m9 6 6 6-6 6"/>', close: '<path d="M6 6l12 12M18 6 6 18"/>'
};
const svg = (k, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>`;

/* ---------- state ---------- */
let db, S, mine = null, sample = null;   // db は表示中のデータ（mine か sample のどちらか）
const storeOf = id => db.stores.find(s => s.id === id);
const machineOf = id => db.machines.find(m => m.id === id);
const inMonth = m => db.sessions.filter(s => s.date.startsWith(m));
const mainStore = () => db.stores.find(s => s.main) || db.stores[0];
const blankPlay = () => ({ machineId: '', cash: 0, savedIn: 0, carryIn: 0, out: 0, minutes: 0 });

/* ---------- sample data（固定シードで毎回同じ内容） ---------- */
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

/* ---------- 端末内保存（自分の記録だけを保存。サンプルは保存しない） ---------- */
const KEY = 'dx7-shushi.v1';
const store = { ok: true, last: '', savedAt: 0, backupAt: 0 };
function newMine() {
  return {
    stores: [{ id: 's1', name: 'デラックスセブン', lendPer1000: 47, exchX10: 50, dailyLimit: 470, initSaved: 0, main: true, card: typeof CARD_MAIN === 'string' ? CARD_MAIN : '' }],
    machines: sampleDB().machines.map(m => ({ ...m, fav: false })), sessions: []
  };
}
function pack() {   // 同梱のカード画像は保存データに含めない（容量の節約）
  const m = mine && { ...mine, stores: mine.stores.map(st => (st.card === CARD_MAIN ? { ...st, card: '', cardDefault: true } : st)) };
  return JSON.stringify({ v: 1, mode: S.mode, settings: { budget: S.budget, look2: S.look }, mine: m });
}
function persist() {
  stamp++;
  if (!store.ok) return;
  const body = pack(); if (body === store.last) return;
  try { const t = Date.now(); localStorage.setItem(KEY, JSON.stringify({ savedAt: t, backupAt: store.backupAt, body })); store.last = body; store.savedAt = t; }
  catch (_) { store.ok = false; }
}
function restore() {
  let raw = null;
  try { localStorage.setItem(KEY + '.t', '1'); localStorage.removeItem(KEY + '.t'); raw = localStorage.getItem(KEY); } catch (_) { store.ok = false; return null; }
  if (!raw) return null;
  try {
    const w = JSON.parse(raw), o = JSON.parse(w.body);
    if (o.v !== 1) throw new Error('version');
    if (o.mine) { if (!Array.isArray(o.mine.sessions) || !Array.isArray(o.mine.stores) || !o.mine.stores.length || !Array.isArray(o.mine.machines)) throw new Error('shape'); o.mine.stores.forEach(st => { if (st.cardDefault) { st.card = CARD_MAIN; delete st.cardDefault; } }); }
    store.last = w.body; store.savedAt = w.savedAt || 0; store.backupAt = w.backupAt || 0; return o;
  } catch (_) { try { localStorage.setItem(KEY + '.broken', raw); } catch (__) {} store.broken = true; return null; }   // 壊れたデータは上書きせず別名で残す
}

/* ---------- バックアップ（手動で書き出し・復元） ---------- */
let DL = null;   // 試作ページ上でのファイル保存の窓口（無い環境では null のまま）
try { window.claude?.use?.('downloads').then(x => { DL = x || null; }, () => {}); } catch (_) {}
function backupText() {
  const m = { ...mine, stores: mine.stores.map(st => (st.card === CARD_MAIN ? { ...st, card: '', cardDefault: true } : st)) };
  return JSON.stringify({ app: 'dx7-shushi', format: 1, exportedAt: new Date().toISOString(), settings: { budget: S.budget }, data: m });
}
function parseBackup(text) {
  let o; try { o = JSON.parse(text); } catch (_) { return { error: '読み込めませんでした。バックアップの内容が最初から最後まで入っているか確認してください。' }; }
  if (!o || o.app !== 'dx7-shushi' || o.format !== 1 || !o.data) return { error: 'このアプリのバックアップではありません。' };
  const d = o.data, n = Calc.n, str = v => (typeof v === 'string' ? v : '');
  if (!Array.isArray(d.sessions) || !Array.isArray(d.stores) || !d.stores.length || !Array.isArray(d.machines)) return { error: 'バックアップの中身が欠けています。' };
  const st0 = d.stores[0] || {};
  const stores = [{ id: 's1', name: 'デラックスセブン', lendPer1000: n(st0.lendPer1000) || 47, exchX10: n(st0.exchX10) || 50, dailyLimit: n(st0.dailyLimit), initSaved: n(st0.initSaved), main: true, card: str(st0.card).startsWith('data:image/') ? st0.card : CARD_MAIN }];
  const machines = [], mids = new Set();
  for (const m of d.machines) { if (!m || !str(m.id) || !str(m.name) || mids.has(m.id)) continue; mids.add(m.id); machines.push({ id: m.id, name: m.name.slice(0, 60), maker: str(m.maker).slice(0, 40), type: str(m.type).slice(0, 40), fav: !!m.fav }); }
  const sessions = [], sids = new Set(); let skipped = 0;
  for (const x of d.sessions) {
    if (!x || !/^\d{4}-\d{2}-\d{2}$/.test(str(x.date)) || !Array.isArray(x.plays) || !x.plays.length) { skipped++; continue; }
    let id = str(x.id) || uid(); if (sids.has(id)) id = uid(); sids.add(id);
    const plays = x.plays.map(p => { let mid = str(p && p.machineId); if (!mids.has(mid)) { mid = 'unknown'; if (!mids.has(mid)) { mids.add(mid); machines.push({ id: mid, name: '不明な機種', maker: '', type: '', fav: false }); } } return { machineId: mid, cash: n(p && p.cash), savedIn: n(p && p.savedIn), carryIn: n(p && p.carryIn), out: n(p && p.out), minutes: n(p && p.minutes) }; });
    const rec = { id, date: x.date, storeId: 's1', lendPer1000: n(x.lendPer1000) || stores[0].lendPer1000, exchX10: n(x.exchX10) || stores[0].exchX10, plays, deposit: n(x.deposit), cashOut: n(x.cashOut), expense: n(x.expense), memo: str(x.memo).slice(0, 2000) };
    if (n(x.createdAt)) rec.createdAt = n(x.createdAt); if (n(x.updatedAt)) rec.updatedAt = n(x.updatedAt);
    if (Array.isArray(x.history)) rec.history = x.history.filter(e => e && n(e.at) && e.before && Array.isArray(e.before.plays) && /^\d{4}-\d{2}-\d{2}$/.test(str(e.before.date))).slice(-20).map(e => ({ at: n(e.at), before: { date: e.before.date, plays: e.before.plays.map(p => ({ machineId: str(p && p.machineId), cash: n(p && p.cash), savedIn: n(p && p.savedIn), carryIn: n(p && p.carryIn), out: n(p && p.out), minutes: n(p && p.minutes) })), deposit: n(e.before.deposit), cashOut: n(e.before.cashOut), expense: n(e.before.expense), memo: str(e.before.memo).slice(0, 2000) } }));
    sessions.push(rec);
  }
  return { data: { stores, machines, sessions }, budget: n(o.settings && o.settings.budget), exportedAt: str(o.exportedAt), skipped };
}
const backupName = () => { const d = new Date(); return `dx7-shushi-backup-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`; };
function markBackup(msg) { store.backupAt = Date.now(); store.last = ''; persist(); if (S.sheet) renderSheet(); else render(); toast(msg); }

/* ---------- charts ---------- */
function lineChart(points, h = 120) {
  const W = 338, pl = 2, pr = 46, pt = 10, pb = 18;
  const vs = points.map(p => p.v); let mx = Math.max(0, ...vs), mn = Math.min(0, ...vs); if (mx === mn) mx += 1000;
  const x = i => pl + (points.length < 2 ? 0 : (W - pl - pr) * i / (points.length - 1));
  const y = v => pt + (h - pt - pb) * (mx - v) / (mx - mn);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`).join('');
  const lx = x(points.length - 1), last = points[points.length - 1];
  const ticks = [mx, mn]; if (y(0) - y(mx) > 13 && y(mn) - y(0) > 13) ticks.push(0);
  return `<svg class="chart" viewBox="0 0 ${W} ${h}" role="img" aria-label="累計収支の推移。最新 ${compact(last.v)}円">
    <line class="zero" x1="${pl}" x2="${W - pr}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}"/>
    <path class="ar" d="${path}L${lx.toFixed(1)} ${y(0).toFixed(1)}L${x(0).toFixed(1)} ${y(0).toFixed(1)}Z"/>
    <path class="ln" d="${path}"/>
    <circle class="pt" cx="${lx.toFixed(1)}" cy="${y(last.v).toFixed(1)}" r="4.5"/>
    ${ticks.map(t => `<text x="${W - pr + 9}" y="${(y(t) + 3.5).toFixed(1)}">${t === 0 ? '0' : compact(t)}</text>`).join('')}
    <text x="${pl}" y="${h - 3}">${esc(points[0].label)}</text><text x="${W - pr}" y="${h - 3}" text-anchor="end">${esc(last.label)}</text>
  </svg>`;
}
function barChart(items, h = 150) {
  const W = 338, showVals = items.length <= 12, pt = showVals ? 16 : 8, pb = showVals ? 30 : 18;
  const vs = items.map(p => p.v); let mx = Math.max(0, ...vs), mn = Math.min(0, ...vs); if (mx === mn) mx = 1;
  const band = W / items.length, bw = Math.min(30, band * 0.64);
  const y = v => pt + (h - pt - pb) * (mx - v) / (mx - mn);
  return `<svg class="chart" viewBox="0 0 ${W} ${h}" role="img" aria-label="収支の棒グラフ">
    ${items.map((p, i) => {
      const cx = i * band + band / 2, top = Math.min(y(p.v), y(0)), hh = Math.max(p.v === 0 ? 0 : 1.5, Math.abs(y(p.v) - y(0)));
      return (p.v !== 0 ? `<rect class="${p.v > 0 ? 'bp' : 'bn'}" x="${(cx - bw / 2).toFixed(1)}" y="${top.toFixed(1)}" width="${bw.toFixed(1)}" height="${hh.toFixed(1)}" rx="${Math.min(2.5, bw / 2)}"/>` : '')
        + (showVals && p.has ? `<text class="${p.v > 0 ? 'tp' : p.v < 0 ? 'tn' : ''}" x="${cx.toFixed(1)}" y="${(p.v >= 0 ? y(p.v) - 4 : y(p.v) + 11).toFixed(1)}" text-anchor="middle">${compact(p.v) || '0'}</text>` : '')
        + (p.label ? `<text x="${cx.toFixed(1)}" y="${h - 3}" text-anchor="middle">${esc(p.label)}</text>` : '');
    }).join('')}
    <line class="ax" x1="0" x2="${W}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}"/>
  </svg>`;
}
const cumulative = days => { let a = 0; return [{ label: days.length ? fmtMD(days[0].date) : '', v: 0 }].concat(days.map(d => ({ label: fmtMD(d.date), v: (a += d.result) }))); };
const fmtTime = t => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${pad(d.getMinutes())}`; };
const fmtMD = s => { const d = pdate(s); return `${d.getMonth() + 1}/${d.getDate()}`; };

/* ---------- shared pieces ---------- */
function dayItem(d) {
  const ss = db.sessions.filter(s => s.date === d.date), dt = pdate(d.date);
  const names = [...new Set(ss.flatMap(s => s.plays.map(p => machineOf(p.machineId)?.name || '不明')))];
  return `<button class="item" data-act="day" data-date="${d.date}">
    <span class="dt">${dt.getMonth() + 1}/${dt.getDate()}<small>${WD[dt.getDay()]}</small></span>
    <span><span class="tt">${esc(names.join('、'))}</span><span class="ss">${d.plays}台・投資 ${nf(d.cash)}円${d.minutes ? `・${Math.floor(d.minutes / 60)}時間${d.minutes % 60 ? d.minutes % 60 + '分' : ''}` : ''}</span></span>
    <span class="rr">${Y(d.result)}</span></button>`;
}
function cardHTML(st) {
  return st.card ? `<span class="cardimg"><img src="${st.card}" alt="${esc(st.name)}の会員カード"></span>`
    : `<span class="cardimg ph"><span class="ph-k">MEMBER'S CARD</span><span class="ph-n">${esc(st.name)}</span><span class="ph-h">カード画像は条件の編集から追加できます</span></span>`;
}
function memberBlock() {
  const st = mainStore(); if (!st) return '';
  const bal = Calc.balances(db.stores, db.sessions)[st.id] || 0;
  return `<button class="member" data-act="storeView" data-id="${st.id}" aria-label="${esc(st.name)}の会員カードと貯メダルの明細を開く">
    ${cardHTML(st)}
    <span class="member-row">
      <span class="member-name"><span class="tt">${esc(st.name)}</span><span class="ss">貸出 ${st.lendPer1000}枚・交換 ${st.exchX10}枚（1,000円あたり）</span></span>
      <span class="member-bal"><span class="k">貯メダル残高</span><span class="v">${N(bal, '枚')}</span><span class="d">約 ${nf(Calc.medalYen(bal, st.exchX10))}円</span></span>
    </span></button>`;
}
let auditCache = { key: null, map: new Map() };
function audits() { const key = db; if (auditCache.key !== key || auditCache.n !== db.sessions.length || auditCache.stamp !== stamp) auditCache = { key, n: db.sessions.length, stamp, map: Calc.auditAll(db.stores, db.sessions) }; return auditCache.map; }
let stamp = 0;   // データを書き換えるたびに増やして、検算をやり直す
const flagged = () => db.sessions.filter(x => { const a = audits().get(x.id); return a && a.issues.length; });
function reconHTML(s) {
  const a = audits().get(s.id); if (!a) return '';
  const r = a.recon, st = a.errors ? ['neg', `要修正 ${a.errors}件`] : a.warns ? ['warn', `確認 ${a.warns}件`] : ['ok', '問題なし'];
  return `<div class="recon"><header><b>二重チェック</b><span class="pill ${st[0]}">${st[1]}</span></header>
    <div class="rl"><span>台別の合計<small>各台の収支を足したもの</small></span>${Y(r.machineSum)}</div>
    <div class="rl"><span>この記録の収支<small>現金の増減＋貯メダルの増減</small></span>${Y(r.dayResult)}</div>
    <div class="rl"><span>差<small>${r.diff === 0 ? '台別の合計と一致' : `${r.frac ? `100円に満たない端数 ${nf(r.frac)}円` : ''}${r.frac && r.cashGap ? '・' : ''}${r.cashGap ? `換金額の差 ${sign(r.cashGap)}${nf(Math.abs(r.cashGap))}円` : ''}`}</small></span>${Y(r.diff)}</div>
    <div class="rl"><span>換金額<small>計算上は ${nf(r.calcOut)}円</small></span>${N(r.cashOut)}</div>
    ${a.issues.length ? `<ul>${a.issues.map(x => `<li class="${x.level}">${esc(x.msg)}</li>`).join('')}</ul>` : ''}</div>`;
}
function historyHTML(s) {
  const hs = s.history || []; if (!hs.length) return '';
  const open = S.sheet && S.sheet.hist === s.id, name = id => machineOf(id)?.name || '不明';
  return `<button class="histbtn" data-act="toggleHist" data-id="${s.id}" aria-expanded="${open}">変更履歴 ${hs.length}件 ${open ? '▴' : '▾'}</button>` + (open ? `<div class="hist">${hs.map((e, i) => { const after = hs[i + 1] ? hs[i + 1].before : s, lines = Calc.diffSession(e.before, after, name); return `<div class="he"><b>${fmtTime(e.at)} に修正</b>${lines.length ? lines.map(esc).join('<br>') : '内容の変更なし'}</div>`; }).reverse().join('')}</div>` : '');
}
const basisLabel = () => (S.basis === 'eval' ? 'メダル評価込み' : '現金のみ');
const lookSeg = () => `<span class="lookseg" role="group" aria-label="外観">${[['dark', '黒'], ['light', '白']].map(([k, l]) => `<button data-act="theme" data-t="${k}" aria-pressed="${S.look === k}" aria-label="${l}の外観">${l}</button>`).join('')}</span>`;
const topRight = () => `<span class="top-r">${lookSeg()}${modePill()}</span>`;
const modePill = () => (S.mode === 'sample' ? '<button class="pill warn" data-act="tab" data-tab="more">サンプル表示中</button>' : store.ok ? '<span class="pill">この端末に保存</span>' : '<span class="pill neg">保存できません</span>');

/* ---------- views ---------- */
const views = {
  home() {
    const t = TODAY(), m = t.slice(0, 7), dt = pdate(t), B = S.basis;
    const head = `<header class="top"><div><p class="eyebrow">${dt.getFullYear()}年${dt.getMonth() + 1}月${dt.getDate()}日（${WD[dt.getDay()]}）</p><h1>ホーム</h1></div>${topRight()}</header>`;
    const sampleBar = S.mode === 'sample' ? '<button class="banner tap" data-act="askMine">サンプルの数字を表示しています。<b>自分の記録を始める ›</b></button>' : !store.ok ? '<p class="banner err">このブラウザでは記録を保存できません。プライベートブラウズを解除するか、別のブラウザで開いてください。</p>' : '';
    if (!db.sessions.length) return head + memberBlock() + sampleBar + `<div class="empty"><b>まだ記録がありません</b><p>実戦を記録すると、今月の収支・貯メダル残高・推移がここに並びます。</p><button class="btn primary" data-act="tab" data-tab="add">最初の実戦を記録する</button>${S.mode === 'mine' ? `<button class="btn line" data-act="editStore" data-id="${mainStore().id}">いまの貯メダル残高を登録する</button>` : ''}</div>`;
    const all = Calc.stats(db.sessions, B), mon = Calc.stats(inMonth(m), B), prev = Calc.stats(inMonth(addMonth(m, -1)), B), td = Calc.stats(db.sessions.filter(s => s.date === t), B);
    const use = S.budget > 0 ? mon.cash / S.budget : 0, left = S.budget - mon.cash;
    const recent = all.days.slice(-5).reverse();
    const nf2 = flagged().length, auditBar = nf2 ? `<button class="banner tap" data-act="auditSheet">二重チェックで確認したい記録が ${nf2}件あります。<b>内容を見る ›</b></button>` : '';
    return head + memberBlock() + sampleBar + auditBar + `
    <section class="hero">
      <div class="lab"><span>${dt.getMonth() + 1}月の収支</span><span class="pill">メダル評価込み</span></div>
      <div class="big">${Y(mon.result, { arrow: true })}</div>
      <p class="sub">${mon.dayCount ? `${mon.wins}勝 ${mon.loses}敗 ${mon.draws}分（${mon.dayCount}日）` : '今月の記録はまだありません'}・前月 ${Y(prev.result)}</p>
    </section>
    <div class="ledger">
      <div><span class="k"><i class="dot cash"></i>財布（現金）</span><span class="v">${Y(mon.cashResult)}</span><span class="d">投資 ${nf(mon.cash)} ／ 換金 ${nf(mon.cashOut)}</span></div>
      <div><span class="k"><i class="dot medal"></i>貯メダルの増減</span><span class="v">${Y(mon.savedDelta, { unit: '枚' })}</span><span class="d">評価 ${sign(mon.savedYen)}${nf(Math.abs(mon.savedYen))}円を収支に加算</span></div>
    </div>
    <section class="card"><div class="kv3">
      <div><span class="k">本日</span><span class="v">${td.n ? Y(td.result) : '<span class="muted" style="font-size:13px">記録なし</span>'}</span></div>
      <div><span class="k">累計</span><span class="v">${Y(all.result)}</span></div>
      <div><span class="k">勝率（全期間）</span><span class="v">${pct(all.winRate)}</span></div>
    </div></section>
    <section class="card">
      <header><h2>今月の現金投資</h2><span class="sub">上限 ${nf(S.budget)}円</span></header>
      <div class="rowsb"><span style="font-size:24px">${N(mon.cash)}</span>${use >= 1 ? '<span class="pill neg">上限を超えています</span>' : use >= 0.8 ? '<span class="pill warn">上限の80%を超えました</span>' : ''}</div>
      <div class="bar ${use >= 1 ? 'over' : use >= 0.8 ? 'warn' : ''}" role="img" aria-label="上限の${Math.round(use * 100)}%を使用"><span style="width:${Math.min(100, use * 100).toFixed(1)}%"></span></div>
      <div class="rowsb sub"><span>${left >= 0 ? `残り ${nf(left)}円` : `超過 ${nf(-left)}円`}</span><span>${Math.round(use * 100)}%</span></div>
    </section>
    <section class="card">
      <header><h2>累計収支の推移</h2><button class="more-link" data-act="tab" data-tab="stats">分析を見る ›</button></header>
      ${lineChart(cumulative(all.days))}
    </section>
    <section class="card">
      <header><h2>最近の実戦</h2><button class="more-link" data-act="tab" data-tab="cal">カレンダー ›</button></header>
      <div class="list">${recent.map(dayItem).join('')}</div>
    </section>`;
  },

  cal() {
    const m = S.cal, [y, mo] = m.split('-').map(Number), t = TODAY();
    const nd = new Date(y, mo, 0).getDate(), lead = new Date(y, mo - 1, 1).getDay();
    const st = Calc.stats(inMonth(m), S.basis), map = new Map(st.days.map(d => [d.date, d]));
    let cells = WD.map(w => `<span class="wd">${w}</span>`).join('') + '<span class="c out"></span>'.repeat(lead);
    for (let d = 1; d <= nd; d++) {
      const ds = `${m}-${pad(d)}`, rec = map.get(ds), fut = ds > t;
      const cls = `c${ds === t ? ' today' : ''}${fut ? ' future' : ''}${rec ? (rec.result > 0 ? ' win' : rec.result < 0 ? ' lose' : ' draw') : ''}`;
      const inner = `<span class="dn">${d}</span>` + (rec ? `<span class="mk ${sg(rec.result)}" aria-hidden="true">${rec.result > 0 ? '▲' : rec.result < 0 ? '▼' : '■'}</span><span class="am">${sign(rec.result)}${nf(Math.abs(rec.result))}</span>` : '');
      cells += rec ? `<button class="${cls}" data-act="day" data-date="${ds}" aria-label="${mo}月${d}日 ${sign(rec.result)}${nf(Math.abs(rec.result))}円">${inner}</button>`
        : fut ? `<span class="${cls}">${inner}</span>` : `<button class="${cls}" data-act="newOn" data-date="${ds}" aria-label="${mo}月${d}日 記録なし。タップで記録">${inner}</button>`;
    }
    const passed = m < t.slice(0, 7) ? nd : m === t.slice(0, 7) ? pdate(t).getDate() : 0;
    return `<header class="top"><div><p class="eyebrow">${basisLabel()}で表示</p><h1>カレンダー</h1></div>${topRight()}</header>
    <div class="cal-nav"><button data-act="calMove" data-k="-1" aria-label="前の月">${svg('left')}</button><b>${y}年 ${mo}月</b><button data-act="calMove" data-k="1" aria-label="次の月" ${m >= t.slice(0, 7) ? 'disabled style="opacity:.25"' : ''}>${svg('right')}</button></div>
    <div class="cal">${cells}</div>
    <section class="card">
      <header><h2>${mo}月の合計</h2><span style="font-size:22px">${Y(st.result)}</span></header>
      <div class="kv3">
        <div><span class="k">実戦／休み</span><span class="v">${N(st.dayCount, '日')}<span class="muted" style="font-size:12px">／${Math.max(0, passed - st.dayCount)}日</span></span></div>
        <div><span class="k">勝敗</span><span class="v num">${st.wins}<i>勝</i> ${st.loses}<i>敗</i> ${st.draws}<i>分</i></span></div>
        <div><span class="k">現金投資</span><span class="v">${N(st.cash)}</span></div>
      </div>
    </section>
    ${st.days.length ? `<section class="card"><header><h2>この月の実戦</h2></header><div class="list">${st.days.slice().reverse().map(dayItem).join('')}</div></section>`
      : `<div class="empty"><b>この月の記録はありません</b><p>日付をタップすると、その日の実戦を記録できます。</p></div>`}`;
  },

  stats() {
    const t = TODAY(), B = S.basis, P = S.period;
    const list = P === 'month' ? inMonth(t.slice(0, 7)) : P === 'year' ? db.sessions.filter(s => s.date.startsWith(t.slice(0, 4))) : db.sessions;
    const st = Calc.stats(list, B);
    const head = `<header class="top"><div><p class="eyebrow">${basisLabel()}で集計</p><h1>分析</h1></div>${topRight()}</header>
    <div class="seg" role="group" aria-label="期間">${[['month', '今月'], ['year', '今年'], ['all', '全期間']].map(([k, l]) => `<button data-act="period" data-p="${k}" aria-pressed="${P === k}">${l}</button>`).join('')}</div>`;
    if (!st.n) return head + `<div class="empty"><b>この期間の記録はありません</b><p>期間を切り替えるか、実戦を記録してください。</p></div>`;
    let bars;
    if (P === 'month') {
      const m = t.slice(0, 7), nd = new Date(+m.slice(0, 4), +m.slice(5), 0).getDate(), map = new Map(st.days.map(d => [d.date, d]));
      bars = Array.from({ length: nd }, (_, i) => { const r = map.get(`${m}-${pad(i + 1)}`); return { label: (i === 0 || (i + 1) % 5 === 0) ? String(i + 1) : '', v: r ? r.result : 0, has: !!r }; });
    } else bars = Calc.byMonth(st.days).map(r => ({ label: `${+r.month.slice(5)}月`, v: r.result, has: true }));
    const mach = Calc.byMachine(list), wd = Calc.byWeekday(st.days);
    const mx = arr => Math.max(1, ...arr.map(v => Math.abs(v)));
    const row = (name, sub, v, max) => `<div class="r"><span class="nm"><span>${esc(name)}</span><small>${sub}</small></span><span class="vv">${Y(v)}</span><span class="tr"><span class="${v >= 0 ? 'p' : 'm'}" style="width:${(Math.abs(v) / max * 50).toFixed(1)}%"></span></span></div>`;
    const mMax = mx(mach.map(r => r.yen)), wMax = mx(wd.map(r => r.result));
    const dOf = d => (d ? `<small>${fmtMD(d.date)}</small>` : '');
    return head + `
    <section class="card">
      <header><h2>収支合計</h2><span class="sub">${st.dayCount}日・${st.plays}台</span></header>
      <div style="font-size:34px;line-height:1.1">${Y(st.result, { arrow: true })}</div>
      <dl class="dl">
        <div><dt>勝敗<small>日単位で判定</small></dt><dd class="num">${st.wins}<i>勝</i> ${st.loses}<i>敗</i> ${st.draws}<i>分</i></dd></div>
        <div><dt>勝率<small>勝ち日数 ÷ 実戦日数（引き分けを含む）</small></dt><dd>${pct(st.winRate)}</dd></div>
        <div><dt>現金投資 ／ 換金額</dt><dd>${N(st.cash)}<small>換金 ${nf(st.cashOut)}円</small></dd></div>
        <div><dt>回収率<small>（投資＋収支）÷ 投資</small></dt><dd>${pct(st.returnRate)}</dd></div>
        <div><dt>1日あたり平均投資</dt><dd>${N(st.avgCash)}</dd></div>
        <div><dt>1日あたり平均収支</dt><dd>${Y(st.avgResult)}</dd></div>
        <div><dt>時給換算<small>遊技時間を入力した ${st.timedN}件・${(st.timedMinutes / 60).toFixed(1)}時間が対象</small></dt><dd>${st.hourly == null ? '<span class="muted">—</span>' : Y(st.hourly)}</dd></div>
        <div><dt>最大勝ち</dt><dd>${st.maxWin ? Y(st.maxWin.result) : '<span class="muted">—</span>'}${dOf(st.maxWin)}</dd></div>
        <div><dt>最大負け</dt><dd>${st.maxLose ? Y(st.maxLose.result) : '<span class="muted">—</span>'}${dOf(st.maxLose)}</dd></div>
        <div><dt>最長連勝 ／ 連敗</dt><dd class="num">${st.streakWin}<i>連勝</i> ${st.streakLose}<i>連敗</i></dd></div>
        <div><dt>経費<small>交通費など。勝敗には含めない</small></dt><dd>${N(st.expense)}</dd></div>
        <div><dt>最終収支<small>収支 − 経費</small></dt><dd>${Y(st.finalResult)}</dd></div>
      </dl>
      <button class="more-link" data-act="rules">計算ルールを見る ›</button>
    </section>
    <section class="card"><header><h2>${P === 'month' ? '日別収支' : '月別収支'}</h2></header>${barChart(bars)}</section>
    <section class="card"><header><h2>累計収支の推移</h2><span>${Y(st.result)}</span></header>${lineChart(cumulative(st.days))}</section>
    <section class="card"><header><h2>機種別</h2><span class="sub">交換レート換算</span></header>
      <div class="rank">${mach.map(r => row(machineOf(r.id)?.name || '不明', `${r.n}回`, r.yen, mMax)).join('')}</div>
      <p class="note">台別の収支は、メダルを1枚20円で換算した値です。</p></section>
    <section class="card"><header><h2>曜日別</h2></header><div class="rank">${wd.map(r => r.n ? row(`${WD[r.wd]}曜`, `${r.n}日`, r.result, wMax) : `<div class="r"><span class="nm muted">${WD[r.wd]}曜<small>記録なし</small></span><span class="vv muted">—</span><span class="tr"></span></div>`).join('')}</div></section>
    <p class="note">ここにあるのは過去の記録の集計です。今後の結果を示すものではありません。</p>`;
  },

  more() {
    const bal = Calc.balances(db.stores, db.sessions), mach = new Map(Calc.byMachine(db.sessions).map(r => [r.id, r]));
    return `<header class="top"><div><p class="eyebrow">設定・マスタ</p><h1>その他</h1></div>${topRight()}</header>
    <section class="card"><header><h2>表示するデータ</h2><span class="sub">${db.sessions.length}件</span></header>
      <div class="seg" role="group" aria-label="表示するデータ"><button data-act="${mine ? 'useMine' : 'askMine'}" aria-pressed="${S.mode === 'mine'}">自分の記録</button><button data-act="useSample" aria-pressed="${S.mode === 'sample'}">サンプル</button></div>
      <p class="note">${S.mode === 'mine' ? (store.ok ? `この端末（このブラウザ）に保存しています${store.savedAt ? `。最終保存 ${fmtTime(store.savedAt)}` : ''}。` : 'このブラウザでは保存できません。') : 'サンプルは保存されません。再読み込みすると最初の状態に戻ります。' + (mine ? '' : '「自分の記録」を選ぶと、空の状態から記録を始められます。')}</p>
      ${S.mode === 'mine' ? `<div class="grid2"><button class="btn line sm" data-act="backup">バックアップと復元</button><button class="btn danger sm" data-act="askWipe">すべて消す</button></div>
      <p class="note">${store.backupAt ? `最後のバックアップ ${fmtTime(store.backupAt)}。` : 'まだバックアップしていません。'}端末の中だけに保存しているので、機種変更や故障に備えて、ときどき書き出してください。</p>`
        : `<div class="grid2"><button class="btn line sm" data-act="askReset">サンプルに戻す</button><button class="btn line sm" data-act="askClear">サンプルを空にする</button></div><button class="btn line sm" data-act="backup">バックアップから復元</button>`}
      <p class="note">このページは試作です。ブラウザのデータを消すと、記録も消えます。</p></section>
    <section class="card"><header><h2>収支の二重チェック</h2><span class="sub">${db.sessions.length}件を検算</span></header>
      <p class="note">${flagged().length ? `${db.sessions.length - flagged().length}件は問題なし、${flagged().length}件に確認したい点があります。` : db.sessions.length ? 'すべての記録で、台別の合計と1日の収支がつながっています。' : '記録を入れると、ここで自動的に検算します。'}保存するたびに、二重計上の疑い・換金額の差・入力の矛盾を調べます。</p>
      <button class="btn line sm" data-act="auditSheet">チェックの結果を見る</button></section>
    <section class="card"><header><h2>収支の計算</h2></header>
      <p class="note">収支は<b style="color:var(--fg-2)">メダル評価込み</b>で表示します。財布の増減に、貯メダルの増減（1枚 ${(1000 / mainStore().exchX10).toFixed(mainStore().exchX10 % 50 ? 1 : 0)}円で換算）を足したものです。預けた日にプラス、使った日にマイナスが付きます。</p>
      <button class="more-link" data-act="rules">計算ルールを見る ›</button></section>
    ${(st => `<section class="card"><header><h2>${esc(st.name)}の条件</h2><button class="more-link" data-act="editStore" data-id="${st.id}">編集 ›</button></header>
      <dl class="dl">
        <div><dt>貸出<small>1,000円あたり</small></dt><dd>${N(st.lendPer1000, '枚')}</dd></div>
        <div><dt>交換<small>1,000円あたり・1枚 ${(1000 / st.exchX10).toFixed(st.exchX10 % 50 ? 1 : 0)}円</small></dt><dd>${N(st.exchX10, '枚')}</dd></div>
        <div><dt>貯メダルの1日の使用上限</dt><dd>${st.dailyLimit ? N(st.dailyLimit, '枚') : '<span class="muted">なし</span>'}</dd></div>
        <div><dt>貯メダル残高</dt><dd>${N(bal[st.id] || 0, '枚')}</dd></div>
      </dl></section>`)(mainStore())}
    <section class="card"><header><h2>月間の現金投資上限</h2></header>
      <label class="frow" for="f-budget" style="background:var(--raised)"><span>上限額</span><input id="f-budget" type="text" inputmode="numeric" pattern="[0-9]*" data-num value="${fin(S.budget)}" class="numin"><span>円</span></label>
      <p class="note">ホームの「今月の現金投資」に反映されます。80%を超えると注意、100%で超過と表示します。</p></section>
    <section class="card"><header><h2>機種</h2><span class="sub">★はお気に入り</span></header>
      <div class="list">${db.machines.map(mc => { const r = mach.get(mc.id); return `<div class="item" style="grid-template-columns:auto minmax(0,1fr) auto"><button data-act="fav" data-id="${mc.id}" aria-label="${esc(mc.name)}をお気に入り${mc.fav ? 'から外す' : 'に追加'}" aria-pressed="${mc.fav}" style="width:36px;height:44px;font-size:18px;color:${mc.fav ? 'var(--gold)' : 'var(--fg-3)'}">${mc.fav ? '★' : '☆'}</button><span><span class="tt">${esc(mc.name)}</span><span class="ss">${esc([mc.maker, mc.type].filter(Boolean).join('・') || '分類未設定')}</span></span><span class="rr">${r ? Y(r.yen) : '<span class="muted">—</span>'}<small>${r ? r.n : 0}回</small></span></div>`; }).join('')}</div></section>
    <section class="card"><header><h2>外観</h2></header>
      <div class="seg" role="group" aria-label="外観">${[['dark', '黒（標準）'], ['light', '白']].map(([k, l]) => `<button data-act="theme" data-t="${k}" aria-pressed="${S.look === k}">${l}</button>`).join('')}</div></section>
`;
  }
};

/* ---------- sheets ---------- */
function draftRates() {
  const d = S.draft, st = storeOf(d.storeId);
  if (d.snap && d.snap.storeId === d.storeId) return { lendPer1000: d.snap.lendPer1000, exchX10: d.snap.exchX10 };
  return st ? { lendPer1000: st.lendPer1000, exchX10: st.exchX10 } : { lendPer1000: 47, exchX10: 50 };
}
function draftSession() {
  const d = S.draft, r = draftRates();
  const s = { id: d.id, date: d.date, storeId: d.storeId, ...r, plays: d.plays.map(p => ({ machineId: p.machineId, cash: Calc.n(p.cash), savedIn: Calc.n(p.savedIn), carryIn: Calc.n(p.carryIn), out: Calc.n(p.out), minutes: Calc.n(p.minutes) })), deposit: Calc.n(d.deposit), expense: Calc.n(d.expense), memo: d.memo.trim() };
  const hand = s.plays.reduce((a, p) => a + p.out - p.carryIn, 0);
  s.cashOut = d.manual ? Calc.n(d.cashOut) : Calc.autoCashOut(hand, s.deposit, s.exchX10);
  return s;
}
const draftUsedToday = () => { const d = S.draft; return db.sessions.filter(x => x.id !== d.id && x.date === d.date && x.storeId === d.storeId).reduce((a, x) => a + x.plays.reduce((b, p) => b + Calc.n(p.savedIn), 0), 0); };
const vopts = () => ({ balance: draftBalance(), dailyLimit: storeOf(S.draft.storeId)?.dailyLimit || 0, usedToday: draftUsedToday() });
const draftBalance = () => { const d = S.draft; return d.storeId ? (Calc.balances(db.stores, db.sessions.filter(x => x.id !== d.id))[d.storeId] || 0) : 0; };
function numField(label, unit, f, val) {
  const id = 'f-' + f.replace(/\./g, '-');
  return `<label class="nf" for="${id}"><span>${label}</span><span class="nfi"><input id="${id}" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" data-f="${f}" data-num value="${fin(val)}" placeholder="0"><i>${unit}</i></span></label>`;
}
function openEntry(o = {}) {
  let d;
  const src = o.id && db.sessions.find(x => x.id === o.id);
  if (src && o.copy) d = { id: null, date: TODAY(), storeId: src.storeId, plays: src.plays.map(p => ({ ...blankPlay(), machineId: p.machineId })), deposit: 0, cashOut: 0, manual: false, expense: src.expense, memo: '', more: !!src.expense, snap: null };
  else if (src) { const c = Calc.session(src); d = { id: src.id, date: src.date, storeId: src.storeId, plays: src.plays.map(p => ({ ...p })), deposit: src.deposit, cashOut: src.cashOut, manual: src.cashOut !== Calc.autoCashOut(c.hand, src.deposit, src.exchX10), expense: src.expense, memo: src.memo || '', more: !!(src.expense || src.memo || c.minutes), snap: { storeId: src.storeId, lendPer1000: src.lendPer1000, exchX10: src.exchX10 } }; }
  else { d = { id: null, date: o.date || TODAY(), storeId: o.storeId || mainStore()?.id || '', plays: [blankPlay()], deposit: 0, cashOut: 0, manual: false, expense: 0, memo: '', more: false, snap: null }; }
  S.draft = d; S.tried = false; S.sheet = { type: 'entry' }; S.enter = true; renderSheet();
}
const sheets = {
  entry() {
    const d = S.draft, st = storeOf(d.storeId), r = draftRates(), bal = draftBalance();
    const showSaved = p => d.more || bal > 0 || Calc.n(p.savedIn) > 0;
    return `<header class="sh-head"><button data-act="closeSheet" aria-label="閉じる">${svg('close')}</button><h2>${d.id ? '実戦を編集' : '実戦を記録'}</h2><span></span></header>
    <div class="sh-body">
      <label class="frow" for="f-date"><span>日付</span><input id="f-date" type="date" data-f="date" value="${d.date}" max="${TODAY()}"></label>
      ${st ? `<p class="hint"><b style="color:var(--fg-2);font-weight:500">${esc(st.name)}</b>・貸出 ${r.lendPer1000}枚／交換 ${r.exchX10}枚（1,000円あたり）・貯メダル残高 ${nf(bal)}枚${d.snap ? '・記録時の条件' : ''}</p>` : ''}
      ${d.plays.map((p, i) => { const mc = machineOf(p.machineId); return `<section class="pcard">
        <header><span class="pno">${i + 1}台目</span>${d.plays.length > 1 ? `<button data-act="delPlay" data-i="${i}">この台を外す</button>` : ''}</header>
        <button class="mpick ${mc ? '' : 'none'}" data-act="pickMachine" data-i="${i}"><span>${mc ? esc(mc.name) : '機種を選ぶ'}${mc && (mc.maker || mc.type) ? `<small>${esc([mc.maker, mc.type].filter(Boolean).join('・'))}</small>` : ''}</span>${svg('right', 'chev')}</button>
        ${numField('現金投資', '円', `p.${i}.cash`, p.cash)}
        <div class="sub-chips">${[1000, 5000, 10000].map(v => `<button class="chip xs" data-act="cashAdd" data-i="${i}" data-v="${v}">+${nf(v)}</button>`).join('')}</div>
        ${i > 0 ? numField('持ちメダル投入', '枚', `p.${i}.carryIn`, p.carryIn) + `<div class="sub-chips"><button class="chip xs" id="carry-${i}" data-act="carryAll" data-i="${i}"></button></div>` : ''}
        ${showSaved(p) ? numField('貯メダル使用', '枚', `p.${i}.savedIn`, p.savedIn) + `<div class="sub-chips"><span class="hint" id="svl-${i}" style="margin-right:auto;align-self:center"></span><button class="chip xs" id="sv-${i}" data-act="savedMax" data-i="${i}"></button></div>` : ''}
        ${numField('終了時の枚数', '枚', `p.${i}.out`, p.out)}
        ${d.more ? numField('遊技時間', '分', `p.${i}.minutes`, p.minutes) : ''}
        <div class="pres" id="pres-${i}"></div></section>`; }).join('')}
      <button class="btn line" data-act="addPlay">＋ 台を追加</button>
      <section class="settle">
        <h3>精算</h3>
        <div class="srow"><span>手元のメダル</span><span id="st-hand"></span></div>
        ${numField('貯メダルに預ける', '枚', 'deposit', d.deposit)}
        <div class="sub-chips"><button class="chip xs" data-act="depSet" data-v="0">預けない</button><button class="chip xs" data-act="depSet" data-v="all">全部預ける</button></div>
        ${numField('換金額', '円', 'cashOut', d.manual ? d.cashOut : '')}
        <div class="sub-chips"><span class="hint" id="st-autolab" style="margin-right:auto;align-self:center"></span><button class="chip xs" id="st-auto" data-act="cashAuto">自動計算に戻す</button></div>
        <div class="flow"><div class="flowbar" id="st-bar"></div><div class="legend" id="st-leg"></div></div>
      </section>
      ${d.more ? `${`<section class="pcard">${numField('経費（交通費など）', '円', 'expense', d.expense)}</section>`}
        <label class="field" for="f-memo"><span class="flabel">メモ（台を選んだ理由・やめた理由など）</span><textarea id="f-memo" rows="3" data-f="memo">${esc(d.memo)}</textarea></label>`
        : `<button class="linkbtn" data-act="moreFields">＋ 遊技時間・経費・メモを入力する</button>`}
      <div id="entry-msgs" style="display:flex;flex-direction:column;gap:8px"></div>
    </div>
    <footer class="sh-foot"><div class="res" id="entry-res"></div><button class="btn primary" data-act="save">保存する</button></footer>`;
  },

  day() {
    const date = S.sheet.date, ss = db.sessions.filter(s => s.date === date), dt = pdate(date), B = S.basis;
    const st = Calc.stats(ss, B);
    return `<header class="sh-head"><button data-act="closeSheet" aria-label="閉じる">${svg('close')}</button><h2>${dt.getMonth() + 1}月${dt.getDate()}日（${WD[dt.getDay()]}）</h2><span></span></header>
    <div class="sh-body">
      <section class="hero" style="padding-top:0"><div class="lab"><span>この日の収支</span><span class="pill">${basisLabel()}</span></div><div class="big" style="font-size:40px">${Y(st.result, { arrow: true })}</div>
        <p class="sub">${st.plays}台・投資 ${nf(st.cash)}円・換金 ${nf(st.cashOut)}円${st.minutes ? `・${Math.floor(st.minutes / 60)}時間${st.minutes % 60}分` : ''}${ss.length > 1 ? `・記録 ${ss.length}件` : ''}</p></section>
      ${ss.map(s => { const c = Calc.session(s), sto = storeOf(s.storeId); return `<section class="sess">
        <header><b>${esc(sto?.name || '実戦')}</b><span class="sub">貸出 ${s.lendPer1000}枚／交換 ${s.exchX10}枚（1,000円あたり・記録時の条件）</span></header>
        ${s.plays.map((p, i) => { const cp = c.plays[i], parts = []; if (p.cash) parts.push(`現金 ${nf(p.cash)}円（${nf(cp.lent)}枚）`); if (p.carryIn) parts.push(`持ちメダル ${nf(p.carryIn)}枚`); if (p.savedIn) parts.push(`貯メダル ${nf(p.savedIn)}枚`);
          return `<div class="pl"><span class="nm"><small>${i + 1}台目</small>${esc(machineOf(p.machineId)?.name || '不明')}</span><span class="yy">${Y(cp.yen)}</span><span class="ex">${parts.join(' ＋ ') || '投入なし'} → 終了 ${nf(p.out)}枚 ／ 差枚 ${sign(cp.diff)}${nf(Math.abs(cp.diff))}枚${p.minutes ? ` ／ ${p.minutes}分` : ''}</span></div>`; }).join('')}
        <div class="tot"><dl class="dl">
          <div><dt>手元のメダル<small>換金 ${nf(Math.max(0, c.exchMedals - c.leftover))}枚・預け入れ ${nf(c.deposit)}枚・端数 ${nf(c.leftover)}枚</small></dt><dd>${N(c.hand, '枚')}</dd></div>
          <div class="${B === 'cash' ? 'strong' : ''}"><dt>現金収支<small>換金 ${nf(c.cashOut)}円 − 投資 ${nf(c.cash)}円</small></dt><dd>${Y(c.cashResult)}</dd></div>
          <div><dt>貯メダルの増減<small>預け入れ ${nf(c.deposit)}枚 − 使用 ${nf(c.savedIn)}枚</small></dt><dd>${Y(c.savedDelta, { unit: '枚' })}<small>評価 ${sign(c.savedYen)}${nf(Math.abs(c.savedYen))}円</small></dd></div>
          <div class="${B === 'eval' ? 'strong' : ''}"><dt>遊技収支<small>メダル評価込み</small></dt><dd>${Y(c.evalResult)}</dd></div>
          ${c.expense ? `<div><dt>経費</dt><dd>${N(c.expense)}</dd></div><div><dt>最終収支<small>経費込み</small></dt><dd>${Y((B === 'cash' ? c.cashResult : c.evalResult) - c.expense)}</dd></div>` : ''}
        </dl></div>
        ${s.memo ? `<p class="memo">${esc(s.memo)}</p>` : ''}
        ${reconHTML(s)}${historyHTML(s)}
        <div class="acts"><button class="btn line sm" data-act="editRec" data-id="${s.id}">編集</button><button class="btn line sm" data-act="copyRec" data-id="${s.id}">複製</button><button class="btn danger sm" data-act="askDel" data-id="${s.id}">削除</button></div>
      </section>`; }).join('')}
      <button class="btn line" data-act="newOn" data-date="${date}">＋ この日に記録を追加</button>
    </div>`;
  },

  storeView() {
    const st = storeOf(S.sheet.id), t = TODAY();
    const bal = Calc.balances(db.stores, db.sessions)[st.id] || 0;
    const usedToday = db.sessions.filter(x => x.date === t).reduce((a, x) => a + Calc.session(x).savedIn, 0);
    const room = Math.max(0, Math.min(bal, st.dailyLimit > 0 ? st.dailyLimit - usedToday : bal));
    let run = Calc.n(st.initSaved); const rows = [];
    db.sessions.map((x, i) => [x, i]).sort((a, b) => (a[0].date < b[0].date ? -1 : a[0].date > b[0].date ? 1 : a[1] - b[1])).forEach(([x]) => {
      const c = Calc.session(x); if (!c.deposit && !c.savedIn) return; run += c.savedDelta; rows.push({ date: x.date, dep: c.deposit, use: c.savedIn, bal: run });
    });
    return `<header class="sh-head"><button data-act="closeSheet" aria-label="閉じる">${svg('close')}</button><h2>会員カード</h2><span></span></header>
    <div class="sh-body">
      <div class="member static">${cardHTML(st)}</div>
      <div class="ledger">
        <div><span class="k"><i class="dot medal"></i>貯メダル残高</span><span class="v">${N(bal, '枚')}</span><span class="d">交換すると 約 ${nf(Calc.medalYen(bal, st.exchX10))}円</span></div>
        <div><span class="k">本日使える枚数</span><span class="v">${N(room, '枚')}</span><span class="d">${st.dailyLimit > 0 ? `1日 ${nf(st.dailyLimit)}枚まで・本日 ${nf(usedToday)}枚使用` : '上限なし'}</span></div>
      </div>
      <section class="card"><header><h2>${esc(st.name)}の条件</h2><button class="more-link" data-act="editStore" data-id="${st.id}">編集 ›</button></header><dl class="dl">
        <div><dt>貸出<small>1,000円あたり</small></dt><dd>${N(st.lendPer1000, '枚')}</dd></div>
        <div><dt>交換<small>1,000円あたり</small></dt><dd>${N(st.exchX10, '枚')}</dd></div>
        <div><dt>貯メダルの1日の使用上限</dt><dd>${st.dailyLimit ? N(st.dailyLimit, '枚') : '<span class="muted">なし</span>'}</dd></div>
      </dl></section>
      <section class="card"><header><h2>貯メダルの明細</h2><span class="sub">${rows.length ? `直近 ${Math.min(12, rows.length)}件` : ''}</span></header>
        ${rows.length ? `<div class="list">${rows.slice(-12).reverse().map(r => { const dt = pdate(r.date); return `<button class="item" data-act="day" data-date="${r.date}">
          <span class="dt">${dt.getMonth() + 1}/${dt.getDate()}<small>${WD[dt.getDay()]}</small></span>
          <span>${r.dep ? `<span class="tt">預け入れ <span class="num pos">+${nf(r.dep)}<i>枚</i></span></span>` : ''}${r.use ? `<span class="${r.dep ? 'ss' : 'tt'}">使用 <span class="num neg">−${nf(r.use)}<i>枚</i></span></span>` : ''}</span>
          <span class="rr">${N(r.bal, '枚')}<small>残高</small></span></button>`; }).join('')}</div>` : '<p class="note">預け入れや使用を記録すると、ここに日付順で並びます。</p>'}
      </section>
      <button class="btn primary" data-act="tab" data-tab="add">実戦を記録する</button>
    </div>`;
  },

  store() {
    const d = S.sd, f = (id, label, key, ph, top) => `<label class="nf" for="${id}"${top ? ' style="border-top:1px solid var(--line)"' : ''}><span>${label}</span><span class="nfi"><input id="${id}" type="text" inputmode="numeric" pattern="[0-9]*" data-sf="${key}" value="${esc(d[key])}" placeholder="${ph}"><i>枚</i></span></label>`;
    return `<header class="sh-head"><button data-act="closeStore" aria-label="閉じる">${svg('close')}</button><h2>条件を編集</h2><span></span></header>
    <div class="sh-body">
      <section class="pcard">
        ${f('sf-lend', '貸出（1,000円あたり）', 'lend', '47')}
        ${f('sf-exch', '交換（1,000円あたり）', 'exch', '50', 1)}
        ${f('sf-limit', '貯メダルの1日の使用上限', 'limit', '470', 1)}
        ${f('sf-init', '貯メダルの初期残高', 'init', '0', 1)}
      </section>
      <p class="hint">条件を変えても、過去の記録は記録した時点の条件のまま変わりません。これから記録する実戦に新しい条件が使われます。使用上限を空欄にすると上限なしになります。</p>
      <div class="field"><span class="flabel">会員カードの画像</span>
        <div class="cardpick"><span id="sf-prev">${d.card ? `<span class="cardimg"><img src="${d.card}" alt="会員カードのプレビュー"></span>` : '<span class="cardimg ph"><span class="ph-h">未設定</span></span>'}</span>
          <label class="btn line sm" for="sf-card">画像を選ぶ</label><input id="sf-card" type="file" accept="image/*" style="position:absolute;opacity:0;width:1px;height:1px"></div></div>
      <div id="store-msg"></div>
      <button class="btn primary block" data-act="saveStore">保存する</button>
    </div>`;
  },

  audit() {
    const list = flagged().slice().sort((a, b) => (a.date < b.date ? 1 : -1)), total = db.sessions.length;
    return `<header class="sh-head"><button data-act="closeSheet" aria-label="閉じる">${svg('close')}</button><h2>収支の二重チェック</h2><span></span></header>
    <div class="sh-body">
      <div class="ledger"><div><span class="k">検算した記録</span><span class="v">${N(total, '件')}</span><span class="d">保存するたびに自動で実行</span></div><div><span class="k">確認したい記録</span><span class="v">${N(list.length, '件')}</span><span class="d">${list.length ? '下の一覧から開けます' : 'ありません'}</span></div></div>
      <section class="card"><header><h2>調べていること</h2></header><p class="note">台別の合計と1日の収支のつながり／現金投資と持ちメダル・貯メダルの二重計上／換金額と計算上の金額の差／貯メダル残高や1日上限との食い違い／投入や枚数の入れ忘れ／同じ内容の重複</p></section>
      ${list.length ? list.map(x => { const a = audits().get(x.id), dt = pdate(x.date); return `<section class="card"><header><h2>${dt.getMonth() + 1}月${dt.getDate()}日（${WD[dt.getDay()]}）</h2><button class="more-link" data-act="day" data-date="${x.date}">記録を開く ›</button></header>${a.issues.map(i => `<p class="issue ${i.level}">${esc(i.msg)}</p>`).join('')}</section>`; }).join('')
        : `<div class="empty"><b>${total ? '確認が必要な記録はありません' : 'まだ記録がありません'}</b><p>${total ? 'すべての記録で、台別の合計と1日の収支がつながっています。' : '記録を入れると、ここに結果が出ます。'}</p></div>`}
    </div>`;
  },

  backup() {
    const sh = S.sheet, has = !!mine, n = has ? mine.sessions.length : 0;
    const dates = has ? mine.sessions.map(x => x.date).sort() : [];
    return `<header class="sh-head"><button data-act="closeSheet" aria-label="閉じる">${svg('close')}</button><h2>バックアップと復元</h2><span></span></header>
    <div class="sh-body">
      <section class="card"><header><h2>書き出す</h2><span class="sub">${has ? `記録 ${n}件` : ''}</span></header>
        ${has ? `<p class="note">自分の記録${n ? `（${fmtMD(dates[0])}〜${fmtMD(dates[n - 1])}）` : ''}・機種・条件を、1つのファイルにまとめます。${store.backupAt ? `最後のバックアップ ${fmtTime(store.backupAt)}。` : ''}</p>
        <div class="grid2"><button class="btn primary sm" data-act="exportFile">ファイルに保存</button><button class="btn line sm" data-act="copyBackup">テキストをコピー</button></div>
        ${sh.text ? `<label class="field" for="bk-out"><span class="flabel">コピーできなかったときは、下を全選択してコピーしてください</span><textarea id="bk-out" class="mono" readonly rows="5">${esc(sh.text)}</textarea></label>` : ''}`
          : '<p class="note">自分の記録がまだありません。ホームの「自分の記録を始める」から始めると、ここから書き出せます。</p>'}
      </section>
      <section class="card"><header><h2>復元する</h2></header>
        <p class="note">${has ? `いまの自分の記録 ${n}件を、バックアップの内容でまるごと置き換えます。` : 'バックアップの内容を、自分の記録として読み込みます。'}サンプルには影響しません。</p>
        <label class="btn line sm" for="bk-file">バックアップのファイルを選ぶ</label><input id="bk-file" type="file" accept=".json,application/json,text/plain" style="position:absolute;opacity:0;width:1px;height:1px">
        <label class="field" for="bk-in"><span class="flabel">または、コピーしたテキストを貼り付ける</span><textarea id="bk-in" class="mono" rows="4" autocomplete="off" autocapitalize="off" spellcheck="false"></textarea></label>
        <button class="btn line sm" data-act="readPasted">貼り付けた内容を読み込む</button>
        ${sh.error ? `<p class="banner err" role="alert">${esc(sh.error)}</p>` : ''}
      </section>
    </div>`;
  },

  rules() {
    return `<header class="sh-head"><button data-act="closeSheet" aria-label="閉じる">${svg('close')}</button><h2>計算ルール</h2><span></span></header>
    <div class="sh-body rules">
      <p class="note">ここにある計算と集計のルールは、すべて確認済みです。</p>
      <div><h3>台ごと</h3><p class="f"><b>貸出枚数</b> ＝ 現金投資 ÷ 1,000 × 貸出枚数<br><b>差枚</b> ＝ 終了時の枚数 −（貸出枚数 ＋ 持ちメダル投入 ＋ 貯メダル使用）<br><b>台の収支</b> ＝（終了時の枚数 − 持ちメダル投入 − 貯メダル使用）× 1枚の交換価値 − 現金投資</p></div>
      <div><h3>1日ごと</h3><p class="f"><b>手元のメダル</b> ＝ 終了時の枚数の合計 − 持ちメダル投入の合計<br><b>換金額</b>（自動） ＝（手元 − 預け入れ）÷ 交換枚数 × 1,000円 を100円単位で切り捨て。手入力で上書き可<br><b>現金収支</b> ＝ 換金額 − 現金投資<br><b>遊技収支（メダル評価込み）</b> ＝ 現金収支 ＋（預け入れ − 貯メダル使用）× 1枚の交換価値<br><b>最終収支</b> ＝ 収支 − 経費</p></div>
      <div><h3>二重計上を防ぐ仕組み</h3><p class="f">持ちメダルや貯メダルで打った分は現金投資に入れません。台の収支を足し上げると、端数・景品差を除いて日の遊技収支と一致します。差は「端数・景品差」として日別の詳細に表示します。</p></div>
      <div><h3>集計</h3><p class="f"><b>勝敗</b> は日単位。収支が＋なら勝ち、−なら負け、0なら引き分け。経費は含めません。<br><b>勝率</b> ＝ 勝ち日数 ÷ 実戦日数（引き分けも分母に入れる）<br><b>回収率</b> ＝（現金投資 ＋ 収支）÷ 現金投資<br><b>時給</b> ＝ 遊技時間を入力した実戦の収支合計 ÷ その遊技時間の合計<br><b>機種別</b> は台の収支で集計</p></div>
      <div><h3>交換条件</h3><p class="f"><b>貸出</b> 1,000円で47枚（1枚 約21.3円）<br><b>交換</b> 50枚で1,000円（1枚 20円）<br>現金で借りたメダルは、交換するときに約6%目減りします（10,000円＝470枚 → 交換すると9,400円）。条件は記録するたびに記録側にも保存するので、あとで条件を変えても過去の収支は変わりません。</p></div>
      <div><h3>貯メダル</h3><p class="f"><b>残高</b> ＝ 初期残高 ＋ 預け入れの合計 − 使用の合計<br><b>1日の使用上限</b> 470枚。同じ日の記録を合算して判定し、超える入力は保存できません。<br><b>再プレイ手数料</b> なし（預けた枚数をそのまま使える）<br>有効期限は扱いません。</p></div>
    </div>`;
  }
};

function updateLive() {
  const d = S.draft; if (!d || S.sheet?.type !== 'entry') return;
  const s = draftSession(), c = Calc.session(s), vo = vopts();
  let avail = 0;
  d.plays.forEach((p, i) => {
    const el = $('#pres-' + i), cp = c.plays[i], sp = s.plays[i];
    if (el) el.innerHTML = (sp.cash + sp.carryIn + sp.savedIn + sp.out) ? `<span>投入 ${nf(cp.inMedals)}枚・差枚 ${Y(cp.diff, { unit: '枚' })}</span>${Y(cp.yen)}` : '<span>金額と枚数を入れると、差枚と収支を自動で計算します</span>';
    const cb = $('#carry-' + i);
    if (cb) { cb.textContent = `前の台までの ${nf(avail)}枚を全部入れる`; cb.dataset.v = avail; cb.hidden = avail <= 0; }
    avail += sp.out - sp.carryIn;
    const sb = $('#sv-' + i), sl = $('#svl-' + i);
    if (sb) {
      const others = c.savedIn - sp.savedIn, room = Math.max(0, Math.min(vo.balance - others, vo.dailyLimit > 0 ? vo.dailyLimit - vo.usedToday - others : Infinity));
      sb.textContent = `${nf(room)}枚を使う`; sb.dataset.v = room; sb.hidden = room <= 0 || sp.savedIn === room;
      sl.textContent = vo.dailyLimit > 0 ? `本日あと ${nf(Math.max(0, vo.dailyLimit - vo.usedToday - c.savedIn))}枚（1日 ${nf(vo.dailyLimit)}枚まで）` : '';
    }
  });
  $('#st-hand').innerHTML = N(Math.max(0, c.hand), '枚');
  const co = $('#f-cashOut'); if (co && !d.manual && document.activeElement !== co) co.value = fin(s.cashOut);
  $('#st-auto').hidden = !d.manual;
  $('#st-autolab').textContent = d.manual ? '手入力した金額を使っています' : '交換率から自動で計算しています';
  const ex = Math.max(0, c.exchMedals - c.leftover), tot = Math.max(1, ex + c.deposit + c.leftover);
  $('#st-bar').innerHTML = c.hand > 0 ? `<span class="x" style="width:${ex / tot * 100}%"></span><span class="s" style="width:${c.deposit / tot * 100}%"></span><span class="l" style="width:${c.leftover / tot * 100}%"></span>` : '';
  $('#st-leg').innerHTML = `<span><i class="lx"></i>換金 ${nf(ex)}枚</span><span><i class="ls"></i>貯メダル ${nf(c.deposit)}枚</span><span><i class="ll"></i>端数 ${nf(c.leftover)}枚</span>`;
  const main = S.basis === 'cash' ? c.cashResult : c.evalResult;
  $('#entry-res').innerHTML = `<span class="k">${S.basis === 'cash' ? '現金収支' : '遊技収支（メダル評価込み）'}</span><span class="v">${Y(main, { arrow: true })}</span><span class="d">${S.basis === 'cash' ? `貯メダル ${sign(c.savedDelta)}${nf(Math.abs(c.savedDelta))}枚` : `うち現金 ${sign(c.cashResult)}${nf(Math.abs(c.cashResult))}円`}</span>`;
  const a = Calc.audit(s, vopts());
  $('#entry-msgs').innerHTML = a.issues.filter(x => x.level !== 'error' || S.tried).map(x => `<p class="issue ${x.level}"${x.level === 'error' ? ' role="alert"' : ''}>${esc(x.msg)}</p>`).join('');
}

function mlistHTML() {
  const q = norm(S.picker.q || ''), cnt = new Map(Calc.byMachine(db.sessions).map(r => [r.id, r.n]));
  const list = db.machines.filter(m => !q || norm(m.name + (m.maker || '')).includes(q)).sort((a, b) => (b.fav - a.fav) || ((cnt.get(b.id) || 0) - (cnt.get(a.id) || 0)));
  const exact = db.machines.some(m => norm(m.name) === q);
  return list.map(m => `<button class="mrow" data-act="chooseMachine" data-id="${m.id}"><span><b>${esc(m.name)}</b><small>${esc([m.maker, m.type].filter(Boolean).join('・') || '分類未設定')}・${cnt.get(m.id) || 0}回</small></span>${m.fav ? '<span class="st" aria-label="お気に入り">★</span>' : ''}</button>`).join('')
    + (q && !exact ? `<button class="mrow new" data-act="newMachine"><span><b>「${esc(S.picker.q.trim())}」を新しい機種として追加</b><small>メーカーや分類はあとで設定できます</small></span></button>` : '')
    + (!list.length && !q ? '<p class="hint" style="padding:16px 0">機種がまだありません。名前を入力して追加してください。</p>' : '');
}

/* ---------- render ---------- */
let lastTab = null;
function render() {
  const sc = $('#screen'), keep = lastTab === S.tab ? sc.scrollTop : 0;
  sc.innerHTML = views[S.tab](); sc.scrollTop = keep; lastTab = S.tab;
  $('#tabbar').innerHTML = [['home', 'ホーム'], ['cal', 'カレンダー'], ['add', '記録'], ['stats', '分析'], ['more', 'その他']].map(([k, l]) =>
    k === 'add' ? `<button class="tab add" data-act="tab" data-tab="add" aria-label="実戦を記録"><span class="fab">${svg('plus')}</span></button>`
      : `<button class="tab" data-act="tab" data-tab="${k}" ${S.tab === k ? 'aria-current="page"' : ''}>${svg(k)}<span>${l}</span></button>`).join('');
  renderSheet(); renderOverlay(); persist();
}
function renderSheet() {
  persist();
  const host = $('#sheet'), old = $('.sh-body', host), keep = old && !S.enter ? old.scrollTop : 0;
  if (!S.sheet) { host.innerHTML = ''; return; }
  host.innerHTML = `<div class="sheet${S.enter ? ' enter' : ''}" role="dialog" aria-modal="true">${sheets[S.sheet.type]()}</div>`;
  S.enter = false;
  const nb = $('.sh-body', host); if (nb) nb.scrollTop = keep;
  updateLive();
}
function renderOverlay() {
  const host = $('#overlay');
  if (S.confirm) { const c = S.confirm; host.innerHTML = `<div class="ov center" data-ov="confirm"><div class="dialog" role="alertdialog" aria-modal="true"><b>${esc(c.title)}</b><p>${esc(c.msg)}</p><div class="row"><button class="btn line" data-act="cancelConfirm">やめる</button><button class="btn ${c.danger ? 'danger' : 'primary'}" data-act="${c.act}">${esc(c.ok)}</button></div></div></div>`; return; }
  if (S.picker) { host.innerHTML = `<div class="ov" data-ov="picker"><div class="panel" role="dialog" aria-modal="true"><header><h3>機種を選ぶ</h3><button data-act="closePicker" aria-label="閉じる">${svg('close')}</button></header><input class="q" id="mq" type="search" data-q placeholder="機種名・メーカーで検索、または新しい機種名" autocomplete="off" value="${esc(S.picker.q)}"><div class="mlist" id="mlist">${mlistHTML()}</div></div></div>`; return; }
  host.innerHTML = '';
}
function loadBackup(text) {
  if (S.sheet?.type !== 'backup') return;
  if (!text.trim()) { S.sheet.error = 'バックアップの内容がありません。ファイルを選ぶか、テキストを貼り付けてください。'; renderSheet(); return; }
  const r = parseBackup(text);
  if (r.error) { S.sheet.error = r.error; renderSheet(); return; }
  S.sheet.error = ''; S.incoming = r;
  const when = r.exportedAt && !isNaN(Date.parse(r.exportedAt)) ? fmtTime(Date.parse(r.exportedAt)) + ' に書き出した' : '';
  S.confirm = { title: 'このバックアップで置き換えますか？', msg: `${when}バックアップ（記録 ${r.data.sessions.length}件${r.skipped ? `・読めなかった記録 ${r.skipped}件は除外` : ''}）を読み込みます。${mine ? `いまの自分の記録 ${mine.sessions.length}件は置き換えられます。` : ''}直後なら「元に戻す」で戻せます。`, ok: '置き換える', act: 'doRestore', danger: !!(mine && mine.sessions.length) };
  renderOverlay();
}
let toastTimer;
function toast(msg, label, act) {
  $('#toast').innerHTML = `<div class="toast" role="status"><span>${esc(msg)}</span>${label ? `<button data-act="${act}">${esc(label)}</button>` : ''}</div>`;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('#toast').innerHTML = ''; }, label ? 6000 : 2200);
}
const closeSheet = () => { S.sheet = null; S.draft = null; S.picker = null; };
function applyTheme() { document.documentElement.dataset.theme = S.look === 'light' ? 'light' : 'dark'; }
function commit(force) {
  const d = S.draft, s = draftSession(); S.tried = true;
  const v = Calc.validate(s, vopts());
  if (v.errors.length) { updateLive(); const b = $('.sh-body'); b.scrollTop = b.scrollHeight; return; }
  const key = x => JSON.stringify([x.date, x.storeId, x.plays.map(p => [p.machineId, p.cash, p.savedIn, p.carryIn, p.out]), x.deposit, x.cashOut]);
  if (!d.id && !force && db.sessions.some(x => key(x) === key(s))) { S.confirm = { title: '同じ内容の記録があります', msg: '日付と台の内容がまったく同じ記録がすでにあります。重複して保存しますか？', ok: '保存する', act: 'saveForce' }; renderOverlay(); return; }
  const now = Date.now();
  if (d.id) {
    const i = db.sessions.findIndex(x => x.id === d.id), old = db.sessions[i], before = JSON.parse(JSON.stringify(old)); delete before.history;
    s.createdAt = old.createdAt || 0; s.updatedAt = now;
    s.history = Calc.diffSession(before, s).length ? (old.history || []).concat([{ at: now, before }]).slice(-20) : (old.history || []);
    db.sessions[i] = s;
  } else { s.id = uid(); s.createdAt = now; db.sessions.push(s); }
  S.confirm = null; S.cal = s.date.slice(0, 7);
  const back = S.back; closeSheet(); if (back) { S.sheet = { type: 'day', date: s.date }; }
  if (!d.id && !back) S.tab = 'home';
  S.back = null; render(); toast(d.id ? '変更を保存しました' : '記録を保存しました');
}

/* ---------- actions ---------- */
const A = {
  tab(el) { if (el.dataset.tab === 'add') { S.back = null; return openEntry(); } closeSheet(); S.tab = el.dataset.tab; if (S.tab === 'cal') S.cal = S.cal || TODAY().slice(0, 7); render(); },
  period(el) { S.period = el.dataset.p; render(); },
  theme(el) { S.look = el.dataset.t; applyTheme(); render(); },
  calMove(el) { if (el.disabled) return; S.cal = addMonth(S.cal, +el.dataset.k); render(); },
  day(el) { S.sheet = { type: 'day', date: el.dataset.date }; S.enter = true; renderSheet(); },
  toggleHist(el) { S.sheet.hist = S.sheet.hist === el.dataset.id ? null : el.dataset.id; renderSheet(); },
  auditSheet() { S.sheet = { type: 'audit' }; S.enter = true; renderSheet(); },
  newOn(el) { S.back = S.sheet?.type === 'day'; openEntry({ date: el.dataset.date }); },
  editRec(el) { S.back = true; openEntry({ id: el.dataset.id }); },
  copyRec(el) { S.back = false; openEntry({ id: el.dataset.id, copy: true }); toast('機種を引き継いで新しい記録を作成します'); },
  closeSheet() { const back = S.sheet?.type === 'entry' && S.back && S.draft ? S.draft.date : null; closeSheet(); S.back = null; if (back && db.sessions.some(s => s.date === back)) S.sheet = { type: 'day', date: back }; render(); },
  rules() { S.sheet = { type: 'rules' }; S.enter = true; renderSheet(); },
  addPlay() { S.draft.plays.push(blankPlay()); renderSheet(); const b = $('.sh-body'), card = b.querySelectorAll('.pcard')[S.draft.plays.length - 1]; if (card) { const k = b.offsetHeight / (b.getBoundingClientRect().height || 1); b.scrollTop += (card.getBoundingClientRect().top - b.getBoundingClientRect().top) * k - 12; } },
  delPlay(el) { S.draft.plays.splice(+el.dataset.i, 1); renderSheet(); },
  moreFields() { S.draft.more = true; renderSheet(); },
  cashAdd(el) { const p = S.draft.plays[+el.dataset.i]; p.cash = Math.min(9999999, Calc.n(p.cash) + +el.dataset.v); $(`#f-p-${el.dataset.i}-cash`).value = fin(p.cash); updateLive(); },
  savedMax(el) { const p = S.draft.plays[+el.dataset.i]; p.savedIn = +el.dataset.v; $(`#f-p-${el.dataset.i}-savedIn`).value = fin(p.savedIn); updateLive(); },
  carryAll(el) { const p = S.draft.plays[+el.dataset.i]; p.carryIn = +el.dataset.v; $(`#f-p-${el.dataset.i}-carryIn`).value = fin(p.carryIn); updateLive(); },
  depSet(el) { const d = S.draft, hand = d.plays.reduce((a, p) => a + Calc.n(p.out) - Calc.n(p.carryIn), 0); d.deposit = el.dataset.v === 'all' ? Math.max(0, hand) : 0; $('#f-deposit').value = fin(d.deposit); updateLive(); },
  cashAuto() { S.draft.manual = false; updateLive(); },
  pickMachine(el) { S.picker = { i: +el.dataset.i, q: '' }; renderOverlay(); },
  closePicker() { S.picker = null; renderOverlay(); },
  chooseMachine(el) { S.draft.plays[S.picker.i].machineId = el.dataset.id; S.picker = null; renderOverlay(); renderSheet(); },
  newMachine() { const name = S.picker.q.trim(); if (!name) return; let m = db.machines.find(x => norm(x.name) === norm(name)); if (!m) { m = { id: uid(), name, maker: '', type: '', fav: false }; db.machines.push(m); } S.draft.plays[S.picker.i].machineId = m.id; S.picker = null; renderOverlay(); renderSheet(); toast(`「${name}」を追加しました`); },
  fav(el) { const m = machineOf(el.dataset.id); m.fav = !m.fav; render(); },
  save() { commit(false); },
  saveForce() { commit(true); },
  cancelConfirm() { S.confirm = null; renderOverlay(); },
  askDel(el) { S.confirm = { title: 'この記録を削除しますか？', msg: '削除した直後なら「元に戻す」で復元できます。', ok: '削除する', act: 'doDel', danger: true, id: el.dataset.id }; renderOverlay(); },
  doDel() { const t = db, i = t.sessions.findIndex(x => x.id === S.confirm.id); const [gone] = t.sessions.splice(i, 1); S.undo = () => { t.sessions.splice(i, 0, gone); }; S.confirm = null; if (S.sheet?.type === 'day' && !db.sessions.some(x => x.date === S.sheet.date)) S.sheet = null; render(); toast('記録を削除しました', '元に戻す', 'undo'); },
  undo() { if (!S.undo) return; S.undo(); S.undo = null; render(); toast('元に戻しました'); },
  editStore(el) { const s = storeOf(el.dataset.id) || mainStore(); S.sd = { id: s.id, lend: String(s.lendPer1000), exch: String(s.exchX10), limit: String(s.dailyLimit || ''), init: String(s.initSaved || ''), card: s.card || '' }; S.prevSheet = S.sheet; S.sheet = { type: 'store' }; S.enter = true; renderSheet(); },
  storeView(el) { S.sheet = { type: 'storeView', id: el.dataset.id }; S.enter = true; renderSheet(); },
  closeStore() { S.sheet = S.prevSheet || null; S.prevSheet = null; S.sd = null; S.enter = false; render(); },
  saveStore() {
    const d = S.sd, lend = parseInt(d.lend, 10), exch = parseInt(d.exch, 10), errs = [];
    if (!(lend >= 1 && lend <= 250) || String(lend) !== d.lend.trim()) errs.push('貸出枚数は1〜250の整数で入力してください');
    if (!(exch >= 10 && exch <= 500) || String(exch) !== d.exch.trim()) errs.push('交換枚数は10〜500の整数で入力してください（例：50枚で1,000円なら 50）');
    if (errs.length) { $('#store-msg').innerHTML = errs.map(e => `<p class="banner err" role="alert" style="margin-bottom:8px">${esc(e)}</p>`).join(''); return; }
    Object.assign(storeOf(d.id), { lendPer1000: lend, exchX10: exch, dailyLimit: Calc.n(d.limit), initSaved: Calc.n(d.init), card: d.card });
    A.closeStore(); toast('条件を保存しました');
  },
  askMine() { S.confirm = { title: '自分の記録を始めますか？', msg: 'サンプルとは別に、空の状態から記録を始めます。記録はこの端末（このブラウザ）に保存されます。サンプルは「その他」からいつでも見られます。', ok: '始める', act: 'useMine' }; renderOverlay(); },
  useMine() { const first = !mine; if (first) mine = newMine(); try { navigator.storage && navigator.storage.persist && navigator.storage.persist().catch(() => {}); } catch (_) {} db = mine; S.mode = 'mine'; S.confirm = null; S.undo = null; closeSheet(); if (first) S.tab = 'home'; S.cal = TODAY().slice(0, 7); render(); toast(first ? '自分の記録を作成しました' : '自分の記録を表示しています'); },
  useSample() { if (S.mode === 'sample') return; sample = sample || sampleDB(); db = sample; S.mode = 'sample'; S.undo = null; closeSheet(); S.cal = TODAY().slice(0, 7); render(); toast('サンプルを表示しています'); },
  askReset() { S.confirm = { title: 'サンプルを最初の状態に戻しますか？', msg: 'サンプルの記録・機種・条件を作り直します。自分の記録には影響しません。', ok: '戻す', act: 'doReset' }; renderOverlay(); },
  doReset() { sample = sampleDB(); db = sample; S.mode = 'sample'; S.confirm = null; S.undo = null; closeSheet(); S.cal = TODAY().slice(0, 7); render(); toast('サンプルを最初の状態に戻しました'); },
  askClear() { S.confirm = { title: 'サンプルの記録を空にしますか？', msg: '記録が0件のときの表示を確認できます。自分の記録には影響しません。', ok: '空にする', act: 'doClear' }; renderOverlay(); },
  doClear() { sample = sample || sampleDB(); sample.sessions = []; db = sample; S.mode = 'sample'; S.confirm = null; S.undo = null; closeSheet(); render(); toast('サンプルを空にしました'); },
  askWipe() { if (S.mode !== 'mine') return; S.confirm = { title: `自分の記録 ${mine.sessions.length}件をすべて消しますか？`, msg: '実戦の記録をすべて削除します。機種と条件は残ります。消した直後なら「元に戻す」で復元できますが、ページを閉じると戻せません。', ok: 'すべて消す', act: 'doWipe', danger: true }; renderOverlay(); },
  doWipe() { if (S.mode !== 'mine') return; const m = mine, prev = m.sessions; m.sessions = []; S.undo = () => { m.sessions = prev; }; S.confirm = null; closeSheet(); render(); toast('自分の記録を消しました', '元に戻す', 'undo'); },
  backup() { S.sheet = { type: 'backup', text: '', error: '' }; S.enter = true; renderSheet(); },
  exportFile() {
    if (!mine) return; const text = backupText(), name = backupName();
    const manual = () => { const a = document.createElement('a'), url = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000); markBackup('書き出しを始めました。保存されないときは「テキストをコピー」を使ってください'); };
    if (DL) { DL.save({ filename: name, data: text }).then(() => markBackup('バックアップを書き出しました'), e => toast(e && e.code === 'declined' ? '書き出しを取り消しました' : 'ファイルに保存できませんでした。「テキストをコピー」を使ってください')); return; }
    try { const f = new File([text], name, { type: 'application/json' }); if (navigator.canShare && navigator.canShare({ files: [f] })) { navigator.share({ files: [f] }).then(() => markBackup('バックアップを書き出しました'), e => { if (!e || e.name !== 'AbortError') manual(); }); return; } } catch (_) {}
    manual();
  },
  copyBackup() {
    if (!mine) return; const text = backupText(), show = () => { S.sheet.text = text; renderSheet(); const t = $('#bk-out'); if (t) { t.focus(); t.select(); } };
    try { navigator.clipboard.writeText(text).then(() => markBackup('バックアップをコピーしました。メモなどに貼り付けて保管してください'), show); } catch (_) { show(); }
  },
  readPasted() { loadBackup(($('#bk-in') || {}).value || ''); },
  doRestore() {
    const inc = S.incoming; if (!inc) return; const prev = { mine, mode: S.mode, budget: S.budget };
    mine = inc.data; db = mine; S.mode = 'mine'; if (inc.budget) S.budget = inc.budget; S.incoming = null; S.confirm = null;
    S.undo = () => { mine = prev.mine; S.mode = prev.mine && prev.mode === 'mine' ? 'mine' : 'sample'; S.budget = prev.budget; if (S.mode === 'mine') db = mine; else { sample = sample || sampleDB(); db = sample; } };
    closeSheet(); S.tab = 'home'; S.cal = TODAY().slice(0, 7); render(); toast(`記録 ${mine.sessions.length}件を復元しました`, '元に戻す', 'undo');
  }
};

document.addEventListener('click', e => {
  const ov = e.target.dataset?.ov;
  if (ov === 'picker') return A.closePicker();
  if (ov === 'confirm') return A.cancelConfirm();
  const el = e.target.closest('[data-act]'); if (!el) return;
  const fn = A[el.dataset.act]; if (fn) fn(el, e);
});
const digits = v => v.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/[^\d]/g, '').slice(0, 7);
document.addEventListener('input', e => {
  const el = e.target, d = S.draft;
  if (el.dataset.f && d) {
    const f = el.dataset.f;
    if (f === 'date') { if (el.value) d.date = el.value; updateLive(); return; }
    if (f === 'memo') { d.memo = el.value; return; }
    const v = digits(el.value); if (v !== el.value) el.value = v;
    const num = v === '' ? 0 : parseInt(v, 10);
    if (f.startsWith('p.')) { const [, i, k] = f.split('.'); d.plays[+i][k] = num; } else { d[f] = num; if (f === 'cashOut') d.manual = v !== ''; }
    updateLive();
  } else if (el.dataset.q != null && S.picker) { S.picker.q = el.value; $('#mlist').innerHTML = mlistHTML(); }
  else if (el.dataset.sf && S.sd) { const v = digits(el.value); if (v !== el.value) el.value = v; S.sd[el.dataset.sf] = v; }
  else if (el.id === 'f-budget') { const v = digits(el.value); if (v !== el.value) el.value = v; S.budget = v === '' ? 0 : parseInt(v, 10); }
});
document.addEventListener('change', e => {
  if (e.target.id === 'f-budget') render();
  if (e.target.id === 'bk-file' && e.target.files[0]) { const fr = new FileReader(); fr.onload = () => loadBackup(String(fr.result || '')); fr.onerror = () => { if (S.sheet?.type === 'backup') { S.sheet.error = 'ファイルを読み込めませんでした。'; renderSheet(); } }; fr.readAsText(e.target.files[0]); }
  if (e.target.id === 'sf-card' && e.target.files[0] && S.sd) {
    const fr = new FileReader();
    fr.onload = () => { const im = new Image(); im.onload = () => {
      const k = Math.min(1, 900 / im.width), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      if (S.sd) { S.sd.card = c.toDataURL('image/jpeg', 0.82); const pv = $('#sf-prev'); if (pv) pv.innerHTML = `<span class="cardimg"><img src="${S.sd.card}" alt="会員カードのプレビュー"></span>`; }
    }; im.onerror = () => toast('画像を読み込めませんでした。別の画像を選んでください'); im.src = fr.result; };
    fr.readAsDataURL(e.target.files[0]);
  }
});
document.addEventListener('focusin', e => { if (e.target.dataset?.num != null) { const el = e.target, v = digits(el.value); if (v !== el.value) el.value = v; if (v) setTimeout(() => { try { if (document.activeElement === el) el.setSelectionRange(0, el.value.length); } catch (_) {} }, 0); }
  if (matchMedia('(max-width:860px)').matches && e.target.matches('.sh-body input,.sh-body textarea')) setTimeout(() => e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 280); });
document.addEventListener('focusout', e => { if (e.target.dataset?.num != null) e.target.value = fin(digits(e.target.value)); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (S.confirm) A.cancelConfirm(); else if (S.picker) A.closePicker(); else if (S.sheet?.type === 'store') A.closeStore(); else if (S.sheet) A.closeSheet(); } });

/* ---------- boot ---------- */
function fit() { const w = $('.device-wrap'); if (matchMedia('(max-width:860px)').matches) w.style.removeProperty('--s'); else w.style.setProperty('--s', Math.max(0.55, Math.min(1, (innerHeight - 48) / 894)).toFixed(3)); }
function tick() { const d = new Date(); $('#clock').textContent = `${d.getHours()}:${pad(d.getMinutes())}`; }
function start(data) {
  const saved = restore(), keep = (data && data.S) || {};
  S = Object.assign({ tab: 'home', period: 'all', cal: TODAY().slice(0, 7) }, keep, { basis: 'eval', mode: 'sample', budget: 80000, look: 'dark' },
    saved ? { mode: saved.mode === 'mine' && saved.mine ? 'mine' : 'sample', budget: Calc.n(saved.settings?.budget) || 80000, look: saved.settings?.look2 === 'light' ? 'light' : 'dark' } : {},
    { sheet: null, draft: null, picker: null, confirm: null, sd: null, undo: null, back: null, tried: false, enter: false });
  mine = saved ? saved.mine : null;
  if (S.mode === 'mine') db = mine; else { sample = sampleDB(); db = sample; }
  applyTheme(); fit(); tick(); render();
  if (store.broken) toast('保存データを読み込めなかったため、サンプルを表示しています');
}
addEventListener('resize', fit); setInterval(tick, 20000);
addEventListener('pagehide', () => { if (S) persist(); });
try { window.claude?.hot?.snapshot?.(() => ({ S: { tab: S.tab, period: S.period, cal: S.cal } })); } catch (_) {}
if (window.claude?.hot?.ready) window.claude.hot.ready(start); else start(window.claude?.hot?.data ?? {});
window.__demo = { get db() { return db; }, get S() { return S; }, get mine() { return mine; }, get store() { return store; }, KEY, backupText, parseBackup };
})();
