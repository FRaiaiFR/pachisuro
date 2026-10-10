// アプリ全体の動作確認（公開用のページ dist/ を相手に、ブラウザで操作する）。
//   前半: 記録がたくさん入った状態（tests/fixture.js のデータを先に入れておく）
//   後半: 何も入っていない状態（はじめて開いたとき）
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const H = require('./helper.js'), F = require('./fixture.js');
(async () => {
  const { srv, url } = await H.serve(); const b = await chromium.launch(); const check = H.checker(); const errs = [];
  const open = async (opt = {}) => {
    const c = await b.newContext({ viewport: { width: opt.w || 402, height: opt.h || 874 }, serviceWorkers: 'block', acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
    if (opt.data) await F.seed(c, opt.data); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.goto(url); await p.waitForTimeout(450); return p;
  };
  const n = p => p.evaluate(() => __demo.db.sessions.length);
  const overflow = p => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const today = (() => { const d = new Date(), z = x => String(x).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; })();

  // ════════ 前半: 記録が入っている状態 ════════
  const data = F.mine(); let p = await open({ data });
  check('1 開いたとき: 記録の件数・カード画像・右上の表示', await p.evaluate(() => [document.title, __demo.db.sessions.length, document.querySelector('#app .member img')?.naturalWidth, document.querySelector('#screen [data-pill]')?.textContent]), ['パチスロ収支', data.sessions.length, 856, 'この端末に保存']);
  check('1 サンプル表示・白版の切り替えが残っていない', await p.evaluate(() => [/サンプル|試作|デモ/.test(document.body.innerText), document.querySelectorAll('.lookseg, [data-act="theme"], [data-act="useSample"], [data-act="askMine"]').length, document.documentElement.dataset.theme || '', getComputedStyle(document.querySelector('#app')).backgroundColor]), [false, 0, '', 'rgb(12, 12, 12)']);
  await p.click('#app [data-tab="cal"]'); await p.click('[data-act="calMove"][data-k="-1"]'); await p.waitForTimeout(120);
  check('1 プラスとマイナスの数字が同じ色（先月の一覧で比べる）', await p.evaluate(() => { const c = q => [...new Set([...document.querySelectorAll(q)].map(e => getComputedStyle(e).color))]; return [c('#screen .list .num.pos .nv').length, c('#screen .list .num.neg .nv').length, c('#screen .list .num.pos .nv')[0] === c('#screen .list .num.neg .nv')[0]]; }), [1, 1, true]);
  await p.click('#app [data-tab="home"]');
  check('1 数字のフォントの指定', await p.evaluate(() => getComputedStyle(document.querySelector('.hero .big .nv')).fontFamily.split(',')[0].replace(/"/g, '')), 'Rajdhani');

  // 1b. アプリらしい手ざわり: ダブルタップで拡大しない／長押しでコピーや画像保存が出ない／端で画面が引っぱられない
  await p.click('#app [data-tab="more"]'); await p.waitForTimeout(120);
  const cs = (q, k) => p.evaluate(([q, k]) => [...document.querySelectorAll(q)].slice(0, 40).map(e => getComputedStyle(e)[k]).filter((v, i, a) => a.indexOf(v) === i).join('|'), [q, k]);
  check('1b ダブルタップで拡大しない指定が全部の要素に付いている', await cs('#app *', 'touchAction'), 'manipulation');
  check('1b 文字は長押しで選択されない。入力欄だけは選択できる', [await cs('body, #screen .card, #screen .note, #screen h1, #tabbar button', 'userSelect'), await cs('#f-budget', 'userSelect')], ['none', 'text']);
  check('1b 端までスクロールしても画面が引っぱられない', [await cs('html, body, #screen', 'overscrollBehaviorY')], ['none']);
  const css = fs.readFileSync(path.join(H.root, 'dist', 'index.html'), 'utf8');
  check('1b 長押しメニュー・画像のドラッグを止める指定がある', [/-webkit-touch-callout:none/.test(css), /-webkit-user-drag:none/.test(css)], [true, true]);
  check('1b 長押しメニュー（右クリック）は入力欄以外では出さない', await p.evaluate(() => { const f = el => { const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true }); el.dispatchEvent(e); return e.defaultPrevented; }; return [f(document.querySelector('#screen .card')), f(document.querySelector('#app .top h1')), f(document.querySelector('#f-budget'))]; }), [true, true, false]);
  check('1b すばやい2回タップ: 文字の上では2回目を止め、ボタンの連打は止めない', await p.evaluate(() => { const tap = el => { const e = new Event('touchend', { bubbles: true, cancelable: true }); el.dispatchEvent(e); return e.defaultPrevented; }; const t = document.querySelector('#screen .note'), b = document.querySelector('#tabbar button'); const r = [tap(t), tap(t), tap(b), tap(b)]; return r; }), [false, true, false, false]);
  await p.click('#app [data-tab="add"]'); await p.waitForTimeout(250);
  check('1b 入力画面も同じ（スクロール・メモ欄）', [await cs('.sh-body', 'overscrollBehaviorY'), await cs('.sheet input', 'userSelect'), await cs('.sheet *', 'touchAction')], ['none', 'text', 'manipulation']);
  await p.click('.sheet [data-act="closeSheet"]'); await p.waitForTimeout(150); await p.click('#app [data-tab="home"]');

  // 2. 各画面がはみ出さない
  const over = {}; for (const t of ['home', 'cal', 'stats', 'more']) { await p.click(`#app [data-tab="${t}"]`); await p.waitForTimeout(120); over[t] = await overflow(p); }
  check('2 横にはみ出さない（幅402）', over, { home: 0, cal: 0, stats: 0, more: 0 });
  await p.click('#app [data-tab="more"]'); check('2 「その他」にサンプル切り替え・外観の欄がない', await p.evaluate(() => [...document.querySelectorAll('#screen .card h2')].map(e => e.textContent).filter(t => /表示するデータ|外観/.test(t))), []);

  // 3. 記録入力: 2台、持ちメダルで移動、一部を預ける → 入力中の自動計算と、保存された値
  await p.click('#app [data-tab="add"]'); await p.waitForTimeout(300);
  await p.click('[data-act="save"]'); await p.waitForTimeout(100); check('3 空のまま保存は止める', [await n(p), (await p.$$('#entry-msgs .issue.error')).length > 0], [data.sessions.length, true]);
  await p.click('[data-act="pickMachine"][data-i="0"]'); await p.click('[data-act="chooseMachine"][data-id="m1"]'); await p.fill('#f-p-0-cash', '10000'); await p.fill('#f-p-0-out', '800');
  await p.click('[data-act="addPlay"]'); await p.click('[data-act="pickMachine"][data-i="1"]'); await p.fill('#mq', 'テスト新機種'); await p.waitForTimeout(60); await p.click('[data-act="newMachine"]');
  await p.click('#carry-1'); await p.fill('#f-p-1-out', '1337'); await p.fill('#f-deposit', '300'); await p.waitForTimeout(120);
  check('3 入力中の自動計算', await p.evaluate(() => [document.querySelector('#st-hand').textContent, document.querySelector('#f-cashOut').value, document.querySelector('#entry-res').textContent, document.querySelector('#pres-0').textContent, document.querySelector('#pres-1').textContent]),
    ['1,337枚', '20,700', '遊技収支（メダル評価込み）▲+16,700円うち現金 +10,700円', '投入 470枚・差枚 +330枚+6,000円', '投入 800枚・差枚 +537枚+10,740円']);
  await p.click('[data-act="save"]'); await p.waitForTimeout(250);
  const saved = await p.evaluate(() => { const d = __demo.db, s = d.sessions[d.sessions.length - 1], c = Calc.session(s); return { n: d.sessions.length, id: s.id, date: s.date, cashOut: s.cashOut, deposit: s.deposit, hand: c.hand, cashResult: c.cashResult, evalResult: c.evalResult, gap: c.gap, machine: d.machines.find(m => m.id === s.plays[1].machineId)?.name }; });
  check('3 保存された値', { ...saved, id: 0 }, { n: data.sessions.length + 1, id: 0, date: today, cashOut: 20700, deposit: 300, hand: 1337, cashResult: 10700, evalResult: 16700, gap: -40, machine: 'テスト新機種' });

  // 4. 削除（確認つき。消したあとは戻せない）。画面下のアナウンスは出ない
  await p.click('#app [data-tab="cal"]'); await p.click(`#screen [data-act="day"][data-date="${today}"]`); await p.waitForTimeout(250);
  await p.click(`[data-act="askDel"][data-id="${saved.id}"]`); const delMsg = await p.evaluate(() => document.querySelector('.dialog p').textContent); await p.click('[data-act="doDel"]'); await p.waitForTimeout(200);
  check('4 削除', [await n(p), delMsg, await p.evaluate(() => document.querySelectorAll('#toast, .toast, [data-act="undo"]').length)], [data.sessions.length, '削除したあとは戻せません。', 0]); await H.closeSheets(p);

  // 5. 貯メダル: 1日 470枚まで
  const lim = await p.evaluate(t => { const d = __demo.db, bal = Calc.balances(d.stores, d.sessions).s1, used = d.sessions.filter(s => s.date === t).reduce((a, s) => a + s.plays.reduce((x, y) => x + y.savedIn, 0), 0); return { bal, left: 470 - used }; }, today);
  await p.click('#app [data-tab="add"]'); await p.waitForTimeout(300); await p.click('[data-act="pickMachine"][data-i="0"]'); await p.click('[data-act="chooseMachine"][data-id="m1"]');
  check('5 使える枚数の表示', await p.evaluate(() => [document.querySelector('#sv-0').textContent, document.querySelector('#svl-0').textContent]), [`${Math.min(lim.bal, lim.left)}枚を使う`, `本日あと ${lim.left}枚（1日 470枚まで）`]);
  await p.fill('#f-p-0-savedIn', String(lim.left + 30)); await p.fill('#f-p-0-out', '100'); const n5 = await n(p); await p.click('[data-act="save"]'); await p.waitForTimeout(150);
  check('5 上限を超えると保存できない', [await n(p), await p.evaluate(() => [...document.querySelectorAll('#entry-msgs .issue.error')].some(e => /470/.test(e.textContent)))], [n5, true]);
  await p.evaluate(() => { document.querySelector('.sh-body').scrollTop = 0; }); await p.click('#sv-0'); await p.waitForTimeout(120);
  check('5 「◯枚を使う」を押すと上限ちょうどが入る', await p.evaluate(() => [document.querySelector('#f-p-0-savedIn').value, document.querySelector('#svl-0').textContent]), [String(Math.min(lim.bal, lim.left)), `本日あと ${lim.left - Math.min(lim.bal, lim.left)}枚（1日 470枚まで）`]);
  await p.click('[data-act="save"]'); await p.waitForTimeout(250); check('5 保存できる', await n(p), n5 + 1);

  // 6. 二重チェックと変更履歴
  const flagged = await p.evaluate(() => { const m = Calc.auditAll(__demo.db.stores, __demo.db.sessions); return __demo.db.sessions.filter(x => m.get(x.id).issues.length).map(x => m.get(x.id).issues.map(i => i.code).join('+')); });
  await p.click('#app [data-tab="home"]'); check('6 換金額の差を見つけて、ホームに案内を出す', [flagged.includes('cashout'), /二重チェックで確認したい記録が \d+件/.test(await p.evaluate(() => document.querySelector('#screen [data-act="auditSheet"]')?.textContent || ''))], [true, true]);
  await p.click('#screen [data-act="auditSheet"]'); await p.waitForTimeout(250); await p.click('.sheet [data-act="day"]'); await p.waitForTimeout(250);
  check('6 日別の画面に照合の欄が出る', await p.evaluate(() => !!document.querySelector('.sheet .recon')), true); await H.closeSheets(p);
  const hid = data.sessions[data.sessions.length - 1].id, hdate = data.sessions[data.sessions.length - 1].date;
  await p.click('#app [data-tab="cal"]'); if (hdate.slice(0, 7) !== today.slice(0, 7)) await p.click('[data-act="calMove"][data-k="-1"]'); await p.click(`#screen [data-act="day"][data-date="${hdate}"]`); await p.waitForTimeout(250);
  await p.click(`[data-act="toggleHist"][data-id="${hid}"]`); await p.waitForTimeout(100); check('6 変更履歴が読める', /現金投資：[\d,]+円 → [\d,]+円/.test(await p.evaluate(() => document.querySelector('.hist')?.innerText || '')), true);
  const hlen = () => p.evaluate(i => __demo.db.sessions.find(s => s.id === i).history.length, hid);
  await p.click(`[data-act="editRec"][data-id="${hid}"]`); await p.waitForTimeout(250); await p.click('[data-act="cashAdd"][data-i="0"][data-v="5000"]'); await p.fill('#f-p-0-out', '777'); await p.click('[data-act="save"]'); await p.waitForTimeout(250); const h2 = await hlen();
  await p.click(`[data-act="editRec"][data-id="${hid}"]`); await p.waitForTimeout(200); await p.click('[data-act="save"]'); await p.waitForTimeout(200);
  check('6 編集すると履歴が1件増え、変更なしの保存では増えない', [h2, await hlen()], [2, 2]); await H.closeSheets(p);
  await p.click('#app [data-tab="add"]'); await p.waitForTimeout(250); if (await p.$('.dialog')) await p.click('[data-act="cancelConfirm"]');
  await p.click('[data-act="pickMachine"][data-i="0"]'); await p.click('[data-act="chooseMachine"][data-id="m1"]'); await p.fill('#f-p-0-cash', '10000'); await p.fill('#f-p-0-out', '800'); await p.click('[data-act="addPlay"]');
  await p.click('[data-act="pickMachine"][data-i="1"]'); await p.click('[data-act="chooseMachine"][data-id="m2"]'); await p.fill('#f-p-1-cash', '10000'); await p.waitForTimeout(120);
  const w1 = await p.evaluate(() => [...document.querySelectorAll('#entry-msgs .issue')].map(e => e.textContent).join(' '));
  await p.fill('#f-p-1-cash', '1500'); await p.click('#carry-1'); await p.waitForTimeout(120); const w2 = await p.evaluate(() => [...document.querySelectorAll('#entry-msgs .issue')].map(e => e.textContent).join(' '));
  check('6 入力中の警告（二重計上の疑い・1,000円単位でない）', [/メダルが800枚残ったまま、現金で投資/.test(w1), /1,000円単位ではありません/.test(w2)], [true, true]);
  await p.click('.sheet [data-act="closeSheet"]'); await p.waitForTimeout(200); await p.click('#app [data-tab="home"]'); await p.click('#screen [data-act="askDropDraft"]'); await p.click('[data-act="dropDraft"]'); await p.waitForTimeout(150);

  // 6b. 機種を一覧から削除する（使っていない機種・記録で使っている機種）
  const tmid = await p.evaluate(() => __demo.db.machines.find(m => m.name === 'テスト新機種').id);
  const mnames = () => p.evaluate(() => [...document.querySelectorAll('#screen .list .item .tt')].map(e => e.textContent));
  await p.click('#app [data-tab="more"]'); await p.waitForTimeout(150); const hadTest = (await mnames()).includes('テスト新機種');
  await p.click(`#screen [data-act="askDelMachine"][data-id="${tmid}"]`); const m1msg = await p.evaluate(() => document.querySelector('.dialog p').textContent); await p.click('[data-act="doDelMachine"]'); await p.waitForTimeout(150);
  check('6b 使っていない機種の削除', [hadTest, (await mnames()).includes('テスト新機種'), m1msg], [true, false, '機種を選ぶ一覧から消えます。同じ名前を追加し直せば、また選べます。']);
  const used5 = await p.evaluate(() => __demo.db.sessions.filter(s => s.plays.some(x => x.machineId === 'm5')).length);
  await p.click('#screen [data-act="askDelMachine"][data-id="m5"]'); const m5msg = await p.evaluate(() => document.querySelector('.dialog p').textContent); await p.click('[data-act="doDelMachine"]'); await p.waitForTimeout(150);
  check('6b 記録で使っている機種の削除: 一覧から消えるが、記録と集計には名前が残る', [used5 > 0, m5msg.startsWith(`この機種を使った記録 ${used5}件は、機種名つきでそのまま残ります。`), (await mnames()).includes('マイジャグラーV'),
    await p.evaluate(() => __demo.db.sessions.filter(s => s.plays.some(x => x.machineId === 'm5')).length), await p.evaluate(() => Calc.byMachine(__demo.db.sessions).some(r => r.id === 'm5'))], [true, true, false, used5, true]);
  await p.click('#app [data-tab="stats"]'); await p.click('[data-p="all"]'); await p.waitForTimeout(150); check('6b 分析の機種別には名前が出る', await p.evaluate(() => document.querySelector('#screen').innerText.includes('マイジャグラーV')), true);

  // 6c. 機種を選ぶ画面: 削除した機種は出ない。打った文字から正式名称の候補が出る
  const rows = () => p.evaluate(() => ({ own: [...document.querySelectorAll('#mlist .mrow:not(.cat):not(.new) b')].map(e => e.textContent), cat: [...document.querySelectorAll('#mlist .mrow.cat b')].map(e => e.textContent), add: document.querySelector('#mlist .mrow.new')?.innerText.replace(/\n/g, '｜') || '' }));
  await p.click('#app [data-tab="add"]'); await p.waitForTimeout(250); await p.click('[data-act="pickMachine"][data-i="0"]'); await p.waitForTimeout(100);
  const r0 = await rows(); check('6c 削除した機種は選ぶ一覧に出ない', [r0.own.includes('マイジャグラーV'), r0.own.includes('テスト新機種'), r0.own.includes('スマスロ北斗の拳'), r0.cat.length], [false, false, true, 0]);
  await p.fill('#mq', 'ほくと'); await p.waitForTimeout(80); const r1 = await rows(); check('6c 略称で打っても、持っている機種が出る', [r1.own, r1.cat], [['スマスロ北斗の拳'], []]);
  await p.fill('#mq', 'まいじゃぐ'); await p.waitForTimeout(80); const r2 = await rows(); check('6c 一覧にない機種は、正式名称の候補が出る', [r2.own, r2.cat, r2.add], [[], ['マイジャグラーV'], '「まいじゃぐ」をこの名前のまま追加｜候補に当てはまるものがないとき']);
  await p.screenshot({ path: path.join(H.root, 'shots', 'app-picker.png') });
  await p.fill('#mq', 'ゴッドイーター'); await p.waitForTimeout(80); const r3 = await rows(); check('6c 候補がないときは、そのままの名前で追加できる', [r3.own, r3.cat, r3.add], [[], [], '「ゴッドイーター」をこの名前のまま追加｜正式名称の候補は見つかりませんでした']);
  await p.fill('#mq', 'まいじゃぐ'); await p.waitForTimeout(80); await p.click('#mlist .mrow.cat'); await p.waitForTimeout(150);
  check('6c 候補を選ぶと、正式名称で一覧に戻り、その台に入る', await p.evaluate(() => [__demo.S.draft.plays[0].machineId, __demo.db.machines.filter(m => m.name === 'マイジャグラーV').length, !!__demo.db.machines.find(m => m.id === 'm5').gone, !!document.querySelector('#mlist')]), ['m5', 1, false, false]);
  await p.click('.sheet [data-act="closeSheet"]'); await p.waitForTimeout(200); await p.click('#app [data-tab="home"]'); await p.click('#screen [data-act="askDropDraft"]'); await p.click('[data-act="dropDraft"]'); await p.waitForTimeout(150);
  await p.click('#app [data-tab="more"]'); await p.waitForTimeout(150); check('6c 「その他」の機種一覧にも戻っている', (await mnames()).includes('マイジャグラーV'), true); await p.screenshot({ path: path.join(H.root, 'shots', 'app-machines.png') });

  // 7. カレンダーのマスは正方形（幅402と幅375）
  const cal = async () => p.evaluate(() => { const cs = [...document.querySelectorAll('.cal .c')], r = (cs.find(e => e.matches('.win,.lose')) || cs[10]).getBoundingClientRect(); return [Math.abs(r.width - r.height) < 0.6, cs.filter(e => [...e.children].some(k => k.getBoundingClientRect().bottom > e.getBoundingClientRect().bottom + 0.5 || k.getBoundingClientRect().width > e.getBoundingClientRect().width + 0.5)).length]; });
  await p.click('#app [data-tab="cal"]'); await p.click('[data-act="calMove"][data-k="-1"]'); await p.waitForTimeout(150); const c402 = await cal();
  await p.setViewportSize({ width: 375, height: 667 }); await p.waitForTimeout(150); check('7 カレンダー', [c402, await cal(), await overflow(p)], [[true, 0], [true, 0], 0]);
  await p.screenshot({ path: path.join(H.root, 'shots', 'app-cal.png') }); await p.setViewportSize({ width: 402, height: 874 }); await p.click('#app [data-tab="home"]'); await p.waitForTimeout(150); await p.screenshot({ path: path.join(H.root, 'shots', 'app-home.png') });
  await p.click('#app [data-tab="more"]'); await p.waitForTimeout(150); await p.screenshot({ path: path.join(H.root, 'shots', 'app-more.png') });

  // 8. PC の幅では、端末の枠を画面の中央に出す
  const d = await open({ w: 1280, h: 900, data }); check('8 PC表示', await d.evaluate(() => { const r = document.querySelector('.device').getBoundingClientRect(); return [Math.abs((r.left + r.right) / 2 - innerWidth / 2) < 2, document.documentElement.scrollWidth - innerWidth, !!document.querySelector('.notes')]; }), [true, 0, false]);
  await d.screenshot({ path: path.join(H.root, 'shots', 'app-desktop.png') });

  // ════════ 後半: 何も入っていない状態 ════════
  p = await open();
  check('9 はじめて開いたとき', await p.evaluate(() => [__demo.db.sessions.length, document.querySelector('#screen .empty b')?.textContent, document.querySelector('#screen [data-pill]')?.textContent, __demo.db.machines.length, __demo.db.stores[0].lendPer1000, document.querySelector('#app .member img')?.naturalWidth]), [0, 'まだ記録がありません', 'この端末に保存', 6, 47, 856]);
  await p.screenshot({ path: path.join(H.root, 'shots', 'app-empty.png') });
  await H.add(p, 'm2', 3000, 400, { depositAll: true }); await H.add(p, 'm2', 8000, 0);
  await p.click('#app [data-tab="more"]'); await p.click('#f-budget'); await p.waitForTimeout(80); await p.keyboard.press('Control+A'); await p.keyboard.type('60000'); await p.click('#app [data-tab="home"]');
  await p.reload(); await p.waitForTimeout(450);
  check('9 再読み込みしても記録と上限額が残る', await p.evaluate(() => [__demo.db.sessions.length, Calc.balances(__demo.db.stores, __demo.db.sessions).s1, __demo.S.budget]), [2, 400, 60000]);

  // 10. バックアップ: ファイルに保存・テキストをコピー → 1件足す → 復元で2件に戻る → 元に戻すで3件
  await p.click('#app [data-tab="more"]'); await p.click('#screen [data-act="backup"]'); await p.waitForTimeout(250);
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 8000 }), p.click('[data-act="exportFile"]')]); await p.waitForTimeout(150); const bkInfo = await p.evaluate(() => document.querySelector('#bk-info')?.textContent || ''); const file = path.join(H.root, 'shots', dl.suggestedFilename()); await dl.saveAs(file); const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  await p.click('[data-act="copyBackup"]'); await p.waitForTimeout(150); const clip = await p.evaluate(() => navigator.clipboard.readText());
  check('10 書き出し', [/^dx7-shushi-backup-\d{8}-\d{4}\.json$/.test(dl.suggestedFilename()), j.app, j.data.sessions.length, j.data.stores[0].cardDefault, JSON.parse(clip).data.sessions.length, await p.evaluate(() => !!__demo.store.backupAt), bkInfo.length > 0, await p.evaluate(() => /コピーしました/.test(document.querySelector('#bk-info')?.textContent || ''))], [true, 'dx7-shushi', 2, true, 2, true, true, true]);
  await H.add(p, 'm2', 1000, 0); await p.click('#app [data-tab="more"]'); await p.click('#screen [data-act="backup"]'); await p.waitForTimeout(200);
  await p.fill('#bk-in', 'これはバックアップではない'); await p.click('[data-act="readPasted"]'); await p.waitForTimeout(100); const bad1 = await p.evaluate(() => document.querySelector('.sheet .banner.err')?.textContent);
  await p.fill('#bk-in', '{"app":"other","format":1,"data":{}}'); await p.click('[data-act="readPasted"]'); await p.waitForTimeout(100); const bad2 = await p.evaluate(() => document.querySelector('.sheet .banner.err')?.textContent);
  check('10 バックアップでないものは読まない', [bad1, bad2, await n(p)], ['読み込めませんでした。バックアップの内容が最初から最後まで入っているか確認してください。', 'このアプリのバックアップではありません。', 3]);
  await p.fill('#bk-in', clip); await p.click('[data-act="readPasted"]'); await p.waitForTimeout(150); const conf = await p.evaluate(() => document.querySelector('.dialog p').textContent);
  await p.click('[data-act="doRestore"]'); await p.waitForTimeout(200);
  check('10 復元', [/記録 2件）を読み込みます。いまの記録 3件は置き換えられます。置き換えたあとは戻せません。/.test(conf), await n(p)], [true, 2]);
  const p2 = await open(); await p2.click('#app [data-tab="more"]'); await p2.click('#screen [data-act="backup"]'); await p2.setInputFiles('#bk-file', file); await p2.waitForTimeout(250); await p2.click('[data-act="doRestore"]'); await p2.waitForTimeout(200); await p2.reload(); await p2.waitForTimeout(450);
  check('10 別の端末でファイルから復元', await p2.evaluate(() => [__demo.db.sessions.length, Calc.balances(__demo.db.stores, __demo.db.sessions).s1, document.querySelector('#app .member img')?.naturalWidth]), [2, 400, 856]);

  // 11. すべて消す（確認つき）
  await p.click('#app [data-tab="more"]'); await p.click('#screen [data-act="askWipe"]'); const wmsg = await p.evaluate(() => document.querySelector('.dialog p').textContent); await p.click('[data-act="doWipe"]'); await p.waitForTimeout(200);
  check('11 すべて消す', [await n(p), /消したあとは戻せません/.test(wmsg), await p.evaluate(() => __demo.db.machines.length)], [0, true, 6]);

  // 12. 保存データが壊れていたら、上書きせず別名で残して、空の状態で開く
  await p.evaluate(k => localStorage.setItem(k, '{こわれた'), F.KEY); await p.reload(); await p.waitForTimeout(450);
  check('12 壊れた保存データ', await p.evaluate(k => [__demo.db.sessions.length, localStorage.getItem(k + '.broken'), /読み込めなかった/.test(document.querySelector('#broken-note')?.textContent || '')], F.KEY), [0, '{こわれた', true]);

  // 13. 以前の版（サンプル表示つき）で保存したデータも、そのまま読める
  const old = await b.newContext({ viewport: { width: 402, height: 874 }, serviceWorkers: 'block' });
  await old.addInitScript(([k, body]) => { if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', '1'); localStorage.setItem(k, body); } }, [F.KEY, JSON.stringify({ savedAt: 1, backupAt: 0, body: JSON.stringify({ v: 1, mode: 'sample', settings: { budget: 70000, look2: 'light' }, mine: { ...data, sessions: data.sessions.slice(0, 5) } }) })]);
  const po = await old.newPage(); po.on('pageerror', e => errs.push(e.message)); await po.goto(url); await po.waitForTimeout(450);
  check('13 以前の版のデータ', await po.evaluate(() => [__demo.db.sessions.length, __demo.S.budget, getComputedStyle(document.querySelector('#app')).backgroundColor]), [5, 70000, 'rgb(12, 12, 12)']);
  const old2 = await b.newContext({ viewport: { width: 402, height: 874 }, serviceWorkers: 'block' });
  await old2.addInitScript(([k, body]) => { if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', '1'); localStorage.setItem(k, body); } }, [F.KEY, JSON.stringify({ savedAt: 1, backupAt: 0, body: JSON.stringify({ v: 1, mode: 'sample', settings: { budget: 80000, look2: 'dark' }, mine: null }) })]);
  const po2 = await old2.newPage(); po2.on('pageerror', e => errs.push(e.message)); await po2.goto(url); await po2.waitForTimeout(450);
  check('13 サンプルだけ見ていた端末は、空の状態から始まる', await po2.evaluate(() => [__demo.db.sessions.length, document.querySelector('#screen .empty b')?.textContent]), [0, 'まだ記録がありません']);

  // 14. 入力画面: 貯メダル使用・遊技時間・経費・メモが最初から出ている。47枚ずつ数えるボタン、持ちメダル使用、タイマー
  const q = await open(); const ev = f => q.evaluate(f); const val = id => q.evaluate(i => document.querySelector(i)?.value ?? null, id);
  const txt = id => q.evaluate(i => document.querySelector(i)?.textContent ?? null, id); const dis = id => q.evaluate(i => document.querySelector(i)?.disabled ?? null, id);
  await q.click('#app [data-tab="add"]'); await q.waitForTimeout(300);
  check('14 最初から出ている欄', await ev(() => ['#f-p-0-cash', '#f-p-0-savedIn', '#f-p-0-out', '#f-p-0-minutes', '#f-expense', '#f-memo', '#tm-0', '#f-p-0-carryIn', '[data-act="moreFields"]'].map(i => { const e = document.querySelector(i); return !!e && e.offsetParent !== null; })), [true, true, true, true, true, true, true, false, false]);
  check('14 欄の並び（現金 → 貯メダル → 終了時 → 遊技時間）', await ev(() => [...document.querySelectorAll('.pcard')[0].querySelectorAll('.nf > span:first-child')].map(e => e.textContent)), ['現金投資', '貯メダル使用', '終了時の枚数', '遊技時間']);
  await q.click('[data-act="pickMachine"][data-i="0"]'); await q.click('[data-act="chooseMachine"][data-id="m1"]');
  check('14 +47 を押す前', [await val('#f-p-0-savedIn'), await txt('#savedIn-n-0'), await dis('#savedIn-dn-0'), await dis('#savedIn-up-0'), await txt('#savedIn-up-0')], ['', '', true, false, '+47']);
  for (let i = 0; i < 3; i++) await q.click('#savedIn-up-0');
  check('14 +47 を3回', [await val('#f-p-0-savedIn'), await txt('#savedIn-n-0'), await txt('#svl-0'), await ev(() => __demo.S.draft.plays[0].savedIn)], ['141', '3回', '本日あと 329枚（1日 470枚まで）', 141]);
  await q.click('#savedIn-dn-0'); check('14 −47 で1回分戻る', [await val('#f-p-0-savedIn'), await txt('#savedIn-n-0')], ['94', '2回']);
  for (let i = 0; i < 8; i++) await q.click('#savedIn-up-0');
  check('14 10回（470枚）で止まる', [await val('#f-p-0-savedIn'), await txt('#savedIn-n-0'), await dis('#savedIn-up-0'), await txt('#svl-0')], ['470', '10回', true, '本日あと 0枚（1日 470枚まで）']);
  await q.fill('#f-p-0-savedIn', '100'); check('14 手で打った半端な枚数は回数を出さない', [await txt('#savedIn-n-0'), await dis('#savedIn-up-0')], ['', false]);
  await q.fill('#f-p-0-savedIn', '470'); await q.fill('#f-p-0-cash', '10000'); await q.fill('#f-p-0-out', '800');

  // 持ちメダル使用: 2台目から。貯メダル使用のすぐ下。その日に出したメダルなので、1日の上限には数えない
  await q.click('[data-act="addPlay"]'); await q.click('[data-act="pickMachine"][data-i="1"]'); await q.click('[data-act="chooseMachine"][data-id="m2"]');
  check('14 2台目の欄の並び', await ev(() => [...document.querySelectorAll('.pcard')[1].querySelectorAll('.nf > span:first-child')].map(e => e.textContent)), ['現金投資', '貯メダル使用', '持ちメダル使用', '終了時の枚数', '遊技時間']);
  check('14 持ちメダルの案内', [await txt('#cyl-1'), await txt('#carry-1'), await dis('#carryIn-up-1'), await dis('#savedIn-up-1')], ['前の台までの手元 800枚・1日の上限には数えません', '全部（800枚）', false, true]);
  await q.click('#carryIn-up-1'); await q.click('#carryIn-up-1'); check('14 持ちメダル +47 を2回', [await val('#f-p-1-carryIn'), await txt('#carryIn-n-1')], ['94', '2回']);
  await q.click('#carry-1'); check('14 持ちメダル 全部', [await val('#f-p-1-carryIn'), await dis('#carryIn-up-1'), await ev(() => document.querySelector('#carry-1').hidden)], ['800', true, true]);
  await q.fill('#f-p-1-out', '1200'); await q.waitForTimeout(80);
  check('14 貯メダル470枚＋持ちメダル800枚でもエラーにならない', await ev(() => { const s = __demo.S.draft; return [document.querySelector('#st-hand').textContent, document.querySelectorAll('#entry-msgs .issue.error').length, s.plays[0].savedIn, s.plays[1].carryIn]; }), ['1,200枚', 0, 470, 800]);
  await q.screenshot({ path: path.join(H.root, 'shots', 'entry-fields.png') });

  // タイマー: 開始 → 計測中は分が自動で増える → 終了で確定。アプリを閉じても続く
  await ev(() => { document.querySelector('.sh-body').scrollTop = 0; });
  check('14 タイマー: 押す前', [await txt('#tm-0'), await txt('#tml-0'), await ev(() => document.querySelector('#f-p-0-minutes').readOnly)], ['開始', 'タイマー', false]);
  await q.click('#tm-0'); await q.waitForTimeout(60);
  check('14 タイマー: 開始', [await txt('#tm-0'), /^\d{1,2}:\d\d 開始・計測中 0:00:0\d$/.test(await txt('#tml-0')), await ev(() => document.querySelector('#f-p-0-minutes').readOnly), await ev(() => typeof __demo.S.draft.plays[0].t0)], ['終了', true, true, 'number']);
  await ev(() => { __demo.S.draft.plays[0].t0 -= 83 * 60000; }); await q.waitForTimeout(1150);      // 83分たったことにする
  check('14 タイマー: 計測中は1秒ごとに進む', [await val('#f-p-0-minutes'), /計測中 1:23:0\d$/.test(await txt('#tml-0'))], ['83', true]);
  await q.screenshot({ path: path.join(H.root, 'shots', 'entry-timer.png') });
  await q.reload(); await q.waitForTimeout(500);
  check('14 タイマー: 読み込み直しても計測が続いている', [await txt('.sheet h2'), await txt('#tm-0'), await val('#f-p-0-minutes'), await val('#f-p-0-savedIn'), await val('#f-p-1-carryIn')], ['実戦を記録', '終了', '83', '470', '800']);
  await q.click('#tm-1'); await q.waitForTimeout(60);
  check('14 タイマー: 次の台で開始すると、前の台は止まって分が確定する', await ev(() => { const s = __demo.S.draft.plays; return [s[0].minutes, 't0' in s[0], document.querySelector('#tm-0').textContent, document.querySelector('#tml-0').textContent, document.querySelector('#f-p-0-minutes').readOnly, document.querySelector('#tm-1').textContent, typeof s[1].t0]; }), [83, false, '再開', 'タイマー（続きの時間を足す）', false, '終了', 'number']);
  await ev(() => { __demo.S.draft.plays[1].t0 -= 40 * 60000; }); await q.click('#tm-1'); await q.waitForTimeout(60);
  check('14 タイマー: 終了', [await val('#f-p-1-minutes'), await txt('#tm-1'), await ev(() => 't0' in __demo.S.draft.plays[1])], ['40', '再開', false]);
  await q.click('#tm-1'); await ev(() => { __demo.S.draft.plays[1].t0 -= 10 * 60000; }); await q.waitForTimeout(1150);
  check('14 タイマー: 再開すると続きに足す', await val('#f-p-1-minutes'), '50');
  await q.fill('#f-p-0-minutes', '90'); check('14 止まっている台の分は手で直せる', await ev(() => __demo.S.draft.plays[0].minutes), 90);
  await q.click('.sheet [data-act="closeSheet"]'); await q.waitForTimeout(250);
  check('14 閉じてもタイマーは続き、ホームに出る', /タイマー計測中/.test(await txt('#screen [data-act="resumeDraft"]')), true);
  await q.click('#screen [data-act="resumeDraft"]'); await q.waitForTimeout(300);
  await q.click('[data-act="save"]'); await q.waitForTimeout(300);                                 // 計測中のまま保存 → その時点までの分で保存する
  check('14 計測中のまま保存', await ev(() => { const s = __demo.db.sessions[0]; return [__demo.db.sessions.length, s.plays.map(p => p.minutes), s.plays.some(p => 't0' in p), s.plays[0].savedIn, s.plays[1].carryIn, Calc.session(s).minutes, localStorage.getItem('dx7-shushi.draft.v1')]; }), [1, [90, 50], false, 470, 800, 140, null]);
  // 過去の日付の記録にはタイマーを出さない。分は手で打てる
  await q.click('#app [data-tab="add"]'); await q.waitForTimeout(300); const y = await ev(() => { const d = new Date(Date.now() - 864e5), z = x => String(x).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; });
  check('14 今日の日付ではタイマーが出る', await ev(() => document.querySelector('#tm-0').hidden), false);
  await q.fill('#f-date', y); await q.waitForTimeout(80);
  check('14 過去の日付ではタイマーを出さない', [await ev(() => document.querySelector('#tm-0').hidden), await txt('#tml-0'), await ev(() => document.querySelector('#f-p-0-minutes').readOnly)], [true, '', false]);
  check('14 はみ出さない', await overflow(q), 0);

  check('ページのエラーなし', errs, []);
  const code = check.done(); await b.close(); srv.close(); process.exit(code);
})().catch(e => { console.error('FAILED', e.message.split('\n').slice(0, 8).join('\n')); process.exit(1); });
