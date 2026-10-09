// 同期の確認。にせの Firebase（mockfb.js）を相手に、2台の端末（ブラウザ2つ）で操作する。
const { chromium } = require('playwright'); const path = require('path'); const http = require('http'); const fs = require('fs'); const Mock = require('./mockfb.js');
const root = path.join(__dirname, '..'); const DIST = path.join(root, 'dist');
(async () => {
  const mock = await Mock.start(); const M = mock.st;
  const srv = http.createServer((q, r) => { const f = decodeURIComponent(q.url.split('?')[0]).replace(/^\/pachisuro\/?/, '') || 'index.html'; const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); r.end(fs.readFileSync(p)); });
  await new Promise(ok => srv.listen(0, ok)); const url = `http://localhost:${srv.address().port}/pachisuro/`;
  const b = await chromium.launch(); const errs = []; let bad = 0;
  const check = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) bad++; console.log(ok ? 'ok ' : 'NG ', name, ok ? '' : `\n     得た値 ${JSON.stringify(got)}\n     期待   ${JSON.stringify(want)}`); };
  const device = async name => { const c = await b.newContext({ viewport: { width: 402, height: 874 }, serviceWorkers: 'block' }); await c.addInitScript(ep => { window.__DX7_SYNC = ep; }, mock.endpoints); const p = await c.newPage(); p.on('pageerror', e => errs.push(name + ': ' + e.message)); await p.goto(url); await p.waitForTimeout(400); p.ctx = c; p.dev = name; return p; };
  const idle = p => p.waitForFunction(() => !__demo.syBusy, null, { timeout: 15000 });
  const sync = async p => { await p.evaluate(() => __demo.sync()); await idle(p); await p.waitForTimeout(80); };
  const openSync = async p => { if (await p.$('.sheet')) { await p.click('.sheet [data-act="closeSheet"]'); await p.waitForTimeout(150); } await p.click('#app [data-tab="more"]'); await p.click('#screen [data-act="syncSheet"]'); await p.waitForTimeout(250); };
  const auth = async (p, email, pw, signup) => { await openSync(p); await p.fill('#sy-email', email); await p.fill('#sy-pw', pw); if (signup) await p.click('[data-act="sySignup"]'); else await p.press('#sy-pw', 'Enter'); await p.waitForTimeout(300); await idle(p); await p.waitForTimeout(150); };
  const closeSheets = async p => { while (await p.$('.sheet [data-act="closeSheet"]')) { await p.click('.sheet [data-act="closeSheet"]'); await p.waitForTimeout(150); } };
  const add = async (p, mid, cash, out) => { await closeSheets(p); await p.click('#app [data-tab="add"]'); await p.waitForTimeout(250); await p.click('[data-act="pickMachine"][data-i="0"]'); await p.click(`[data-act="chooseMachine"][data-id="${mid}"]`); await p.fill('#f-p-0-cash', String(cash)); await p.fill('#f-p-0-out', String(out)); await p.click('[data-act="save"]'); await p.waitForTimeout(250); };
  const edit = async (p, id, out) => { await closeSheets(p); await p.evaluate(i => { const s = __demo.db.sessions.find(x => x.id === i); __demo.S.sheet = { type: 'day', date: s.date }; }, id); await p.click('#app [data-tab="add"]'); await p.click('.sheet [data-act="closeSheet"]'); await p.waitForTimeout(100);
    await p.click('#app [data-tab="home"]'); await p.click(`#screen .list .item[data-act="day"]`); await p.waitForTimeout(200); await p.click(`[data-act="editRec"][data-id="${id}"]`); await p.waitForTimeout(250); await p.fill('#f-p-0-out', String(out)); await p.click('[data-act="save"]'); await p.waitForTimeout(250); await closeSheets(p); };
  const del = async (p, id) => { await closeSheets(p); await p.click('#app [data-tab="home"]'); await p.click(`#screen .list .item[data-act="day"]`); await p.waitForTimeout(200); await p.click(`[data-act="askDel"][data-id="${id}"]`); await p.click('[data-act="doDel"]'); await p.waitForTimeout(250); await closeSheets(p); };
  const view = p => p.evaluate(() => ({ recs: (__demo.mine ? __demo.mine.sessions : []).map(s => s.id.slice(-4) + ':' + s.plays[0].out).sort().join(' '), state: __demo.syncState(), err: __demo.sy.err }));
  const recs = async p => (await view(p)).recs;
  const cloud = uid => { const c = mock.body(uid); return c ? c.sessions.map(s => s.id.slice(-4) + ':' + s.plays[0].out).sort().join(' ') : null; };
  const pill = p => p.evaluate(() => document.querySelector('#screen [data-pill]')?.textContent);

  // ── 1. 登録すると、空の記録がクラウドにできる
  const A = await device('A');
  await auth(A, 'a@example.com', 'secret1', true);
  const uid = await A.evaluate(() => __demo.sy.uid);
  check('1 登録直後', [await view(A), cloud(uid), await A.evaluate(() => document.querySelector('.sheet h2')?.textContent)], [{ recs: '', state: 'ok', err: '' }, '', '同期']);

  // ── 2. 記録を保存すると、何もしなくてもクラウドに届く
  await add(A, 'm1', 5000, 300); const r1 = await A.evaluate(() => __demo.mine.sessions[0].id);
  check('2 保存直後は「未送信あり」', await pill(A), '未送信あり');
  await A.waitForFunction(() => __demo.syncState() === 'ok', null, { timeout: 8000 });
  check('2 自動で届く', [cloud(uid), await pill(A)], [r1.slice(-4) + ':300', '同期済み']);

  // ── 3. 2台目でログインすると、同じ記録が出る
  const B = await device('B');
  await auth(B, 'a@example.com', 'secret1', false);
  check('3 2台目', await view(B), { recs: r1.slice(-4) + ':300', state: 'ok', err: '' });

  // ── 4. 2台目で編集・追加 → 1台目に届く
  await edit(B, r1, 500); await add(B, 'm2', 2000, 0); await sync(B); const r2 = await B.evaluate(i => __demo.mine.sessions.find(s => s.id !== i).id, r1);
  await sync(A);
  check('4 編集と追加が1台目に届く', [await recs(A), await recs(B), cloud(uid)].every(x => x === [r1.slice(-4) + ':500', r2.slice(-4) + ':0'].sort().join(' ')), true);

  // ── 5. 1台目で削除 → 2台目からも消える（復活しない）
  await del(A, r2); await sync(A); await sync(B); await sync(A);
  check('5 削除が届く', [await recs(A), await recs(B), cloud(uid)], [r1.slice(-4) + ':500', r1.slice(-4) + ':500', r1.slice(-4) + ':500']);

  // ── 6. 圏外で2台が同じ記録を別々に直す → 後から保存した方が残り、負けた方は変更履歴に入る
  await A.ctx.setOffline(true); await B.ctx.setOffline(true);
  await edit(A, r1, 600); await A.waitForTimeout(50); await edit(B, r1, 700);
  check('6 圏外の間は「未送信あり」', [await pill(A), await pill(B)], ['未送信あり', '未送信あり']);
  await A.ctx.setOffline(false); await B.ctx.setOffline(false); await sync(A); await sync(B); await sync(A);
  const hist = p => p.evaluate(i => (__demo.mine.sessions.find(s => s.id === i).history || []).map(e => e.before.plays[0].out), r1);
  check('6 食い違いは後勝ち', [await recs(A), await recs(B)], [r1.slice(-4) + ':700', r1.slice(-4) + ':700']);
  check('6 負けた方は変更履歴に残る', [(await hist(A)).includes(600), JSON.stringify(await hist(A)) === JSON.stringify(await hist(B))], [true, true]);

  // ── 7. 圏外で追加 → つながると自動で届く
  await A.ctx.setOffline(true); await add(A, 'm3', 1000, 50); const r3 = await A.evaluate(() => __demo.mine.sessions[__demo.mine.sessions.length - 1].id);
  await A.waitForTimeout(2500); check('7 圏外では届かず、記録は端末に残る', [(cloud(uid) || '').includes(r3.slice(-4)), (await recs(A)).includes(r3.slice(-4)), await pill(A)], [false, true, '未送信あり']);
  await A.ctx.setOffline(false); await A.evaluate(() => dispatchEvent(new Event('online')));
  await A.waitForFunction(() => __demo.syncState() === 'ok', null, { timeout: 8000 });
  check('7 つながると自動で届く', cloud(uid).includes(r3.slice(-4) + ':50'), true);

  // ── 8. 書き込みが重なったとき（読んでから書くまでの間に、ほかの端末が先に書いた）→ どちらも失わない
  await sync(B); await add(A, 'm1', 3000, 10); const before = M.calls.conflict;
  M.beforePatch = key => { const c = mock.body(key); c.sessions.push({ ...c.sessions[0], id: 'rRACE0001', createdAt: Date.now() + 5, plays: [{ ...c.sessions[0].plays[0], out: 42 }], history: undefined }); mock.setBody(key, JSON.parse(JSON.stringify(c))); };
  await sync(A);
  check('8 重なっても両方残る', [M.calls.conflict - before, (await recs(A)).includes('0001:42'), cloud(uid).includes('0001:42'), cloud(uid).includes(':10'), await recs(A) === cloud(uid)], [1, true, true, true, true]);

  // ── 9. 入力している最中にほかの端末の変更が届いても、入力欄は消えない
  await sync(B); await closeSheets(B); await B.click('#app [data-tab="add"]'); await B.waitForTimeout(250); await B.fill('#f-p-0-cash', '9000'); await B.focus('#f-p-0-out'); await B.keyboard.type('12');
  await add(A, 'm2', 1000, 77); await sync(A); await sync(B);
  check('9 入力中でもデータは入り、入力欄はそのまま', [(await recs(B)).includes(':77'), await B.evaluate(() => [document.activeElement.id, document.querySelector('#f-p-0-cash').value, document.querySelector('#f-p-0-out').value])], [true, ['f-p-0-out', '9,000', '12']]);
  await B.click('.sheet [data-act="closeSheet"]'); await B.waitForTimeout(200); await B.click('#screen [data-act="askDropDraft"]'); await B.click('[data-act="dropDraft"]'); await B.waitForTimeout(150);

  // ── 10. 上限額と条件も同期する
  await closeSheets(A); await A.click('#app [data-tab="more"]'); await A.click('#f-budget'); await A.waitForTimeout(80); await A.keyboard.press('Control+A'); await A.keyboard.type('65000'); await A.click('#app [data-tab="home"]'); check('10 欄の外を1回押せば画面が切り替わる', await A.evaluate(() => __demo.S.tab), 'home'); await sync(A); await sync(B);
  check('10 上限額', [await B.evaluate(() => __demo.S.budget), mock.body(uid).budget], [65000, 65000]);

  // ── 11. パスワード違い・登録済み・短いパスワードの表示
  const C = await device('C');
  await auth(C, 'a@example.com', 'wrongpw', false); const e1 = await C.evaluate(() => document.querySelector('.sheet .banner.err')?.textContent);
  await C.fill('#sy-pw', 'secret1'); await C.click('[data-act="sySignup"]'); await C.waitForTimeout(400); const e2 = await C.evaluate(() => document.querySelector('.sheet .banner.err')?.textContent);
  await C.fill('#sy-email', 'new@example.com'); await C.fill('#sy-pw', '123'); await C.click('[data-act="sySignup"]'); await C.waitForTimeout(400); const e3 = await C.evaluate(() => document.querySelector('.sheet .banner.err')?.textContent);
  await C.fill('#sy-email', 'a@example.com'); await C.click('[data-act="syReset"]'); await C.waitForTimeout(400); const e4 = await C.evaluate(() => document.querySelector('.sheet .banner:not(.err)')?.textContent);
  check('11 ログイン失敗の表示', [e1, (e2 || '').slice(0, 16), e3, (e4 || '').includes('メールを送りました'), M.resets, await C.evaluate(() => [__demo.sy.uid, __demo.db.sessions.length])], ['メールアドレスかパスワードが違います。', 'このメールアドレスは登録済みです', 'パスワードは6文字以上にしてください。', true, ['a@example.com'], ['', 0]]);

  // ── 12. すでに記録のある端末でログイン → 端末の記録とクラウドの記録を合わせる
  await closeSheets(C); await C.click('#app [data-tab="home"]'); await add(C, 'm1', 4000, 888);
  const nCloud = mock.body(uid).sessions.length; await auth(C, 'a@example.com', 'secret1', false);
  check('12 初回は足し合わせる', [(await recs(C)).includes(':888'), cloud(uid).includes(':888'), mock.body(uid).sessions.length, await recs(C) === cloud(uid)], [true, true, nCloud + 1, true]);

  // ── 13. ルールで許可されていないとき → 記録は無事で、理由が出る。直れば復帰する
  M.rulesDeny = true; await add(A, 'm1', 1000, 5); await sync(A);
  check('13 許可なし', [(await view(A)).state, (await view(A)).err, (await recs(A)).includes(':5'), await pill(A)], ['err', 'PERMISSION_DENIED', true, '同期できません']);
  M.rulesDeny = false; await sync(A); check('13 直れば復帰', [(await view(A)).state, cloud(uid).includes(':5')], ['ok', true]);

  // ── 14. ログインの期限切れ → 自動で更新して続ける。更新もできなければ、ログインし直しの案内
  const rf = M.calls.refresh; await A.evaluate(() => { __demo.sy.exp = 0; }); await sync(A);
  check('14 期限切れは自動で更新', [M.calls.refresh - rf, (await view(A)).state], [1, 'ok']);
  M.revoked.add(uid); await B.evaluate(() => { __demo.sy.exp = 0; }); const nB = (await recs(B)); await sync(B);
  check('14 更新できないときはログインし直し', [await B.evaluate(() => [__demo.sy.uid, __demo.sy.err, __demo.syncState()]), await recs(B) === nB], [['', 'RELOGIN', 'err'], true]);
  M.revoked.delete(uid); await auth(B, 'a@example.com', 'secret1', false); check('14 ログインし直すと元どおり', [(await view(B)).state, await recs(B) === cloud(uid)], ['ok', true]);

  // ── 15. クラウドの中身が壊れていたら、端末の記録には触らない
  const good = mock.body(uid), keep = await recs(A); mock.st.docs.get(uid).fields.body.stringValue = '{こわれた'; mock.setBody(uid, { v: 1, sessions: 'x' }); await sync(A);
  check('15 壊れたクラウドでは何もしない', [(await view(A)).err, await recs(A) === keep], ['BAD_REMOTE', true]);
  mock.setBody(uid, good); await sync(A); check('15 直れば復帰', (await view(A)).state, 'ok');

  // ── 16. バックアップから復元 → クラウドも復元した内容になる（復元に無い記録は消える）
  const backup = await A.evaluate(() => __demo.backupText()); await add(A, 'm1', 1000, 999); await sync(A); await sync(B);
  check('16 復元前', [(await recs(B)).includes(':999')], [true]);
  await closeSheets(A); await A.click('#app [data-tab="more"]'); await A.click('#screen [data-act="backup"]'); await A.waitForTimeout(200); await A.fill('#bk-in', backup); await A.click('[data-act="readPasted"]'); await A.waitForTimeout(200); await A.click('[data-act="doRestore"]'); await A.waitForTimeout(300);
  await sync(A); await sync(B);
  check('16 復元後', [(await recs(A)).includes(':999'), (await recs(B)).includes(':999'), await recs(A) === cloud(uid), await recs(B) === cloud(uid)], [false, false, true, true]);

  // ── 17. 「同期で書き換わる前の状態に戻す」
  const pre = await recs(B); await add(A, 'm1', 1000, 321); await sync(A); await sync(B); check('17 書き換わった', (await recs(B)).includes(':321'), true);
  await openSync(B); await B.click('[data-act="askSyRevert"]'); await B.click('[data-act="doSyRevert"]'); await B.waitForTimeout(200);
  check('17 戻る', await recs(B), pre);

  // ── 18. ログアウトしても端末の記録は残る。クラウドも変わらない
  const cl = cloud(uid); await openSync(A); await A.click('[data-act="askSyLogout"]'); await A.click('[data-act="doSyLogout"]'); await A.waitForTimeout(200); const kept = await recs(A);
  await closeSheets(A); await A.click('#app [data-tab="home"]'); await add(A, 'm1', 1000, 1); await A.waitForTimeout(2200);
  check('18 ログアウト', [await pill(A), kept !== '', cloud(uid).split(' ').some(x => x.endsWith(':1')), (await recs(A)).split(' ').some(x => x.endsWith(':1')), (await view(A)).state], ['この端末に保存', true, false, true, 'off']);

  // ── 19. 再読み込みしてもログインは続く
  await B.reload(); await B.waitForTimeout(900); await idle(B);
  check('19 再読み込み後もログイン中', [await B.evaluate(() => !!__demo.sy.uid), ['ok', 'pending', 'busy'].includes((await view(B)).state)], [true, true]);

  await A.screenshot({ path: path.join(root, 'shots', 'sync-A.png') }); await openSync(B); await B.screenshot({ path: path.join(root, 'shots', 'sync-on.png') }); await openSync(C); 
  check('ページのエラーなし', errs, []);
  console.log(bad ? `${bad} NG` : 'all ok', JSON.stringify(M.calls)); await b.close(); srv.close(); mock.srv.close(); process.exit(bad ? 1 : 0);
})().catch(e => { console.error('FAILED', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
