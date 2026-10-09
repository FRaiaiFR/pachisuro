// 固定フォント（Rajdhani）での表示検査: はみ出し・等幅数字・保存データの互換
const { chromium } = require('playwright'); const path = require('path'); const FS = require('./fontserver.js');
const root = path.join(__dirname, '..');
(async () => {
  const { srv, url } = await FS.start(); const b = await chromium.launch(); const errs = [];
  for (const [w, h] of [[375, 700], [402, 874]]) {
    const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 }); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
    // 以前の版で保存された設定（numFont 入り）が残っていても読み込めること
    await p.goto(url); await p.evaluate(() => { localStorage.setItem('dx7-shushi.v1', JSON.stringify({ savedAt: 1, backupAt: 0, body: JSON.stringify({ v: 1, mode: 'sample', settings: { budget: 70000, look: 'light', numFont: 'orbitron' }, mine: null }) })); });
    await p.reload(); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(500);
    const probe = () => p.evaluate(() => { const bad = [];
      const q = (sel, f) => document.querySelectorAll(sel).forEach(e => { const r = f(e); if (r) bad.push(sel + ':' + r); });
      q('#app .kv3 > div, #app .ledger > div, #app .member-bal, #app .item .rr, #app .dl dd, #app .rank .vv, #app .sh-foot .res, #app .hero .big, #app .pres, #app .top', e => { const er = e.getBoundingClientRect(); for (const k of e.querySelectorAll('.num')) { const kr = k.getBoundingClientRect(); if (kr.right > er.right + 1 || kr.left < er.left - 1) return k.textContent; } });
      q('#app .cal .c', e => { const a = e.querySelector('.am'); if (a && a.getBoundingClientRect().width > e.getBoundingClientRect().width - 2) return a.textContent; });
      q('#app .item', e => (e.scrollWidth > e.clientWidth + 1 ? 'row' : ''));
      if (document.documentElement.scrollWidth > document.documentElement.clientWidth) bad.push('page'); return [...new Set(bad)]; });
    const res = {}; res.home = await probe(); if (w === 402) await p.screenshot({ path: path.join(root, 'shots', 'r-home.png') });
    await p.click('#app [data-tab="cal"]'); await p.click('[data-act="calMove"][data-k="-1"]'); await p.waitForTimeout(100); res.cal = await probe(); if (w === 402) await p.screenshot({ path: path.join(root, 'shots', 'r-cal.png') });
    await p.click('#app [data-tab="stats"]'); await p.waitForTimeout(100); res.stats = await probe(); if (w === 402) await p.screenshot({ path: path.join(root, 'shots', 'r-stats.png') });
    await p.click('#app [data-tab="more"]'); await p.evaluate(() => { document.querySelector('#screen').scrollTop = 99999; }); if (w === 402) await p.screenshot({ path: path.join(root, 'shots', 'r-more.png') });
    await p.click('#app [data-tab="add"]'); await p.waitForTimeout(250); await p.fill('#f-p-0-cash', '128000'); await p.fill('#f-p-0-out', '12800'); res.entry = await probe(); if (w === 402) await p.screenshot({ path: path.join(root, 'shots', 'r-entry.png') });
    const info = await p.evaluate(() => { const cs = getComputedStyle(document.querySelector('.num')); const c = document.createElement('canvas').getContext('2d'); c.font = '600 100px Rajdhani'; return { fam: cs.fontFamily.split(',')[0], w: cs.fontWeight, loaded: document.fonts.check('600 20px Rajdhani'), d: '0123456789'.split('').map(ch => Math.round(c.measureText(ch).width)).join(','), budget: __demo.S.budget, hasPicker: document.body.innerHTML.includes('fontSheet') }; });
    console.log(w, JSON.stringify(info), Object.entries(res).filter(([, v]) => v.length).map(([k, v]) => k + JSON.stringify(v)).join(' ') || 'no overflow');
    await c.close();
  }
  console.log('ERRORS', JSON.stringify(errs)); await b.close(); srv.close();
})();
