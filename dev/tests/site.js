// GitHub Pages 用の単体版（dist/）の確認: 表示・保存・オフライン起動
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), dist = path.join(root, process.env.SITE || 'dist');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
(async () => {
  const srv = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); if (!u.startsWith('/pachisuro/')) { r.statusCode = 404; return r.end('nf'); } u = u.slice('/pachisuro/'.length) || 'index.html'; const f = path.join(dist, u); if (!f.startsWith(dist) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.statusCode = 404; return r.end('nf'); } r.setHeader('content-type', types[path.extname(f)] || 'application/octet-stream'); r.end(fs.readFileSync(f)); }).listen(0);
  const url = `http://localhost:${srv.address().port}/pachisuro/`;
  const b = await chromium.launch(); const errs = [];
  const c = await b.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 2 }); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(url); await p.waitForTimeout(800);
  console.log('1 LOAD', await p.evaluate(() => JSON.stringify({ title: document.title, notes: !!document.querySelector('.notes'), theme: document.documentElement.dataset.theme, n: __demo.db.sessions.length, card: document.querySelector('#app .member img')?.naturalWidth, manifest: document.querySelector('link[rel=manifest]')?.getAttribute('href'), touch: document.querySelector('link[rel=apple-touch-icon]')?.getAttribute('href'), overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth })));
  await p.screenshot({ path: path.join(root, 'shots', 'site-phone.png') });
  for (const f of ['manifest.webmanifest', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'sw.js']) { const r = await p.request.get(url + f); if (r.status() !== 200) console.log('MISSING', f, r.status()); }
  const sw = await p.evaluate(async () => { const r = await navigator.serviceWorker.ready; return r.scope + ' ' + (r.active ? r.active.state : 'none'); });
  console.log('2 SW', sw);
  // 自分の記録を作って保存
  await p.click('[data-act="askMine"]'); await p.click('[data-act="useMine"]'); await p.waitForTimeout(150);
  await p.click('#app [data-tab="add"]'); await p.waitForTimeout(250); await p.click('[data-act="pickMachine"][data-i="0"]'); await p.click('[data-act="chooseMachine"][data-id="m1"]'); await p.fill('#f-p-0-cash', '7000'); await p.fill('#f-p-0-out', '500'); await p.click('[data-act="save"]'); await p.waitForTimeout(250);
  await p.reload(); await p.waitForTimeout(600);   // 2回目の読み込みでページ本体がキャッシュに入る
  // 圏外でも開けること・記録が残っていること
  await c.setOffline(true); await p.reload(); await p.waitForTimeout(800);
  console.log('3 OFFLINE', await p.evaluate(() => JSON.stringify({ mode: __demo.S.mode, n: __demo.db.sessions.length, home: !!document.querySelector('.hero .big'), card: document.querySelector('#app .member img')?.naturalWidth })));
  await p.click('#app [data-tab="add"]'); await p.waitForTimeout(250); await p.click('[data-act="pickMachine"][data-i="0"]'); await p.click('[data-act="chooseMachine"][data-id="m2"]'); await p.fill('#f-p-0-cash', '3000'); await p.click('[data-act="save"]'); await p.waitForTimeout(250);
  await p.reload(); await p.waitForTimeout(600);
  console.log('4 OFFLINE SAVE', await p.evaluate(() => __demo.db.sessions.length));
  await c.setOffline(false);
  const d = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 }); const q = await d.newPage(); await q.goto(url); await q.waitForTimeout(600); await q.screenshot({ path: path.join(root, 'shots', 'site-desktop.png') });
  console.log('5 DESKTOP', await q.evaluate(() => { const r = document.querySelector('.device').getBoundingClientRect(); return Math.round(r.left) + '..' + Math.round(r.right) + ' of ' + innerWidth + ' overflow ' + (document.documentElement.scrollWidth - document.documentElement.clientWidth); }));
  console.log('ERRORS', JSON.stringify(errs)); await b.close(); srv.close();
})();
