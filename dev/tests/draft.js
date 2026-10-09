// 入力途中の自動保存の確認。
// 打っている途中でアプリが閉じても、次に開いたとき続きから入力できること。
const { chromium } = require('playwright'); const path = require('path'); const http = require('http'); const fs = require('fs');
const root = path.join(__dirname, '..'); const DIST = path.join(root, 'dist'); const DKEY = 'dx7-shushi.draft.v1';
(async () => {
  const srv = http.createServer((q, r) => { const f = decodeURIComponent(q.url.split('?')[0]).replace(/^\/pachisuro\/?/, '') || 'index.html'; const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); r.end(fs.readFileSync(p)); });
  await new Promise(ok => srv.listen(0, ok)); const url = `http://localhost:${srv.address().port}/pachisuro/`;
  const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 402, height: 874 }, serviceWorkers: 'block' }); const p = await c.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); let bad = 0;
  const check = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) bad++; console.log(ok ? 'ok ' : 'NG ', name, ok ? '' : `\n     得た値 ${JSON.stringify(got)}\n     期待   ${JSON.stringify(want)}`); };
  const state = () => p.evaluate(k => ({ sheet: document.querySelector('.sheet h2')?.textContent || null, cash: document.querySelector('#f-p-0-cash')?.value ?? null, out: document.querySelector('#f-p-0-out')?.value ?? null, banner: !!document.querySelector('#screen [data-act="resumeDraft"]'), stored: !!localStorage.getItem(k), n: __demo.db.sessions.length }), DKEY);
  const reload = async () => { await p.reload(); await p.waitForTimeout(500); };
  const pick = async id => { await p.click('[data-act="pickMachine"][data-i="0"]'); await p.click(`[data-act="chooseMachine"][data-id="${id}"]`); };
  await p.goto(url); await p.waitForTimeout(500);

  // 1. 開いただけで何も打たずに閉じたら、何も残さない
  await p.click('#app [data-tab="add"]'); await p.waitForTimeout(400); await p.click('.sheet [data-act="closeSheet"]'); await p.waitForTimeout(400);
  check('1 開いて閉じただけなら残さない', await state(), { sheet: null, cash: null, out: null, banner: false, stored: false, n: 0 });

  // 2. 打っている途中で再読み込み → 入力画面が開いた状態で、打った内容が戻る
  await p.click('#app [data-tab="add"]'); await p.waitForTimeout(300); await pick('m1'); await p.fill('#f-p-0-cash', '5000'); await p.fill('#f-p-0-out', '300'); await p.click('[data-act="moreFields"]'); await p.fill('#f-memo', '朝イチ');
  await p.waitForTimeout(500); await reload();
  check('2 再読み込み後に続きから', await state(), { sheet: '実戦を記録', cash: '5,000', out: '300', banner: false, stored: true, n: 0 });
  check('2 機種・メモ', await p.evaluate(() => [__demo.S.draft?.plays[0].machineId, document.querySelector('#f-memo')?.value]), ['m1', '朝イチ']);

  // 3. 打った直後（待たずに）再読み込みしても残る
  await p.fill('#f-p-0-out', '777'); await reload();
  check('3 打った直後の再読み込み', (await state()).out, '777');

  // 4. 保存したら下書きは消える
  await p.click('[data-act="save"]'); await p.waitForTimeout(300);
  check('4 保存後', await state(), { sheet: null, cash: null, out: null, banner: false, stored: false, n: 1 });
  await reload(); check('4 保存後の再読み込みで開かない', (await state()).sheet, null);

  // 5. 新しい記録を打って「閉じる」→ 下書きは残り、ホームに案内が出る。再読み込みしても勝手には開かない
  await p.click('#app [data-tab="add"]'); await p.waitForTimeout(300); await pick('m2'); await p.fill('#f-p-0-cash', '3000'); await p.click('.sheet [data-act="closeSheet"]'); await p.waitForTimeout(400);
  check('5 閉じたあと', await state(), { sheet: null, cash: null, out: null, banner: true, stored: true, n: 1 });
  await reload(); check('5 再読み込みしても開かず、案内だけ', await state(), { sheet: null, cash: null, out: null, banner: true, stored: true, n: 1 });
  await p.click('#screen [data-act="resumeDraft"]'); await p.waitForTimeout(300);
  check('5 案内から続きを開く', [(await state()).sheet, (await state()).cash], ['実戦を記録', '3,000']);
  await p.click('.sheet [data-act="closeSheet"]'); await p.waitForTimeout(300); await p.click('#app [data-tab="add"]'); await p.waitForTimeout(300);
  check('5 ＋ボタンでも続きが開く', (await state()).cash, '3,000');
  await p.click('.sheet [data-act="closeSheet"]'); await p.waitForTimeout(300);

  // 6. 破棄（確認つき。「やめる」なら残る）
  await p.click('#screen [data-act="askDropDraft"]'); await p.click('[data-act="cancelConfirm"]'); await p.waitForTimeout(150);
  check('6 破棄をやめる', [(await state()).banner, (await state()).stored], [true, true]);
  await p.click('#screen [data-act="askDropDraft"]'); await p.click('[data-act="dropDraft"]'); await p.waitForTimeout(200);
  check('6 破棄', [(await state()).banner, (await state()).stored], [false, false]);

  // 7. 既存の記録の編集中に再読み込み → 編集画面が戻る。「閉じる」なら編集は取り消し（下書きも残さない）
  await p.click('#screen .list .item[data-act="day"]'); await p.waitForTimeout(250); await p.click('[data-act="editRec"]'); await p.waitForTimeout(250);
  await p.fill('#f-p-0-out', '900'); await p.waitForTimeout(400); await reload();
  check('7 編集中の再読み込み', [(await state()).sheet, (await state()).out, await p.evaluate(() => __demo.S.draft?.id === __demo.db.sessions[0].id)], ['実戦を編集', '900', true]);
  await p.click('.sheet [data-act="closeSheet"]'); await p.waitForTimeout(300);
  check('7 編集を閉じたら残さない', [(await state()).banner, (await state()).stored, await p.evaluate(() => __demo.db.sessions[0].plays[0].out)], [false, false, 777]);

  // 8. 壊れた下書きが入っていても起動できる
  await p.evaluate(k => localStorage.setItem(k, '{こわれた'), DKEY); await reload();
  check('8 壊れた下書きでも起動', [(await state()).sheet, (await state()).n], [null, 1]);

  check('ページのエラーなし', errs, []);
  console.log(bad ? `${bad} NG` : 'all ok'); await b.close(); srv.close(); process.exit(bad ? 1 : 0);
})();
