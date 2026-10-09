// 黒標準・カレンダー（正方形）・二重チェック・変更履歴の確認
const { chromium } = require('playwright'); const path = require('path'); const FS = require('./fontserver.js');
const root = path.join(__dirname, '..');
(async () => {
  const { srv, url } = await FS.start(); const b = await chromium.launch(); const errs = [];
  const c = await b.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 2 }); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
  const shot = n => p.screenshot({ path: path.join(root, 'shots', n + '.png') });
  await p.goto(url); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(500);
  console.log('1 DEFAULT', await p.evaluate(() => [document.documentElement.dataset.theme, getComputedStyle(document.querySelector('#app')).backgroundColor, getComputedStyle(document.querySelector('.hero .big .sg')).color, getComputedStyle(document.querySelector('.ledger .num.neg .sg') || document.body).color].join(' | ')));
  console.log('2 FLAGGED', await p.evaluate(() => { const m = Calc.auditAll(__demo.db.stores, __demo.db.sessions); return JSON.stringify(__demo.db.sessions.filter(x => m.get(x.id).issues.length).map(x => [x.date, m.get(x.id).issues.map(i => i.code).join('+')])); }), 'banner', await p.evaluate(() => document.querySelector('[data-act="auditSheet"]')?.textContent));
  await shot('q-home');
  await p.click('#app [data-act="auditSheet"]'); await p.waitForTimeout(250); await shot('q-audit');
  await p.click('.sheet [data-act="day"]'); await p.waitForTimeout(250); await p.evaluate(() => { const b = document.querySelector('.sh-body'); b.scrollTop = b.querySelector('.recon').offsetTop - 220; }); await shot('q-day-recon');
  await p.click('[data-act="closeSheet"]');
  // 変更履歴: 最新の記録（見本の履歴つき）を開き、さらに編集して履歴が増えること
  await p.click('#screen .list .item[data-act="day"]'); await p.waitForTimeout(250);
  await p.click('[data-act="toggleHist"]'); await p.waitForTimeout(100);
  console.log('3 HIST sample', await p.evaluate(() => document.querySelector('.hist')?.innerText.replace(/\n/g, ' / ')));
  await p.click('[data-act="editRec"]'); await p.waitForTimeout(250);
  const cash0 = await p.evaluate(() => document.querySelector('#f-p-0-cash').value);
  await p.click('[data-act="cashAdd"][data-i="0"][data-v="5000"]'); await p.fill('#f-p-0-out', '777'); await p.click('[data-act="save"]'); await p.waitForTimeout(250);
  await p.click('[data-act="toggleHist"]'); await p.waitForTimeout(100);
  console.log('4 HIST after edit', cash0, await p.evaluate(() => document.querySelector('.hist')?.innerText.replace(/\n/g, ' / ')), 'n', await p.evaluate(() => __demo.db.sessions[__demo.db.sessions.length - 1].history.length));
  await p.evaluate(() => { const b = document.querySelector('.sh-body'); b.scrollTop = 99999; }); await shot('q-day-hist');
  // 変更なしで保存しても履歴は増えない
  await p.click('[data-act="editRec"]'); await p.waitForTimeout(200); await p.click('[data-act="save"]'); await p.waitForTimeout(200);
  console.log('5 no-change save', await p.evaluate(() => __demo.db.sessions[__demo.db.sessions.length - 1].history.length));
  await p.click('[data-act="closeSheet"]');
  // 入力中の警告: 二重計上の疑い
  await p.click('#app [data-tab="add"]'); await p.waitForTimeout(250);
  await p.click('[data-act="pickMachine"][data-i="0"]'); await p.click('[data-act="chooseMachine"][data-id="m1"]');
  await p.fill('#f-p-0-cash', '10000'); await p.fill('#f-p-0-out', '800'); await p.click('[data-act="addPlay"]');
  await p.click('[data-act="pickMachine"][data-i="1"]'); await p.click('[data-act="chooseMachine"][data-id="m2"]');
  await p.fill('#f-p-1-cash', '10000'); await p.waitForTimeout(100);
  console.log('6 LIVE WARN', await p.evaluate(() => [...document.querySelectorAll('#entry-msgs .issue')].map(e => e.textContent)));
  await p.evaluate(() => { const b = document.querySelector('.sh-body'); b.scrollTop = 99999; }); await shot('q-entry-warn');
  await p.fill('#f-p-1-cash', '1500'); await p.click('#carry-1'); await p.waitForTimeout(100);
  console.log('7 LIVE WARN2', await p.evaluate(() => [...document.querySelectorAll('#entry-msgs .issue')].map(e => e.textContent)));
  await p.click('[data-act="closeSheet"]');
  // カレンダー: マスは正方形
  await p.click('#app [data-tab="cal"]'); await p.click('[data-act="calMove"][data-k="-1"]'); await p.waitForTimeout(150); await shot('q-cal-square');
  console.log('8 CAL', await p.evaluate(() => { const c = document.querySelector('.cal .c.win, .cal .c.lose').getBoundingClientRect(); const over = [...document.querySelectorAll('.cal .c')].filter(e => e.scrollHeight > e.clientHeight + 1 || [...e.children].some(k => k.getBoundingClientRect().bottom > e.getBoundingClientRect().bottom + 0.5)).length; return Math.round(c.width) + 'x' + Math.round(c.height) + ' overflowCells=' + over; }));
  await p.setViewportSize({ width: 375, height: 667 }); await p.waitForTimeout(150);
  console.log('9 CAL375', await p.evaluate(() => { const c = document.querySelector('.cal .c.win, .cal .c.lose').getBoundingClientRect(); const over = [...document.querySelectorAll('.cal .c')].filter(e => [...e.children].some(k => k.getBoundingClientRect().bottom > e.getBoundingClientRect().bottom + 0.5 || k.getBoundingClientRect().width > e.getBoundingClientRect().width)).length; return Math.round(c.width) + 'x' + Math.round(c.height) + ' overflowCells=' + over; }));
  await p.setViewportSize({ width: 402, height: 874 });
  await p.click('#app .lookseg [data-t="light"]'); await p.waitForTimeout(100); await shot('q-cal-square-white');
  await p.reload(); await p.waitForTimeout(400); console.log('10 PERSIST', await p.evaluate(() => [__demo.S.look, document.querySelectorAll('[data-act="calShape"]').length, 'calShape' in __demo.S].join(' ')));
  console.log('ERRORS', JSON.stringify(errs)); await b.close(); srv.close();
})();
