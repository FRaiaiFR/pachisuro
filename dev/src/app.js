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
let db, S, mine = null;   // mine が記録の本体。db はその別名（画面の表示に使う）
const storeOf = id => db.stores.find(s => s.id === id);
const machineOf = id => db.machines.find(m => m.id === id);
const inMonth = m => db.sessions.filter(s => s.date.startsWith(m));
const mainStore = () => db.stores.find(s => s.main) || db.stores[0];
const blankPlay = () => ({ machineId: '', cash: 0, savedIn: 0, carryIn: 0, out: 0, minutes: 0 });


/* ---------- 端末内保存 ---------- */
const KEY = 'dx7-shushi.v1';
const store = { ok: true, last: '', savedAt: 0, backupAt: 0 };
function newMine() {
  return {
    stores: [{ id: 's1', name: 'デラックスセブン', lendPer1000: 47, exchX10: 50, dailyLimit: 470, initSaved: 0, main: true, card: typeof CARD_MAIN === 'string' ? CARD_MAIN : '' }],
    machines: Catalog.LIST.filter(e => /^m[1-6]$/.test(e.id)).map(e => ({ id: e.id, name: e.name, maker: e.maker, type: e.type, fav: false })), sessions: []
  };
}
function pack() {   // 同梱のカード画像は保存データに含めない（容量の節約）
  const m = mine && { ...mine, stores: mine.stores.map(st => (st.card === CARD_MAIN ? { ...st, card: '', cardDefault: true } : st)) };
  return JSON.stringify({ v: 1, settings: { budget: S.budget }, mine: m });
}
function persist() {
  stamp++;
  if (!store.ok) return;
  const body = pack(); if (body === store.last) return;
  try { const t = Date.now(); localStorage.setItem(KEY, JSON.stringify({ savedAt: t, backupAt: store.backupAt, body })); store.last = body; store.savedAt = t; }
  catch (_) { store.ok = false; return; }
  if (sy.uid) { paintSync(); if (pendingLocal()) scheduleSync(1500); }
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

/* ---------- クラウド同期（Firebase） ----------
   端末の中の保存が主で、クラウドにはその写しを置く。どちらを残すかの計算は merge.js。
   通信は Firebase の通信口を直接呼ぶ（ログイン＝Identity Toolkit、置き場所＝Firestore の1文書 users/{uid}/dx7/main）。
   書き込むときは「読んだ時点から変わっていなければ」という条件を付け、変わっていたら読み直して合わせ直す。 */
const CLOUD = { apiKey: 'AIzaSyCjAvsr4AHM8LdULAgbxKUXdtpcbbRjJRE', projectId: 'tabearuki-c5c7b' };   // 接続用の値（公開されて問題ないもの）。守りは Firebase 側のルール
const EP = Object.assign({ auth: 'https://identitytoolkit.googleapis.com/v1', token: 'https://securetoken.googleapis.com/v1', store: 'https://firestore.googleapis.com/v1' }, window.__DX7_SYNC || {});
const CAN_SYNC = !!document.querySelector('link[rel="manifest"]');   // 公開ページでだけ使う（プレビュー用のページからは外へ通信できない）
const SKEY = 'dx7-shushi.sync.v1', SAFE = 'dx7-shushi.before-sync.v1', DOC_LIMIT = 900000, STORE_KEYS = ['lendPer1000', 'exchX10', 'dailyLimit', 'initSaved'];
let sy = { uid: '', email: '', refresh: '', id: '', exp: 0, base: null, baseUid: '', at: 0, err: '', bytes: 0 };
let syBusy = false, syAgain = false, syTimer = 0, syFail = 0, syMemo = { key: null, base: null, pending: false };
function loadSy() { try { const o = JSON.parse(localStorage.getItem(SKEY) || 'null'); if (o && typeof o === 'object') Object.assign(sy, o); } catch (_) {} }
function saveSy() { try { localStorage.setItem(SKEY, JSON.stringify(sy)); } catch (_) {} }
const cloudErr = code => Object.assign(new Error(code), { code });
const bytesOf = s => new TextEncoder().encode(s).length;
async function call(url, opt, auth) {
  let res; try { res = await fetch(url, opt); } catch (_) { throw cloudErr('NETWORK'); }
  let j = null; try { j = await res.json(); } catch (_) {}
  if (!res.ok) { const e = (j && j.error) || {}, word = String(e.message || '').split(/[ :]/)[0], isCode = /^[A-Z_]{4,}$/.test(word); throw cloudErr((auth && isCode ? word : e.status || (isCode ? word : '')) || 'HTTP_' + res.status); }
  return j || {};
}
const authPost = (op, body) => call(`${EP.auth}/accounts:${op}?key=${CLOUD.apiKey}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }, true);
function setSession(j) { if (sy.baseUid !== j.localId) sy.base = null; sy.uid = j.localId; sy.email = j.email || sy.email; sy.refresh = j.refreshToken; sy.id = j.idToken; sy.exp = Date.now() + Calc.n(j.expiresIn) * 1000; sy.err = ''; saveSy(); }
async function idToken() {
  if (sy.id && Date.now() < sy.exp - 60000) return sy.id;
  let j; try { j = await call(`${EP.token}/token?key=${CLOUD.apiKey}`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(sy.refresh) }, true); }
  catch (e) { throw ['TOKEN_EXPIRED', 'USER_DISABLED', 'USER_NOT_FOUND', 'INVALID_REFRESH_TOKEN', 'MISSING_REFRESH_TOKEN', 'INVALID_GRANT_TYPE'].includes(e.code) ? cloudErr('RELOGIN') : e; }
  sy.id = j.id_token; sy.refresh = j.refresh_token || sy.refresh; sy.exp = Date.now() + Calc.n(j.expires_in) * 1000; saveSy(); return sy.id;
}
const docUrl = () => `${EP.store}/projects/${CLOUD.projectId}/databases/(default)/documents/users/${sy.uid}/dx7/main`;
async function getDoc(tok) {
  try { const j = await call(docUrl(), { headers: { authorization: 'Bearer ' + tok } }); return { exists: true, body: (j.fields && j.fields.body && j.fields.body.stringValue) || '', updateTime: j.updateTime }; }
  catch (e) { if (e.code === 'NOT_FOUND') return { exists: false }; throw e; }
}
function putDoc(tok, body, prev, n) {
  const q = prev.exists ? 'currentDocument.updateTime=' + encodeURIComponent(prev.updateTime) : 'currentDocument.exists=false';
  return call(docUrl() + '?' + q, { method: 'PATCH', headers: { authorization: 'Bearer ' + tok, 'content-type': 'application/json' },
    body: JSON.stringify({ fields: { v: { integerValue: '1' }, body: { stringValue: body }, at: { integerValue: String(Date.now()) }, n: { integerValue: String(n) } } }) });
}
// 同期の対象（記録・機種・条件・上限額）。見た目やカード画像、入力途中の下書きは含めない
const localState = () => ({ v: 1, sessions: mine.sessions, machines: mine.machines, store: Object.fromEntries(STORE_KEYS.map(k => [k, Calc.n(mine.stores[0][k])])), budget: S.budget });
function parseRemote(text) {
  let o; try { o = JSON.parse(text); } catch (_) { throw cloudErr('BAD_REMOTE'); }
  if (!o || o.v !== 1 || !Array.isArray(o.sessions) || !Array.isArray(o.machines)) throw cloudErr('BAD_REMOTE');
  if (o.sessions.some(x => !x || typeof x.id !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x.date) || !Array.isArray(x.plays) || !x.plays.length) || o.machines.some(m => !m || typeof m.id !== 'string' || typeof m.name !== 'string')) throw cloudErr('BAD_REMOTE');
  return { v: 1, sessions: o.sessions, machines: o.machines, store: o.store && typeof o.store === 'object' ? Object.fromEntries(STORE_KEYS.map(k => [k, Calc.n(o.store[k])])) : null, budget: o.budget == null ? null : Calc.n(o.budget) };
}
function applyState(st) { mine.sessions = st.sessions; mine.machines = st.machines; if (st.store && st.store.lendPer1000 > 0 && st.store.exchX10 > 0) Object.assign(mine.stores[0], st.store); if (st.budget != null) S.budget = st.budget; }
function countDiff(a, b) { const m = new Map(a.map(x => [x.id, Merge.fp(x)])); let n = 0; for (const x of b) { if (m.get(x.id) !== Merge.fp(x)) n++; m.delete(x.id); } return n + m.size; }
async function syncOnce() {
  for (let i = 0; i < 6; i++) {
    const tok = await idToken();
    let cur; try { cur = await getDoc(tok); } catch (e) { if (e.code === 'UNAUTHENTICATED' && i < 2) { sy.exp = 0; continue; } throw e; }
    const remote = cur.exists ? parseRemote(cur.body) : null;
    const before = localState(), beforeFp = Merge.fp(before);
    const m = Merge.merge(before, remote, cur.exists && sy.baseUid === sy.uid ? sy.base : null);
    let bytes = cur.exists ? bytesOf(cur.body) : 0;
    if (!remote || !Merge.same(m.state, remote)) {
      const text = JSON.stringify(m.state); bytes = bytesOf(text); if (bytes > DOC_LIMIT) throw cloudErr('TOO_BIG');
      try { await putDoc(tok, text, cur, m.state.sessions.length); }
      catch (e) { if (['FAILED_PRECONDITION', 'ALREADY_EXISTS', 'ABORTED', 'NOT_FOUND'].includes(e.code)) continue; if (e.code === 'UNAUTHENTICATED' && i < 2) { sy.exp = 0; continue; } throw e; }   // ほかの端末が先に書いていた → 読み直して合わせ直す
    }
    if (!mine || Merge.fp(localState()) !== beforeFp) continue;      // 通信している間にこの端末で変更があった → 合わせ直す
    let changed = 0;
    if (!Merge.same(m.state, before)) { changed = countDiff(before.sessions, m.state.sessions); try { localStorage.setItem(SAFE, JSON.stringify({ at: Date.now(), state: before })); } catch (_) {} applyState(m.state); }
    sy.base = Merge.snapshot(m.state); sy.baseUid = sy.uid; sy.at = Date.now(); sy.bytes = bytes; sy.err = ''; saveSy();
    return { changed, other: !Merge.same(m.state, before) };
  }
  throw cloudErr('BUSY');
}
const typing = () => /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName || '');
function paintSync() { document.querySelectorAll('#app [data-pill]').forEach(el => { el.outerHTML = modePill(); }); if (S.sheet?.type === 'sync' && !typing()) renderSheet(); }
async function syncNow(manual) {
  if (!CAN_SYNC || !sy.uid || !mine) return;
  if (syBusy) { syAgain = true; return; }
  clearTimeout(syTimer); syBusy = true; paintSync();
  let r = null;
  try { r = await syncOnce(); syFail = 0; }
  catch (e) { sy.err = e.code || 'UNKNOWN'; if (sy.err === 'RELOGIN') { sy.uid = ''; sy.id = ''; sy.refresh = ''; sy.exp = 0; } saveSy(); syFail++; }
  syBusy = false;
  if (r && r.other) {            // ほかの端末の変更が入った。入力中なら画面は描き直さず、データだけ入れ替える
    if (S.sheet?.type === 'day' && !db.sessions.some(x => x.date === S.sheet.date)) S.sheet = null;
    if (typing()) persist(); else render();
  }
  paintSync();
  if (syAgain) { syAgain = false; scheduleSync(300); }
  else if (sy.err && sy.uid && !['PERMISSION_DENIED', 'TOO_BIG', 'BAD_REMOTE'].includes(sy.err)) scheduleSync(Math.min(600000, 30000 * 4 ** Math.min(4, syFail - 1)));   // 30秒 → 2分 → 8分 → 10分おきにやり直す
}
function scheduleSync(ms) { if (!CAN_SYNC || !sy.uid) return; clearTimeout(syTimer); syTimer = setTimeout(() => syncNow(false), ms); }
function pendingLocal() {      // この端末に、まだクラウドへ送っていない変更があるか
  if (!sy.uid || !mine) return false;
  if (syMemo.key !== store.last || syMemo.base !== sy.base) syMemo = { key: store.last, base: sy.base, pending: !sy.base || !Merge.same(Merge.snapshot(localState()), sy.base) };
  return syMemo.pending;
}
const syncState = () => (!sy.uid ? (sy.err === 'RELOGIN' ? 'err' : 'off') : syBusy ? 'busy' : sy.err && sy.err !== 'NETWORK' ? 'err' : pendingLocal() ? 'pending' : 'ok');
const SY_LABEL = { busy: '同期中', err: '同期できません', pending: '未送信あり', ok: '同期済み' };
function cloudMsg(code) {
  return ({
    NETWORK: '通信できませんでした。つながったら自動で同期します。',
    PERMISSION_DENIED: 'クラウド側で読み書きが許可されていません。Firebase のルールに dx7 の行が入っているか確認してください。',
    RELOGIN: 'ログインの有効期限が切れました。もう一度ログインしてください。',
    TOO_BIG: '記録の量がクラウドの上限（約1MB）に近づいたため、同期を止めています。この端末の記録はそのまま残っています。',
    BAD_REMOTE: 'クラウドのデータを読み取れませんでした。この端末の記録は変更していません。',
    BUSY: 'ほかの端末と書き込みが重なりました。少し待ってから、もう一度同期してください。',
    EMAIL_EXISTS: 'このメールアドレスは登録済みです。「ログイン」を押してください。食べ歩きアプリの Google ログインで使っているアドレスの場合は、「パスワードを忘れたとき」でパスワードを決めるとログインできます。',
    INVALID_LOGIN_CREDENTIALS: 'メールアドレスかパスワードが違います。', INVALID_PASSWORD: 'メールアドレスかパスワードが違います。', EMAIL_NOT_FOUND: 'メールアドレスかパスワードが違います。',
    WEAK_PASSWORD: 'パスワードは6文字以上にしてください。', INVALID_EMAIL: 'メールアドレスの形を確認してください。', MISSING_EMAIL: 'メールアドレスを入力してください。', MISSING_PASSWORD: 'パスワードを入力してください。',
    OPERATION_NOT_ALLOWED: 'メール／パスワードでのログインが、Firebase 側でまだ有効になっていません。', PASSWORD_LOGIN_DISABLED: 'メール／パスワードでのログインが、Firebase 側でまだ有効になっていません。',
    ADMIN_ONLY_OPERATION: '新しい登録は止めてあります。登録済みのメールアドレスでログインしてください。',
    TOO_MANY_ATTEMPTS_TRY_LATER: '試行回数が多すぎます。しばらく待ってからやり直してください。', USER_DISABLED: 'このアカウントは停止されています。'
  })[code] || `同期できませんでした（${code}）。`;
}

/* ---------- バックアップ（手動で書き出し・復元） ---------- */
let DL = null;   // プレビュー用のページ上でのファイル保存の窓口（無い環境では null のまま）
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
  for (const m of d.machines) { if (!m || !str(m.id) || !str(m.name) || mids.has(m.id)) continue; mids.add(m.id); machines.push({ id: m.id, name: m.name.slice(0, 60), maker: str(m.maker).slice(0, 40), type: str(m.type).slice(0, 40), fav: !!m.fav, ...(m.gone ? { gone: true } : {}) }); }
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
function markBackup(msg) { store.backupAt = Date.now(); store.last = ''; persist(); if (S.sheet?.type === 'backup') { S.sheet.info = msg; S.sheet.error = ''; renderSheet(); } else render(); }

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
const topRight = () => `<span class="top-r">${modePill()}</span>`;
function modePill() {
  const k = syncState(); if (k !== 'off') return `<button class="pill${k === 'err' ? ' neg' : k === 'pending' ? ' warn' : ''}" data-pill data-act="syncSheet">${SY_LABEL[k]}</button>`;
  return store.ok ? '<span class="pill" data-pill>この端末に保存</span>' : '<span class="pill neg" data-pill>保存できません</span>';
}

/* ---------- views ---------- */
const views = {
  home() {
    const t = TODAY(), m = t.slice(0, 7), dt = pdate(t), B = S.basis;
    const head = `<header class="top"><div><p class="eyebrow">${dt.getFullYear()}年${dt.getMonth() + 1}月${dt.getDate()}日（${WD[dt.getDay()]}）</p><h1>ホーム</h1></div>${topRight()}</header>`;
    const saveBar = (store.ok ? '' : '<p class="banner err">このブラウザでは記録を保存できません。プライベートブラウズを解除するか、別のブラウザで開いてください。</p>')
      + (store.broken ? '<p class="banner err" id="broken-note">保存データを読み込めなかったため、空の状態で開いています。読めなかったデータは消さずに残してあります。</p>' : '');
    if (!db.sessions.length) return head + memberBlock() + saveBar + draftBar() + `<div class="empty"><b>まだ記録がありません</b><p>実戦を記録すると、今月の収支・貯メダル残高・推移がここに並びます。</p><button class="btn primary" data-act="tab" data-tab="add">最初の実戦を記録する</button><button class="btn line" data-act="editStore" data-id="${mainStore().id}">いまの貯メダル残高を登録する</button></div>`;
    const all = Calc.stats(db.sessions, B), mon = Calc.stats(inMonth(m), B), prev = Calc.stats(inMonth(addMonth(m, -1)), B), td = Calc.stats(db.sessions.filter(s => s.date === t), B);
    const use = S.budget > 0 ? mon.cash / S.budget : 0, left = S.budget - mon.cash;
    const recent = all.days.slice(-5).reverse();
    const nf2 = flagged().length, auditBar = nf2 ? `<button class="banner tap" data-act="auditSheet">二重チェックで確認したい記録が ${nf2}件あります。<b>内容を見る ›</b></button>` : '';
    return head + memberBlock() + saveBar + draftBar() + auditBar + `
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
    <section class="card"><header><h2>記録の保存</h2><span class="sub">${db.sessions.length}件</span></header>
      <p class="note">${store.ok ? `この端末（このブラウザ）に保存しています${store.savedAt ? `。最終保存 ${fmtTime(store.savedAt)}` : ''}。` : 'このブラウザでは保存できません。'}</p>
      <div class="grid2"><button class="btn line sm" data-act="backup">バックアップと復元</button><button class="btn danger sm" data-act="askWipe">すべて消す</button></div>
      <p class="note">${store.backupAt ? `最後のバックアップ ${fmtTime(store.backupAt)}。` : 'まだバックアップしていません。'}${sy.uid ? 'クラウドにも保存していますが、念のため、ときどき書き出しておくと安心です。' : '端末の中だけに保存しているので、機種変更や故障に備えて、ときどき書き出してください。'}</p>
      <p class="note">${sy.uid ? 'ブラウザのデータを消しても、同じメールアドレスでログインし直せば記録は戻ります。' : 'ブラウザのデータを消すと、記録も消えます。下の「同期」でログインしておくと、クラウドにも残ります。'}</p></section>
    <section class="card"><header><h2>同期</h2><span class="sub">${sy.uid ? esc(sy.email) : ''}</span></header>
      <p class="note">${sy.uid ? `クラウドにも保存しています。${sy.at ? `最後の同期 ${fmtTime(sy.at)}。` : ''}${sy.err ? esc(cloudMsg(sy.err)) : pendingLocal() ? 'まだ送っていない変更があります。' : ''}` : sy.err === 'RELOGIN' ? esc(cloudMsg('RELOGIN')) : 'ログインすると、記録をクラウドにも保存します。iPhone が壊れても、別の端末でログインすれば同じ記録が戻ります。'}</p>
      <button class="btn line sm" data-act="syncSheet">${sy.uid ? '同期の状態を見る' : 'ログインして同期する'}</button></section>
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
    <section class="card"><header><h2>機種</h2><span class="sub">★はお気に入り・✕で一覧から削除</span></header>
      <div class="list">${db.machines.filter(mc => !mc.gone).map(mc => { const r = mach.get(mc.id); return `<div class="item" style="grid-template-columns:auto minmax(0,1fr) auto auto"><button data-act="fav" data-id="${mc.id}" aria-label="${esc(mc.name)}をお気に入り${mc.fav ? 'から外す' : 'に追加'}" aria-pressed="${mc.fav}" style="width:36px;height:44px;font-size:18px;color:${mc.fav ? 'var(--gold)' : 'var(--fg-3)'}">${mc.fav ? '★' : '☆'}</button><span><span class="tt">${esc(mc.name)}</span><span class="ss">${esc([mc.maker, mc.type].filter(Boolean).join('・') || '分類未設定')}</span></span><span class="rr">${r ? Y(r.yen) : '<span class="muted">—</span>'}<small>${r ? r.n : 0}回</small></span><button class="xbtn" data-act="askDelMachine" data-id="${mc.id}" aria-label="${esc(mc.name)}を一覧から削除">${svg('close')}</button></div>`; }).join('')}</div></section>
`;
  }
};

/* ---------- 入力途中の自動保存 ----------
   入力画面の内容を、変わるたびに端末へ書いておく。アプリが閉じられても、次に開いたとき続きから入力できる。
   新しい記録の下書き（DKEY）は「閉じる」を押しても残す。既存の記録の編集中（EKEY）は、閉じたら取り消し。 */
const DKEY = 'dx7-shushi.draft.v1', EKEY = 'dx7-shushi.draft-edit.v1';
let draft0 = '';                                     // 入力画面を開いた時点の内容（これと同じなら、まだ何も打っていない）
const draftKey = () => (S.draft && S.draft.id ? EKEY : DKEY);
function readDraft(key) {
  try {
    const o = JSON.parse(localStorage.getItem(key) || 'null');
    if (!o || !o.draft || !Array.isArray(o.draft.plays) || !o.draft.plays.length) return null;
    if (key === EKEY ? !db.sessions.some(x => x.id === o.draft.id) : o.draft.id) return null;
    const d = o.draft, have = new Set(db.machines.map(m => m.id));
    o.draft = { id: d.id || null, date: /^\d{4}-\d{2}-\d{2}$/.test(d.date) ? d.date : TODAY(), storeId: d.storeId || mainStore()?.id || '',
      plays: d.plays.map(p => { const q = { ...blankPlay(), ...p, machineId: have.has(p.machineId) ? p.machineId : '' }; if (!(Number.isFinite(q.t0) && q.t0 > 0 && q.t0 <= Date.now() + 60000)) delete q.t0; return q; }),
      deposit: Calc.n(d.deposit), cashOut: Calc.n(d.cashOut), manual: !!d.manual, expense: Calc.n(d.expense), memo: String(d.memo || ''), snap: d.snap || null };
    return o;
  } catch (_) { return null; }
}
function saveDraft(open = true) {
  if (!S.draft || S.sheet?.type !== 'entry') return;
  try { if (JSON.stringify(S.draft) !== draft0) localStorage.setItem(draftKey(), JSON.stringify({ at: Date.now(), open, back: !!S.back, draft: S.draft })); } catch (_) {}
}
const dropDraft = key => { try { localStorage.removeItem(key); } catch (_) {} };
function resumeDraft(o) { S.draft = o.draft; draft0 = ''; S.back = o.draft.id ? !!o.back : null; S.tried = false; S.sheet = { type: 'entry' }; S.enter = true; renderSheet(); saveDraft(); }
function draftBar() {
  if (S.sheet?.type === 'entry' && S.draft && !S.draft.id) return '';   // いま開いている最中は出さない
  const o = readDraft(DKEY); if (!o) return '';
  const d = o.draft, dt = pdate(d.date), n = d.plays.filter(p => p.machineId || p.cash || p.savedIn || p.carryIn || p.out).length;
  return `<div class="banner two"><button data-act="resumeDraft">入力途中の記録があります（${dt.getMonth() + 1}月${dt.getDate()}日${n ? `・${n}台` : ''}${d.plays.some(p => p.t0) ? '・タイマー計測中' : ''}）。<b>続きから入力 ›</b></button><button data-act="askDropDraft" aria-label="入力途中の記録を破棄">破棄</button></div>`;
}
/* ---------- sheets ---------- */
// タイマー。開始した時刻（t0）だけを下書きに持つので、アプリを閉じても計測は続く。保存する記録には分だけを入れる
const liveMin = p => Math.min(9999999, Calc.n(p.minutes) + (p.t0 ? Math.max(0, Math.round((Date.now() - p.t0) / 60000)) : 0));
function draftRates() {
  const d = S.draft, st = storeOf(d.storeId);
  if (d.snap && d.snap.storeId === d.storeId) return { lendPer1000: d.snap.lendPer1000, exchX10: d.snap.exchX10 };
  return st ? { lendPer1000: st.lendPer1000, exchX10: st.exchX10 } : { lendPer1000: 47, exchX10: 50 };
}
function draftSession() {
  const d = S.draft, r = draftRates();
  const s = { id: d.id, date: d.date, storeId: d.storeId, ...r, plays: d.plays.map(p => ({ machineId: p.machineId, cash: Calc.n(p.cash), savedIn: Calc.n(p.savedIn), carryIn: Calc.n(p.carryIn), out: Calc.n(p.out), minutes: liveMin(p) })), deposit: Calc.n(d.deposit), expense: Calc.n(d.expense), memo: d.memo.trim() };
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
  if (src && o.copy) d = { id: null, date: TODAY(), storeId: src.storeId, plays: src.plays.map(p => ({ ...blankPlay(), machineId: machineOf(p.machineId)?.gone ? '' : p.machineId })), deposit: 0, cashOut: 0, manual: false, expense: src.expense, memo: '', snap: null };
  else if (src) { const c = Calc.session(src); d = { id: src.id, date: src.date, storeId: src.storeId, plays: src.plays.map(p => ({ ...p })), deposit: src.deposit, cashOut: src.cashOut, manual: src.cashOut !== Calc.autoCashOut(c.hand, src.deposit, src.exchX10), expense: src.expense, memo: src.memo || '', snap: { storeId: src.storeId, lendPer1000: src.lendPer1000, exchX10: src.exchX10 } }; }
  else { d = { id: null, date: o.date || TODAY(), storeId: o.storeId || mainStore()?.id || '', plays: [blankPlay()], deposit: 0, cashOut: 0, manual: false, expense: 0, memo: '', snap: null }; }
  S.draft = d; draft0 = JSON.stringify(d); S.tried = false; S.sheet = { type: 'entry' }; S.enter = true; renderSheet();
}
// 新しい記録を始める。入力途中の記録が残っているときは、消してよいか先に確かめる
function openNew(o) {
  if (readDraft(DKEY)) { S.pending = { o, back: S.back }; S.confirm = { title: '入力途中の記録があります', msg: '新しく入力を始めると、入力途中の内容は消えます。続きを入力するときは「やめる」を押して、ホームの「続きから入力」を開いてください。', ok: '新しく入力する', act: 'replaceDraft', danger: true }; renderOverlay(); return; }
  openEntry(o);
}
const sheets = {
  sync() {
    const f = S.sy, on = !!sy.uid; let safe = null; try { safe = JSON.parse(localStorage.getItem(SAFE) || 'null'); } catch (_) {}
    const head = `<header class="sh-head"><button data-act="closeSheet" aria-label="閉じる">${svg('close')}</button><h2>同期</h2><span></span></header>`;
    if (!CAN_SYNC) return head + '<div class="sh-body"><section class="card"><p class="note">同期は、公開しているアプリ（ホーム画面に追加したもの）で使えます。このプレビュー用のページからは、外へ通信できません。</p></section></div>';
    const msg = (f.err ? `<p class="banner err" role="alert">${esc(f.err)}</p>` : '') + (f.msg ? `<p class="banner" role="status">${esc(f.msg)}</p>` : '');
    if (!on) return head + `<div class="sh-body">
      <section class="card"><header><h2>ログイン</h2></header>
        <p class="note">ログインすると、記録をクラウドにも保存します。iPhone が壊れても、別の端末でログインすれば同じ記録が戻ります。この端末の中の記録は、今までどおり残ります。</p>
        ${sy.err === 'RELOGIN' ? `<p class="banner err">${esc(cloudMsg('RELOGIN'))}</p>` : ''}
        <form data-form="sync" novalidate style="display:flex;flex-direction:column;gap:12px">
          <label class="field" for="sy-email"><span class="flabel">メールアドレス</span><input id="sy-email" type="email" inputmode="email" autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false" data-sy="email" value="${esc(f.email)}"></label>
          <label class="field" for="sy-pw"><span class="flabel">パスワード（6文字以上）</span><input id="sy-pw" type="password" autocomplete="current-password" data-sy="pw" value="${esc(f.pw)}"></label>
          ${msg}
          <div class="grid2"><button type="submit" class="btn primary sm" ${f.busy ? 'disabled' : ''}>${f.busy ? '通信中…' : 'ログイン'}</button><button type="button" class="btn line sm" data-act="sySignup" ${f.busy ? 'disabled' : ''}>新しく登録</button></div>
        </form>
        <button class="more-link" data-act="syReset">パスワードを忘れたとき ›</button>
        <p class="note">はじめての端末では「新しく登録」。2台目からは、同じメールアドレスとパスワードで「ログイン」。</p>
      </section></div>`;
    const k = syncState(), pct = Math.round(sy.bytes / 1048576 * 1000) / 10;
    return head + `<div class="sh-body">
      <section class="card"><header><h2>同期の状態</h2><span class="sub">${SY_LABEL[k] || ''}</span></header>
        <dl class="dl">
          <div><dt>アカウント</dt><dd style="font-size:13px;word-break:break-all">${esc(sy.email)}</dd></div>
          <div><dt>最後に同期した時刻</dt><dd style="font-size:13px">${sy.at ? fmtTime(sy.at) : 'まだ同期していません'}</dd></div>
          <div><dt>この端末の記録</dt><dd>${N(mine ? mine.sessions.length : 0, '件')}</dd></div>
          <div><dt>クラウドの使用量<small>上限は約1MB</small></dt><dd class="num">${pct}<i>%</i></dd></div>
        </dl>
        ${sy.err ? `<p class="banner err" role="alert">${esc(cloudMsg(sy.err))}</p>` : k === 'pending' ? '<p class="banner">まだ送っていない変更があります。つながっていれば、まもなく自動で送ります。</p>' : ''}${msg}
        <div class="grid2"><button class="btn primary sm" data-act="syNow" ${syBusy ? 'disabled' : ''}>${syBusy ? '同期中…' : 'いま同期する'}</button><button class="btn line sm" data-act="askSyLogout">ログアウト</button></div>
        <p class="note">アプリを開いたとき・記録を保存したとき・ほかのアプリから戻ったときに、自動で同期します。圏外で入力した分は、つながったときに送ります。同じ記録を2台で直していたら、後から保存した方を残し、もう一方は変更履歴に入ります。</p>
        ${safe && safe.at ? `<button class="more-link" data-act="askSyRevert">同期で書き換わる前（${fmtTime(safe.at)}）の状態に戻す ›</button>` : ''}
      </section></div>`;
  },
  entry() {
    const d = S.draft, st = storeOf(d.storeId), r = draftRates(), bal = draftBalance(), per = r.lendPer1000;
    // 貸出1回分（47枚）ずつ数えるボタン。サンドのボタンを押した回数どおりに押せば、枚数が入る
    const stepper = (i, k) => `<button class="chip xs" id="${k}-dn-${i}" data-act="step" data-i="${i}" data-k="${k}" data-v="${-per}" aria-label="${per}枚減らす">−${per}</button><span class="cnt" id="${k}-n-${i}"></span><button class="chip xs" id="${k}-up-${i}" data-act="step" data-i="${i}" data-k="${k}" data-v="${per}" aria-label="${per}枚足す">+${per}</button>`;
    return `<header class="sh-head"><button data-act="closeSheet" aria-label="閉じる">${svg('close')}</button><h2>${d.id ? '実戦を編集' : '実戦を記録'}</h2><span></span></header>
    <div class="sh-body">
      <label class="frow" for="f-date"><span>日付</span><input id="f-date" type="date" data-f="date" value="${d.date}" max="${TODAY()}"></label>
      ${st ? `<p class="hint"><b style="color:var(--fg-2);font-weight:500">${esc(st.name)}</b>・貸出 ${r.lendPer1000}枚／交換 ${r.exchX10}枚（1,000円あたり）・貯メダル残高 ${nf(bal)}枚${d.snap ? '・記録時の条件' : ''}</p>` : ''}
      ${d.plays.map((p, i) => { const mc = machineOf(p.machineId); return `<section class="pcard">
        <header><span class="pno">${i + 1}台目</span>${d.plays.length > 1 ? `<button data-act="delPlay" data-i="${i}">この台を外す</button>` : ''}</header>
        <button class="mpick ${mc ? '' : 'none'}" data-act="pickMachine" data-i="${i}"><span>${mc ? esc(mc.name) : '機種を選ぶ'}${mc && (mc.maker || mc.type) ? `<small>${esc([mc.maker, mc.type].filter(Boolean).join('・'))}</small>` : ''}</span>${svg('right', 'chev')}</button>
        ${numField('現金投資', '円', `p.${i}.cash`, p.cash)}
        <div class="sub-chips">${[1000, 5000, 10000].map(v => `<button class="chip xs" data-act="cashAdd" data-i="${i}" data-v="${v}">+${nf(v)}</button>`).join('')}</div>
        ${numField('貯メダル使用', '枚', `p.${i}.savedIn`, p.savedIn)}
        <div class="sub-chips"><span class="hint full" id="svl-${i}"></span>${stepper(i, 'savedIn')}</div>
        ${i > 0 ? numField('持ちメダル使用', '枚', `p.${i}.carryIn`, p.carryIn) + `<div class="sub-chips"><span class="hint full" id="cyl-${i}"></span>${stepper(i, 'carryIn')}<button class="chip xs" id="carry-${i}" data-act="carryAll" data-i="${i}"></button></div>` : ''}
        ${numField('終了時の枚数', '枚', `p.${i}.out`, p.out)}
        ${numField('遊技時間', '分', `p.${i}.minutes`, p.minutes)}
        <div class="sub-chips"><span class="hint" id="tml-${i}" style="margin-right:auto;align-self:center"></span><button class="stp tm" id="tm-${i}" data-act="timer" data-i="${i}"></button></div>
        <div class="pres" id="pres-${i}"></div></section>`; }).join('')}
      <button class="btn line" data-act="addPlay">＋ 台を追加</button>
      ${d.plays.length === 1 ? '<p class="hint">出したメダルで別の台を打つときは、台を追加して「持ちメダル使用」に入れます。持ちメダルは、貯メダルの1日の上限に数えません。</p>' : ''}
      <section class="settle">
        <h3>精算</h3>
        <div class="srow"><span>手元のメダル</span><span id="st-hand"></span></div>
        ${numField('貯メダルに預ける', '枚', 'deposit', d.deposit)}
        <div class="sub-chips"><button class="chip xs" data-act="depSet" data-v="0">預けない</button><button class="chip xs" data-act="depSet" data-v="all">全部預ける</button></div>
        ${numField('換金額', '円', 'cashOut', d.manual ? d.cashOut : '')}
        <div class="sub-chips"><span class="hint" id="st-autolab" style="margin-right:auto;align-self:center"></span><button class="chip xs" id="st-auto" data-act="cashAuto">自動計算に戻す</button></div>
        <div class="flow"><div class="flowbar" id="st-bar"></div><div class="legend" id="st-leg"></div></div>
      </section>
      <section class="pcard">${numField('経費（交通費など）', '円', 'expense', d.expense)}</section>
      <label class="field" for="f-memo"><span class="flabel">メモ（台を選んだ理由・やめた理由など）</span><textarea id="f-memo" rows="3" data-f="memo">${esc(d.memo)}</textarea></label>
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
        ${has ? `<p class="note">記録${n ? `（${fmtMD(dates[0])}〜${fmtMD(dates[n - 1])}）` : ''}・機種・条件を、1つのファイルにまとめます。${store.backupAt ? `最後のバックアップ ${fmtTime(store.backupAt)}。` : ''}</p>
        <div class="grid2"><button class="btn primary sm" data-act="exportFile">ファイルに保存</button><button class="btn line sm" data-act="copyBackup">テキストをコピー</button></div>
        ${sh.info ? `<p class="banner" role="status" id="bk-info">${esc(sh.info)}</p>` : ''}
        ${sh.text ? `<label class="field" for="bk-out"><span class="flabel">コピーできなかったときは、下を全選択してコピーしてください</span><textarea id="bk-out" class="mono" readonly rows="5">${esc(sh.text)}</textarea></label>` : ''}`
          : ''}
      </section>
      <section class="card"><header><h2>復元する</h2></header>
        <p class="note">${has ? `いまの記録 ${n}件を、バックアップの内容でまるごと置き換えます。` : 'バックアップの内容を読み込みます。'}</p>
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
      <div><h3>台ごと</h3><p class="f"><b>貸出枚数</b> ＝ 現金投資 ÷ 1,000 × 貸出枚数<br><b>差枚</b> ＝ 終了時の枚数 −（貸出枚数 ＋ 持ちメダル使用 ＋ 貯メダル使用）<br><b>台の収支</b> ＝（終了時の枚数 − 持ちメダル使用 − 貯メダル使用）× 1枚の交換価値 − 現金投資</p></div>
      <div><h3>1日ごと</h3><p class="f"><b>手元のメダル</b> ＝ 終了時の枚数の合計 − 持ちメダル使用の合計<br><b>換金額</b>（自動） ＝（手元 − 預け入れ）÷ 交換枚数 × 1,000円 を100円単位で切り捨て。手入力で上書き可<br><b>現金収支</b> ＝ 換金額 − 現金投資<br><b>遊技収支（メダル評価込み）</b> ＝ 現金収支 ＋（預け入れ − 貯メダル使用）× 1枚の交換価値<br><b>最終収支</b> ＝ 収支 − 経費</p></div>
      <div><h3>二重計上を防ぐ仕組み</h3><p class="f">持ちメダルや貯メダルで打った分は現金投資に入れません。台の収支を足し上げると、端数・景品差を除いて日の遊技収支と一致します。差は「端数・景品差」として日別の詳細に表示します。</p></div>
      <div><h3>集計</h3><p class="f"><b>勝敗</b> は日単位。収支が＋なら勝ち、−なら負け、0なら引き分け。経費は含めません。<br><b>勝率</b> ＝ 勝ち日数 ÷ 実戦日数（引き分けも分母に入れる）<br><b>回収率</b> ＝（現金投資 ＋ 収支）÷ 現金投資<br><b>時給</b> ＝ 遊技時間を入力した実戦の収支合計 ÷ その遊技時間の合計<br><b>機種別</b> は台の収支で集計</p></div>
      <div><h3>交換条件</h3><p class="f"><b>貸出</b> 1,000円で47枚（1枚 約21.3円）<br><b>交換</b> 50枚で1,000円（1枚 20円）<br>現金で借りたメダルは、交換するときに約6%目減りします（10,000円＝470枚 → 交換すると9,400円）。条件は記録するたびに記録側にも保存するので、あとで条件を変えても過去の収支は変わりません。</p></div>
      <div><h3>貯メダル</h3><p class="f"><b>残高</b> ＝ 初期残高 ＋ 預け入れの合計 − 使用の合計<br><b>1日の使用上限</b> 470枚。同じ日の記録を合算して判定し、超える入力は保存できません。<br><b>持ちメダル</b>（その日に出したメダル）を次の台で使う分は、この上限に数えません。<br><b>再プレイ手数料</b> なし（預けた枚数をそのまま使える）<br>有効期限は扱いません。</p></div>
    </div>`;
  }
};

// タイマーの表示。動いている間は1秒ごとに呼ぶ
function paintTimers() {
  const d = S.draft; if (!d || S.sheet?.type !== 'entry') return;
  const today = d.date === TODAY();
  d.plays.forEach((p, i) => {
    const inp = $(`#f-p-${i}-minutes`), b = $('#tm-' + i), l = $('#tml-' + i); if (!inp || !b || !l) return;
    const run = !!p.t0, has = Calc.n(p.minutes) > 0;
    inp.readOnly = run;                                  // 計測中は手で打てない（終了を押すと確定して、直せるようになる）
    if (run || document.activeElement !== inp) { const v = fin(liveMin(p)); if (inp.value !== v) inp.value = v; }
    b.hidden = !run && !today;                           // 過去の日付の記録には出さない
    b.textContent = run ? '終了' : has ? '再開' : '開始'; b.classList.toggle('on', run); b.setAttribute('aria-pressed', String(run));
    if (run) { const sec = Math.max(0, Math.floor((Date.now() - p.t0) / 1000)), t = new Date(p.t0); l.innerHTML = `${t.getHours()}:${pad(t.getMinutes())} 開始・計測中 <b class="tnum">${Math.floor(sec / 3600)}:${pad(Math.floor(sec / 60) % 60)}:${pad(sec % 60)}</b>`; }
    else l.textContent = !today ? '' : has ? 'タイマー（続きの時間を足す）' : 'タイマー';
  });
}
function updateLive() {
  const d = S.draft; if (!d || S.sheet?.type !== 'entry') return;
  const s = draftSession(), c = Calc.session(s), vo = vopts();
  let avail = 0;
  d.plays.forEach((p, i) => {
    const el = $('#pres-' + i), cp = c.plays[i], sp = s.plays[i];
    if (el) el.innerHTML = (sp.cash + sp.carryIn + sp.savedIn + sp.out) ? `<span>投入 ${nf(cp.inMedals)}枚・差枚 ${Y(cp.diff, { unit: '枚' })}</span>${Y(cp.yen)}` : '<span>金額と枚数を入れると、差枚と収支を自動で計算します</span>';
    const per = s.lendPer1000, cnt = v => (v > 0 && v % per === 0 ? `${v / per}回` : '');
    const cb = $('#carry-' + i);
    if (cb) {      // 持ちメダル: その日に前の台までで出したメダル。貯メダルの1日上限には数えない
      cb.textContent = `全部（${nf(avail)}枚）`; cb.dataset.v = avail; cb.hidden = avail <= 0 || sp.carryIn === avail;
      $('#cyl-' + i).textContent = avail > 0 ? `前の台までの手元 ${nf(avail)}枚・1日の上限には数えません` : '前の台の「終了時の枚数」を入れると使えます';
      $(`#carryIn-up-${i}`).disabled = sp.carryIn + per > avail; $(`#carryIn-dn-${i}`).disabled = sp.carryIn <= 0; $(`#carryIn-n-${i}`).textContent = cnt(sp.carryIn);
    }
    avail += sp.out - sp.carryIn;
    const sl = $('#svl-' + i);
    if (sl) {
      sl.textContent = vo.dailyLimit > 0 ? `本日あと ${nf(Math.max(0, vo.dailyLimit - vo.usedToday - c.savedIn))}枚（1日 ${nf(vo.dailyLimit)}枚まで）` : '';
      $(`#savedIn-up-${i}`).disabled = vo.dailyLimit > 0 && vo.usedToday + c.savedIn + per > vo.dailyLimit; $(`#savedIn-dn-${i}`).disabled = sp.savedIn <= 0; $(`#savedIn-n-${i}`).textContent = cnt(sp.savedIn);
    }
  });
  paintTimers();
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
  const raw = (S.picker.q || '').trim(), q = norm(raw), cnt = new Map(Calc.byMachine(db.sessions).map(r => [r.id, r.n]));
  const own = db.machines.filter(m => !m.gone);
  const list = own.filter(m => !q || norm(m.name + (m.maker || '')).includes(q) || Catalog.matches(m, raw)).sort((a, b) => (b.fav - a.fav) || ((cnt.get(b.id) || 0) - (cnt.get(a.id) || 0)));
  const haveId = new Set(own.map(m => m.id)), haveName = new Set(own.map(m => Catalog.key(m.name)));
  const cands = Catalog.find(raw).filter(e => !haveId.has(e.id) && !haveName.has(Catalog.key(e.name)));      // 一覧にまだ無い機種の、正式名称の候補
  const exact = own.some(m => norm(m.name) === q) || cands.some(e => norm(e.name) === q);
  return list.map(m => `<button class="mrow" data-act="chooseMachine" data-id="${m.id}"><span><b>${esc(m.name)}</b><small>${esc([m.maker, m.type].filter(Boolean).join('・') || '分類未設定')}・${cnt.get(m.id) || 0}回</small></span>${m.fav ? '<span class="st" aria-label="お気に入り">★</span>' : ''}</button>`).join('')
    + (cands.length ? '<p class="mhead">正式名称の候補</p>' + cands.map(e => `<button class="mrow cat" data-act="addCatalog" data-id="${e.id}"><span><b>${esc(e.name)}</b><small>${esc(e.maker)}・${esc(e.type)}</small></span><span class="add">追加</span></button>`).join('') : '')
    + (q && !exact ? `<button class="mrow new" data-act="newMachine"><span><b>「${esc(raw)}」をこの名前のまま追加</b><small>${cands.length ? '候補に当てはまるものがないとき' : '正式名称の候補は見つかりませんでした'}</small></span></button>` : '')
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
  S.confirm = { title: 'このバックアップで置き換えますか？', msg: `${when}バックアップ（記録 ${r.data.sessions.length}件${r.skipped ? `・読めなかった記録 ${r.skipped}件は除外` : ''}）を読み込みます。${mine ? `いまの記録 ${mine.sessions.length}件は置き換えられます。` : ''}置き換えたあとは戻せません。`, ok: '置き換える', act: 'doRestore', danger: !!(mine && mine.sessions.length) };
  renderOverlay();
}
const closeSheet = () => { S.sheet = null; S.draft = null; S.picker = null; };
function commit(force) {
  const d = S.draft, s = draftSession(); S.tried = true;
  const v = Calc.validate(s, vopts());
  if (v.errors.length) { updateLive(); const b = $('.sh-body'); b.scrollTop = b.scrollHeight; return; }
  const key = x => JSON.stringify([x.date, x.storeId, x.plays.map(p => [p.machineId, p.cash, p.savedIn, p.carryIn, p.out]), x.deposit, x.cashOut]);
  if (!d.id && !force && db.sessions.some(x => key(x) === key(s))) { S.confirm = { title: '同じ内容の記録があります', msg: '日付と台の内容がまったく同じ記録がすでにあります。重複して保存しますか？', ok: '保存する', act: 'saveForce' }; renderOverlay(); return; }
  const now = Date.now();
  if (d.id) {
    const i = db.sessions.findIndex(x => x.id === d.id), old = db.sessions[i];
    if (!old) { s.createdAt = now; db.sessions.push(s); }      // 編集している間に、同期でほかの端末から消されていた → 消さずに残す
    else {
      const before = JSON.parse(JSON.stringify(old)); delete before.history;
      s.createdAt = old.createdAt || 0; s.updatedAt = now;
      s.history = Calc.diffSession(before, s).length ? (old.history || []).concat([{ at: now, before }]).slice(-20) : (old.history || []);
      db.sessions[i] = s;
    }
  } else { s.id = uid(); s.createdAt = now; db.sessions.push(s); }
  S.confirm = null; S.cal = s.date.slice(0, 7); dropDraft(draftKey());
  const back = S.back; closeSheet(); if (back) { S.sheet = { type: 'day', date: s.date }; }
  if (!d.id && !back) S.tab = 'home';
  S.back = null; render();
}

/* ---------- actions ---------- */
const A = {
  tab(el) { if (el.dataset.tab === 'add') { const o = readDraft(DKEY); if (S.draft && S.sheet?.type === 'entry') return; S.back = null; return o ? resumeDraft(o) : openEntry(); } closeSheet(); S.tab = el.dataset.tab; if (S.tab === 'cal') S.cal = S.cal || TODAY().slice(0, 7); render(); },
  period(el) { S.period = el.dataset.p; render(); },
  calMove(el) { if (el.disabled) return; S.cal = addMonth(S.cal, +el.dataset.k); render(); },
  day(el) { S.sheet = { type: 'day', date: el.dataset.date }; S.enter = true; renderSheet(); },
  toggleHist(el) { S.sheet.hist = S.sheet.hist === el.dataset.id ? null : el.dataset.id; renderSheet(); },
  auditSheet() { S.sheet = { type: 'audit' }; S.enter = true; renderSheet(); },
  newOn(el) { S.back = S.sheet?.type === 'day'; openNew({ date: el.dataset.date }); },
  editRec(el) { S.back = true; openEntry({ id: el.dataset.id }); },
  copyRec(el) { S.back = false; openNew({ id: el.dataset.id, copy: true }); },
  replaceDraft() { const p = S.pending; S.pending = null; S.confirm = null; dropDraft(DKEY); renderOverlay(); if (!p) return; S.back = p.back; openEntry(p.o); render(); },
  resumeDraft() { const o = readDraft(DKEY); if (o) resumeDraft(o); else render(); },
  askDropDraft() { S.confirm = { title: '入力途中の記録を破棄しますか？', msg: '打ちかけの内容を消します。消したあとは戻せません。', ok: '破棄する', act: 'dropDraft', danger: true }; renderOverlay(); },
  dropDraft() { dropDraft(DKEY); S.confirm = null; render(); },
  closeSheet() { const back = S.sheet?.type === 'entry' && S.back && S.draft ? S.draft.date : null;
    if (S.sheet?.type === 'entry' && S.draft) { if (S.draft.id) dropDraft(EKEY); else saveDraft(false); }
    closeSheet(); S.back = null; if (back && db.sessions.some(s => s.date === back)) S.sheet = { type: 'day', date: back }; render(); },
  rules() { S.sheet = { type: 'rules' }; S.enter = true; renderSheet(); },
  addPlay() { S.draft.plays.push(blankPlay()); renderSheet(); const b = $('.sh-body'), card = b.querySelectorAll('.pcard')[S.draft.plays.length - 1]; if (card) { const k = b.offsetHeight / (b.getBoundingClientRect().height || 1); b.scrollTop += (card.getBoundingClientRect().top - b.getBoundingClientRect().top) * k - 12; } },
  delPlay(el) { S.draft.plays.splice(+el.dataset.i, 1); renderSheet(); },
  step(el) { const i = +el.dataset.i, k = el.dataset.k, p = S.draft.plays[i]; p[k] = Math.max(0, Math.min(9999999, Calc.n(p[k]) + +el.dataset.v)); $(`#f-p-${i}-${k}`).value = fin(p[k]); updateLive(); },
  timer(el) {      // 開始 ⇄ 終了。ほかの台で動いているタイマーは止めて分を確定する（同時に打てるのは1台だけ）
    const d = S.draft, p = d.plays[+el.dataset.i], run = !!p.t0;
    d.plays.forEach(q => { if (q.t0) { q.minutes = liveMin(q); delete q.t0; } });
    if (!run) p.t0 = Date.now();
    updateLive();
  },
  cashAdd(el) { const p = S.draft.plays[+el.dataset.i]; p.cash = Math.min(9999999, Calc.n(p.cash) + +el.dataset.v); $(`#f-p-${el.dataset.i}-cash`).value = fin(p.cash); updateLive(); },
  carryAll(el) { const p = S.draft.plays[+el.dataset.i]; p.carryIn = +el.dataset.v; $(`#f-p-${el.dataset.i}-carryIn`).value = fin(p.carryIn); updateLive(); },
  depSet(el) { const d = S.draft, hand = d.plays.reduce((a, p) => a + Calc.n(p.out) - Calc.n(p.carryIn), 0); d.deposit = el.dataset.v === 'all' ? Math.max(0, hand) : 0; $('#f-deposit').value = fin(d.deposit); updateLive(); },
  cashAuto() { S.draft.manual = false; updateLive(); },
  pickMachine(el) { S.picker = { i: +el.dataset.i, q: '' }; renderOverlay(); },
  closePicker() { S.picker = null; renderOverlay(); },
  chooseMachine(el) { S.draft.plays[S.picker.i].machineId = el.dataset.id; S.picker = null; renderOverlay(); renderSheet(); },
  newMachine() { const name = S.picker.q.trim(); if (!name) return; let m = db.machines.find(x => norm(x.name) === norm(name)); if (m) delete m.gone; else { m = { id: uid(), name, maker: '', type: '', fav: false }; db.machines.push(m); } S.draft.plays[S.picker.i].machineId = m.id; S.picker = null; renderOverlay(); renderSheet(); },
  addCatalog(el) {      // 正式名称の候補から追加する。以前に削除した同じ機種があれば、それを一覧に戻す
    const e = Catalog.byId(el.dataset.id); if (!e || !S.picker) return; let m = db.machines.find(x => x.id === e.id || norm(x.name) === norm(e.name));
    if (m) delete m.gone; else { m = { id: e.id, name: e.name, maker: e.maker, type: e.type, fav: false }; db.machines.push(m); }
    S.draft.plays[S.picker.i].machineId = m.id; S.picker = null; renderOverlay(); renderSheet();
  },
  askDelMachine(el) {
    const m = machineOf(el.dataset.id); if (!m) return; const n = db.sessions.filter(x => x.plays.some(p => p.machineId === m.id)).length;
    S.confirm = { title: `「${m.name}」を一覧から削除しますか？`, msg: (n ? `この機種を使った記録 ${n}件は、機種名つきでそのまま残ります。新しい記録では選べなくなります。` : '機種を選ぶ一覧から消えます。') + '同じ名前を追加し直せば、また選べます。', ok: '削除する', act: 'doDelMachine', danger: true, id: m.id }; renderOverlay();
  },
  doDelMachine() { const m = machineOf(S.confirm.id); if (m) { m.gone = true; m.fav = false; } S.confirm = null; render(); },   // 記録が名前を引けるよう、機種そのものは消さずに「一覧から外す」印を付ける
  fav(el) { const m = machineOf(el.dataset.id); m.fav = !m.fav; render(); },
  syncSheet() { S.sy = { email: (S.sy && S.sy.email) || sy.email || '', pw: '', busy: false, msg: '', err: '' }; S.sheet = { type: 'sync' }; S.enter = true; renderSheet(); },
  async syAuth(op) {
    const f = S.sy; if (!f || f.busy) return; f.err = ''; f.msg = ''; const email = f.email.trim();
    if (!email || !f.pw) { f.err = cloudMsg(email ? 'MISSING_PASSWORD' : 'MISSING_EMAIL'); return renderSheet(); }
    f.busy = true; renderSheet();
    try { setSession(await authPost(op, { email, password: f.pw, returnSecureToken: true })); }
    catch (e) { f.busy = false; f.err = cloudMsg(e.code); return renderSheet(); }
    f.busy = false; f.pw = '';
    render(); await syncNow(true);
  },
  syLogin() { return A.syAuth('signInWithPassword'); },
  sySignup() { return A.syAuth('signUp'); },
  async syReset() {
    const f = S.sy; if (!f || f.busy) return; f.err = ''; f.msg = ''; const email = f.email.trim(); if (!email) { f.err = cloudMsg('MISSING_EMAIL'); return renderSheet(); }
    f.busy = true; renderSheet();
    try { await authPost('sendOobCode', { requestType: 'PASSWORD_RESET', email }); f.msg = `${email} に、パスワードを決め直すためのメールを送りました。メールの案内どおりに設定してから、ここでログインしてください。`; }
    catch (e) { f.err = cloudMsg(e.code); }
    f.busy = false; renderSheet();
  },
  syNow() { if (S.sy) { S.sy.err = ''; S.sy.msg = ''; } return syncNow(true); },
  askSyLogout() { S.confirm = { title: 'ログアウトしますか？', msg: 'この端末の記録は消えません。ログアウトしている間は、クラウドへ保存されなくなります。', ok: 'ログアウト', act: 'doSyLogout' }; renderOverlay(); },
  doSyLogout() { clearTimeout(syTimer); sy.uid = ''; sy.id = ''; sy.refresh = ''; sy.exp = 0; sy.err = ''; saveSy(); S.confirm = null; if (S.sy) { S.sy.err = ''; S.sy.msg = ''; } render(); },
  askSyRevert() { S.confirm = { title: '同期で書き換わる前の状態に戻しますか？', msg: 'この端末の記録を、最後に同期で書き換わる直前の内容に戻します。戻した内容は、次の同期でクラウドにも反映されます。', ok: '戻す', act: 'doSyRevert', danger: true }; renderOverlay(); },
  doSyRevert() {
    S.confirm = null; let st = null; try { st = parseRemote(JSON.stringify(JSON.parse(localStorage.getItem(SAFE)).state)); } catch (_) {}
    if (!st || !mine) { if (S.sy) S.sy.err = '戻せる内容が見つかりませんでした。'; return render(); }
    applyState(st); try { localStorage.removeItem(SAFE); } catch (_) {} if (S.sy) S.sy.msg = '同期で書き換わる前の状態に戻しました。'; render();
  },
  save() { commit(false); },
  saveForce() { commit(true); },
  cancelConfirm() { S.confirm = null; S.pending = null; renderOverlay(); },
  askDel(el) { S.confirm = { title: 'この記録を削除しますか？', msg: '削除したあとは戻せません。', ok: '削除する', act: 'doDel', danger: true, id: el.dataset.id }; renderOverlay(); },
  doDel() { const t = db, i = t.sessions.findIndex(x => x.id === S.confirm.id); if (i >= 0) t.sessions.splice(i, 1); S.confirm = null; if (S.sheet?.type === 'day' && !db.sessions.some(x => x.date === S.sheet.date)) S.sheet = null; render(); },
  editStore(el) { const s = storeOf(el.dataset.id) || mainStore(); S.sd = { id: s.id, lend: String(s.lendPer1000), exch: String(s.exchX10), limit: String(s.dailyLimit || ''), init: String(s.initSaved || ''), card: s.card || '' }; S.prevSheet = S.sheet; S.sheet = { type: 'store' }; S.enter = true; renderSheet(); },
  storeView(el) { S.sheet = { type: 'storeView', id: el.dataset.id }; S.enter = true; renderSheet(); },
  closeStore() { S.sheet = S.prevSheet || null; S.prevSheet = null; S.sd = null; S.enter = false; render(); },
  saveStore() {
    const d = S.sd, lend = parseInt(d.lend, 10), exch = parseInt(d.exch, 10), errs = [];
    if (!(lend >= 1 && lend <= 250) || String(lend) !== d.lend.trim()) errs.push('貸出枚数は1〜250の整数で入力してください');
    if (!(exch >= 10 && exch <= 500) || String(exch) !== d.exch.trim()) errs.push('交換枚数は10〜500の整数で入力してください（例：50枚で1,000円なら 50）');
    if (errs.length) { $('#store-msg').innerHTML = errs.map(e => `<p class="banner err" role="alert" style="margin-bottom:8px">${esc(e)}</p>`).join(''); return; }
    Object.assign(storeOf(d.id), { lendPer1000: lend, exchX10: exch, dailyLimit: Calc.n(d.limit), initSaved: Calc.n(d.init), card: d.card });
    A.closeStore();
  },
  askWipe() { S.confirm = { title: `記録 ${mine.sessions.length}件をすべて消しますか？`, msg: '実戦の記録をすべて削除します。機種と条件は残ります。消したあとは戻せません。先にバックアップを書き出しておくと安心です。', ok: 'すべて消す', act: 'doWipe', danger: true }; renderOverlay(); },
  doWipe() { mine.sessions = []; S.confirm = null; closeSheet(); render(); },
  backup() { S.sheet = { type: 'backup', text: '', error: '', info: '' }; S.enter = true; renderSheet(); },
  exportFile() {
    if (!mine) return; const text = backupText(), name = backupName();
    const manual = () => { const a = document.createElement('a'), url = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000); markBackup('書き出しを始めました。保存されないときは「テキストをコピー」を使ってください'); };
    if (DL) { DL.save({ filename: name, data: text }).then(() => markBackup('バックアップを書き出しました'), e => { if (S.sheet?.type === 'backup') { S.sheet.info = ''; S.sheet.error = e && e.code === 'declined' ? '' : 'ファイルに保存できませんでした。「テキストをコピー」を使ってください。'; renderSheet(); } }); return; }
    try { const f = new File([text], name, { type: 'application/json' }); if (navigator.canShare && navigator.canShare({ files: [f] })) { navigator.share({ files: [f] }).then(() => markBackup('バックアップを書き出しました'), e => { if (!e || e.name !== 'AbortError') manual(); }); return; } } catch (_) {}
    manual();
  },
  copyBackup() {
    if (!mine) return; const text = backupText(), show = () => { S.sheet.text = text; renderSheet(); const t = $('#bk-out'); if (t) { t.focus(); t.select(); } };
    try { navigator.clipboard.writeText(text).then(() => markBackup('バックアップをコピーしました。メモなどに貼り付けて保管してください'), show); } catch (_) { show(); }
  },
  readPasted() { loadBackup(($('#bk-in') || {}).value || ''); },
  doRestore() {
    const inc = S.incoming; if (!inc) return;
    mine = inc.data; db = mine; if (inc.budget) S.budget = inc.budget; S.incoming = null; S.confirm = null;
    closeSheet(); S.tab = 'home'; S.cal = TODAY().slice(0, 7); render();
  }
};

document.addEventListener('click', e => {
  const ov = e.target.dataset?.ov;
  if (ov === 'picker') return A.closePicker();
  if (ov === 'confirm') return A.cancelConfirm();
  const el = e.target.closest('[data-act]'); if (!el) return;
  const fn = A[el.dataset.act]; if (fn) fn(el, e);
  saveDraft();
});
const digits = v => v.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/[^\d]/g, '').slice(0, 7);
document.addEventListener('input', e => {
  const el = e.target, d = S.draft;
  if (el.dataset.f && d) {
    const f = el.dataset.f;
    if (f === 'date') { if (el.value) d.date = el.value; updateLive(); saveDraft(); return; }
    if (f === 'memo') { d.memo = el.value; saveDraft(); return; }
    const v = digits(el.value); if (v !== el.value) el.value = v;
    const num = v === '' ? 0 : parseInt(v, 10);
    if (f.startsWith('p.')) { const [, i, k] = f.split('.'); d.plays[+i][k] = num; } else { d[f] = num; if (f === 'cashOut') d.manual = v !== ''; }
    updateLive(); saveDraft();
  } else if (el.dataset.q != null && S.picker) { S.picker.q = el.value; $('#mlist').innerHTML = mlistHTML(); }
  else if (el.dataset.sf && S.sd) { const v = digits(el.value); if (v !== el.value) el.value = v; S.sd[el.dataset.sf] = v; }
  else if (el.dataset.sy && S.sy) { S.sy[el.dataset.sy] = el.value; }
  else if (el.id === 'f-budget') { const v = digits(el.value); if (v !== el.value) el.value = v; S.budget = v === '' ? 0 : parseInt(v, 10); }
});
document.addEventListener('change', e => {
  if (e.target.id === 'f-budget') persist();   // ここで画面を描き直すと、欄の外を押した1回目のタップが効かなくなる。保存だけする
  if (e.target.id === 'bk-file' && e.target.files[0]) { const fr = new FileReader(); fr.onload = () => loadBackup(String(fr.result || '')); fr.onerror = () => { if (S.sheet?.type === 'backup') { S.sheet.error = 'ファイルを読み込めませんでした。'; renderSheet(); } }; fr.readAsText(e.target.files[0]); }
  if (e.target.id === 'sf-card' && e.target.files[0] && S.sd) {
    const fr = new FileReader();
    fr.onload = () => { const im = new Image(); im.onload = () => {
      const k = Math.min(1, 900 / im.width), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      if (S.sd) { S.sd.card = c.toDataURL('image/jpeg', 0.82); const pv = $('#sf-prev'); if (pv) pv.innerHTML = `<span class="cardimg"><img src="${S.sd.card}" alt="会員カードのプレビュー"></span>`; }
    }; im.onerror = () => { const m = $('#store-msg'); if (m) m.innerHTML = '<p class="banner err" role="alert" style="margin-bottom:8px">画像を読み込めませんでした。別の画像を選んでください。</p>'; }; im.src = fr.result; };
    fr.readAsDataURL(e.target.files[0]);
  }
});
document.addEventListener('focusin', e => { if (e.target.dataset?.num != null) { const el = e.target, v = digits(el.value); if (v !== el.value) el.value = v; if (v) setTimeout(() => { try { if (document.activeElement === el) el.setSelectionRange(0, el.value.length); } catch (_) {} }, 0); }
  if (matchMedia('(max-width:860px)').matches && e.target.matches('.sh-body input,.sh-body textarea')) setTimeout(() => e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 280); });
// 長押しのメニューを出さない（入力欄は除く）
document.addEventListener('contextmenu', e => { if (!e.target.closest('input,textarea')) e.preventDefault(); });
// すばやい2回タップでの拡大を止める（CSS の指定が効かない場合の備え）。ボタンや入力欄の連打は止めない
let lastTap = 0;
document.addEventListener('touchend', e => { const t = e.timeStamp, quick = t - lastTap < 320; lastTap = t; if (quick && e.cancelable && !e.target.closest('button,a,input,textarea,select,label,[data-act]')) e.preventDefault(); }, { passive: false });
document.addEventListener('submit', e => { e.preventDefault(); if (e.target.dataset?.form === 'sync') A.syLogin(); });
document.addEventListener('focusout', e => { if (e.target.dataset?.num != null) e.target.value = fin(digits(e.target.value)); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (S.confirm) A.cancelConfirm(); else if (S.picker) A.closePicker(); else if (S.sheet?.type === 'store') A.closeStore(); else if (S.sheet) A.closeSheet(); } });

/* ---------- boot ---------- */
function fit() { const w = $('.device-wrap'); if (matchMedia('(max-width:860px)').matches) w.style.removeProperty('--s'); else w.style.setProperty('--s', Math.max(0.55, Math.min(1, (innerHeight - 48) / 894)).toFixed(3)); }
function tick() { const d = new Date(); $('#clock').textContent = `${d.getHours()}:${pad(d.getMinutes())}`; }
function start(data) {
  const saved = restore(), keep = (data && data.S) || {}; loadSy();
  S = Object.assign({ tab: 'home', period: 'all', cal: TODAY().slice(0, 7) }, keep, { basis: 'eval', budget: saved ? Calc.n(saved.settings?.budget) || 80000 : 80000 },
    { sheet: null, draft: null, picker: null, confirm: null, sd: null, back: null, pending: null, tried: false, enter: false });
  mine = (saved && saved.mine) || newMine(); db = mine;
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist().catch(() => {}); } catch (_) {}   // ブラウザに「勝手に消さないで」と頼んでおく
  fit(); tick(); render();
  const de = readDraft(EKEY), dn = readDraft(DKEY), dr = de && de.open ? de : dn && dn.open ? dn : null;
  if (!de) dropDraft(EKEY);
  if (dr) { resumeDraft(dr); render(); }
  scheduleSync(400);
}
addEventListener('resize', fit); setInterval(tick, 20000);
setInterval(() => { if (S && S.draft && S.sheet?.type === 'entry' && S.draft.plays.some(p => p.t0)) paintTimers(); }, 1000);
addEventListener('pagehide', () => { if (S) { persist(); saveDraft(); } });
document.addEventListener('visibilitychange', () => { if (!S) return; if (document.visibilityState === 'hidden') { persist(); saveDraft(); } else if (Date.now() - sy.at > 15000) scheduleSync(300); });
addEventListener('online', () => scheduleSync(300));
try { window.claude?.hot?.snapshot?.(() => ({ S: { tab: S.tab, period: S.period, cal: S.cal } })); } catch (_) {}
if (window.claude?.hot?.ready) window.claude.hot.ready(start); else start(window.claude?.hot?.data ?? {});
window.__demo = { get db() { return db; }, get S() { return S; }, get mine() { return mine; }, get sy() { return sy; }, get syBusy() { return syBusy; }, sync: () => syncNow(false), syncState, get store() { return store; }, KEY, backupText, parseBackup };
})();
