const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
fs.writeFileSync(path.join(root, 'shots/_wrapped.html'), `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${fs.readFileSync(path.join(root, 'index.html'), 'utf8')}</body></html>`);
(async () => {
  const b = await chromium.launch(); const errs = [];
  const mk = async (w, h, scheme) => { const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, colorScheme: scheme }); const p = await c.newPage(); p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL/.test(m.text())) errs.push(m.text()); }); p.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); await p.goto('file://' + path.join(root, 'shots/_wrapped.html')); await p.waitForTimeout(400); return p; };
  const shot = (p, n) => p.screenshot({ path: path.join(root, 'shots', n + '.png') });
  let p = await mk(402, 874, 'dark');
  console.log('CARD', await p.evaluate(() => { const im = document.querySelector('#app .member img'); return im ? [im.complete, im.naturalWidth, im.naturalHeight, Math.round(im.getBoundingClientRect().width)] : null; }));
  console.log('STORES', await p.evaluate(() => JSON.stringify(window.__demo.db.stores.map(({ name, lendPer1000, exchX10, dailyLimit }) => ({ name, lendPer1000, exchX10, dailyLimit })))));
  console.log('MAXSAVED/day', await p.evaluate(() => { const m = {}; for (const s of window.__demo.db.sessions) m[s.date] = (m[s.date] || 0) + Calc.session(s).savedIn; return Math.max(...Object.values(m)); }), 'BAL', await p.evaluate(() => JSON.stringify(Calc.balances(window.__demo.db.stores, window.__demo.db.sessions))));
  await shot(p, 'n-home');
  await p.click('#app .member'); await p.waitForTimeout(300); await shot(p, 'n-card');
  await p.evaluate(() => { document.querySelector('.sh-body').scrollTop = 420; }); await shot(p, 'n-card2');
  await p.click('.sheet [data-act="editStore"]'); await p.waitForTimeout(300); await shot(p, 'n-edit');
  await p.click('[data-act="closeStore"]'); await p.click('[data-act="closeSheet"]');
  // 記録入力: 貯メダルの上限
  await p.click('#app [data-tab="add"]'); await p.waitForTimeout(300);
  await p.click('[data-act="pickMachine"][data-i="0"]'); await p.click('[data-act="chooseMachine"][data-id="m1"]');
  console.log('CHIP', await p.evaluate(() => [document.querySelector('#sv-0').textContent, document.querySelector('#svl-0').textContent]));
  await p.fill('#f-p-0-savedIn', '500'); await p.fill('#f-p-0-out', '100'); await p.click('[data-act="save"]'); await p.waitForTimeout(150);
  console.log('LIMIT ERR', await p.evaluate(() => [...document.querySelectorAll('#entry-msgs .banner')].map(e => e.textContent)));
  await shot(p, 'n-entry-limit');
  const n0 = await p.evaluate(() => window.__demo.db.sessions.length);
  await p.evaluate(() => { document.querySelector('.sh-body').scrollTop = 0; }); await p.click('#sv-0'); await p.waitForTimeout(100);
  console.log('AFTER CHIP', await p.evaluate(() => [document.querySelector('#f-p-0-savedIn').value, document.querySelector('#svl-0').textContent, document.querySelector('#entry-res').textContent]));
  await shot(p, 'n-entry');
  await p.click('[data-act="save"]'); await p.waitForTimeout(200);
  console.log('SAVED', n0, '->', await p.evaluate(() => window.__demo.db.sessions.length));
  // 同じ日にもう1件: 残り枠が0のはず
  await p.click('#app [data-tab="add"]'); await p.waitForTimeout(300);
  console.log('2nd CHIP', await p.evaluate(() => [document.querySelector('#sv-0').hidden, document.querySelector('#svl-0').textContent]));
  await p.click('[data-act="closeSheet"]'); await p.click('#app [data-tab="more"]'); await shot(p, 'n-more'); await p.click('#app [data-tab="stats"]');
  await p.evaluate(() => { document.querySelector('#screen').scrollTop = 99999; }); await shot(p, 'n-stats-end');
  p = await mk(1280, 900, 'dark'); await shot(p, 'n-desktop');
  for (const [w, h] of [[402, 874], [375, 667]]) { p = await mk(w, h, 'dark'); console.log('OVERFLOW', w, await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)); }
  console.log('ERRORS', JSON.stringify(errs)); await b.close();
})();
