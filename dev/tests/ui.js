const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const page0 = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${fs.readFileSync(path.join(root, 'index.html'), 'utf8')}</body></html>`;
fs.writeFileSync(path.join(root, 'shots/_wrapped.html'), page0);
(async () => {
  const b = await chromium.launch();
  const errs = [];
  const mk = async (w, h, scheme) => { const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, colorScheme: scheme }); const p = await c.newPage(); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); await p.goto('file://' + path.join(root, 'shots/_wrapped.html')); await p.waitForTimeout(300); return p; };
  const shot = (p, n) => p.screenshot({ path: path.join(root, 'shots', n + '.png') });
  const full = async (p, n) => { // 画面内スクロール領域を全部写す
    const el = await p.$('.sheet .sh-body') || await p.$('#screen');
    const sh = await el.evaluate(e => e.scrollHeight), ch = await el.evaluate(e => e.clientHeight);
    let i = 0; for (let y = 0; y < sh; y += ch - 40) { await el.evaluate((e, y) => { e.scrollTop = y; }, y); await p.waitForTimeout(60); await shot(p, `${n}-${i++}`); if (y + ch >= sh) break; }
  };
  // ---- phone, dark
  let p = await mk(402, 874, 'dark');
  await full(p, 'p-home');
  await p.click('#app [data-tab="cal"]'); await full(p, 'p-cal');
  await p.click('#app [data-tab="stats"]'); await full(p, 'p-stats');
  await p.click('[data-p="month"]'); await shot(p, 'p-stats-month');
  await p.click('#app [data-tab="more"]'); await full(p, 'p-more');
  // ---- entry flow: 3台、持ちメダル移動、一部預け入れ
  await p.click('#app [data-tab="add"]'); await p.waitForTimeout(300);
  await p.click('[data-act="save"]'); await p.waitForTimeout(100); await full(p, 'p-entry-err');
  await p.click('[data-act="pickMachine"][data-i="0"]'); await p.waitForTimeout(100); await shot(p, 'p-picker');
  await p.click('[data-act="chooseMachine"][data-id="m1"]');
  await p.fill('#f-p-0-cash', '10000'); await p.fill('#f-p-0-out', '800');
  await p.click('[data-act="addPlay"]');
  await p.click('[data-act="pickMachine"][data-i="1"]'); await p.fill('#mq', 'テスト新機種'); await p.waitForTimeout(50); await shot(p, 'p-picker-new'); await p.click('[data-act="newMachine"]');
  await p.click('#carry-1'); await p.fill('#f-p-1-out', '1337');
  await p.fill('#f-deposit', '300'); await p.waitForTimeout(100);
  const live = await p.evaluate(() => ({ hand: document.querySelector('#st-hand').textContent, cashOut: document.querySelector('#f-cashOut').value, res: document.querySelector('#entry-res').textContent, p0: document.querySelector('#pres-0').textContent, p1: document.querySelector('#pres-1').textContent }));
  console.log('LIVE', JSON.stringify(live));
  await full(p, 'p-entry');
  const before = await p.evaluate(() => window.__demo.db.sessions.length);
  await p.click('[data-act="save"]'); await p.waitForTimeout(200);
  const after = await p.evaluate(() => { const d = window.__demo.db; const s = d.sessions[d.sessions.length - 1]; return { n: d.sessions.length, s, c: Calc.session(s) }; });
  console.log('SAVED', before, '->', after.n, JSON.stringify({ cashOut: after.s.cashOut, deposit: after.s.deposit, hand: after.c.hand, cashResult: after.c.cashResult, evalResult: after.c.evalResult, gap: after.c.gap }));
  await shot(p, 'p-home-after'); await p.click('#app [data-tab="home"]');
  // 同じ内容をもう一度 → 重複確認
  await p.click('.list .item[data-act="day"]'); await p.waitForTimeout(250); await full(p, 'p-day');
  await p.click('[data-act="askDel"]'); await p.waitForTimeout(80); await shot(p, 'p-confirm');
  await p.click('[data-act="doDel"]'); await p.waitForTimeout(100); await shot(p, 'p-undo');
  const afterDel = await p.evaluate(() => window.__demo.db.sessions.length);
  await p.click('[data-act="undo"]'); await p.waitForTimeout(100);
  const afterUndo = await p.evaluate(() => window.__demo.db.sessions.length);
  console.log('DEL/UNDO', afterDel, afterUndo);
  await p.click('#app [data-tab="more"]'); await p.click('#app [data-act="askClear"]'); await p.click('[data-act="doClear"]'); await p.click('#app [data-tab="home"]'); await p.waitForTimeout(100); await shot(p, 'p-empty');
  // ---- phone, light
  p = await mk(402, 874, 'light'); await shot(p, 'pl-home'); await p.click('#app [data-tab="stats"]'); await shot(p, 'pl-stats'); await p.click('#app [data-tab="add"]'); await p.waitForTimeout(300); await shot(p, 'pl-entry');
  // ---- desktop
  p = await mk(1280, 900, 'dark'); await shot(p, 'd-home');
  p = await mk(1280, 760, 'light'); await shot(p, 'd-light');
  // overflow check
  for (const [w, h] of [[402, 874], [375, 667], [1280, 900]]) { p = await mk(w, h, 'dark'); const o = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, inner: [...document.querySelectorAll('#app *')].filter(e => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX === 'visible' && e.clientWidth > 0 && !e.closest('svg')).slice(0, 8).map(e => e.className + ':' + e.textContent.slice(0, 20)) })); console.log('OVERFLOW', w, JSON.stringify(o)); }
  console.log('ERRORS', JSON.stringify(errs));
  await b.close();
})();
