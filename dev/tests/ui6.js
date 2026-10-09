const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http');
const root = path.join(__dirname, '..');
const html = () => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${fs.readFileSync(path.join(root, 'index.html'), 'utf8')}</body></html>`;
(async () => {
  const srv = http.createServer((q, r) => { r.setHeader('content-type', 'text/html; charset=utf-8'); r.end(html()); }).listen(0); const url = `http://127.0.0.1:${srv.address().port}/`;
  const b = await chromium.launch(); const errs = [];
  const c = await b.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 2 }); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
  const bg = () => p.evaluate(() => [document.documentElement.dataset.theme, getComputedStyle(document.querySelector('#app')).backgroundColor, document.querySelector('.lookseg [aria-pressed="true"]').textContent].join(' '));
  const shot = n => p.screenshot({ path: path.join(root, 'shots', n + '.png') });
  await p.goto(url); await p.waitForTimeout(400); console.log('1', await bg()); await shot('t-white');
  await p.click('#app .lookseg [data-t="dark"]'); await p.waitForTimeout(100); console.log('2', await bg()); await shot('t-black');
  for (const t of ['cal', 'stats', 'more']) { await p.click(`#app [data-tab="${t}"]`); await p.waitForTimeout(80); await shot('t-black-' + t); }
  await p.reload(); await p.waitForTimeout(400); console.log('3 reload', await bg());
  await p.click('#app .lookseg [data-t="light"]'); await p.waitForTimeout(100); console.log('4', await bg());
  for (const w of [402, 375]) { await p.setViewportSize({ width: w, height: 700 }); console.log('OVERFLOW', w, await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 'top fits', await p.evaluate(() => { const t = document.querySelector('.top'); return t.scrollWidth <= t.clientWidth; })); }
  console.log('ERRORS', JSON.stringify(errs)); await b.close(); srv.close();
})();
