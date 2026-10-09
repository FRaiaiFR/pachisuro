const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
fs.writeFileSync(path.join(root, 'shots/_wrapped.html'), `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${fs.readFileSync(path.join(root, 'index.html'), 'utf8')}</body></html>`);
(async () => {
  const b = await chromium.launch(); const errs = [];
  const mk = async (w, h) => { const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, colorScheme: 'dark' }); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.goto('file://' + path.join(root, 'shots/_wrapped.html')); await p.waitForTimeout(400); return p; };
  const shot = (p, n) => p.screenshot({ path: path.join(root, 'shots', n + '.png') });
  let p = await mk(402, 874);
  await p.click('#app [data-tab="more"]'); await p.click('#app [data-act="backup"]'); await p.waitForTimeout(250); await shot(p, 'w-backup'); await p.click('[data-act="closeSheet"]');
  await p.evaluate(() => { document.querySelector('#screen').scrollTop = 99999; }); await shot(p, 'w-more-end');
  await p.click('#app .lookseg [data-t="dark"]'); await p.click('#app [data-tab="home"]'); await p.waitForTimeout(150); await shot(p, 'k-home');
  await p.click('#app [data-tab="cal"]'); await shot(p, 'k-cal'); await p.click('#app [data-tab="stats"]'); await p.evaluate(() => { document.querySelector('#screen').scrollTop = 700; }); await shot(p, 'k-stats');
  p = await mk(1280, 900); await shot(p, 'w-desktop');
  // コントラスト（白地）: 主要な文字色
  console.log('COLORS', await p.evaluate(() => { const g = s => getComputedStyle(document.documentElement).getPropertyValue(s).trim(); return ['--bg','--surface','--fg','--fg-2','--fg-3','--red','--gold'].map(k => k + '=' + g(k)).join(' '); }));
  console.log('ERRORS', JSON.stringify(errs)); await b.close();
})();
