// 画面上部の余白の確認（iPhone 17 Pro のホーム画面アプリを想定）。
// iPhone 17 Pro のホーム画面アプリでは、時計の帯（62pt）は iPhone 側が描き、アプリの画面はその下から画面の一番下まで（上の余白 0・下 34）。
// 見出しの1行目は画面の上端から 12px 下、タブバーは下のセーフエリア（34pt）のすぐ上まで来ること。
// 以前の設定（時計の帯の下までアプリが描く。上 62・下 34）で追加したままの端末でも、同じ余白になること。
const { chromium } = require('playwright'); const path = require('path'); const http = require('http'); const fs = require('fs');
const root = path.join(__dirname, '..'); const DIST = process.env.DIST || path.join(root, 'dist'); const TAG = process.env.TAG || 'now';
(async () => {
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
  const srv = http.createServer((q, r) => { const f = decodeURIComponent(q.url.split('?')[0]).replace(/^\/pachisuro\/?/, '') || 'index.html'; const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p)); });
  await new Promise(ok => srv.listen(0, ok)); const url = `http://localhost:${srv.address().port}/pachisuro/`;
  const b = await chromium.launch(); let bad = 0;
  for (const [name, top, bottom, want, height] of [['iPhone17Pro', 0, 34, 12, 874 - 62], ['iPhone17Pro(以前の設定)', 62, 34, 12, 874], ['Safari', 0, 0, 12, 874]]) {
    const c = await b.newContext({ viewport: { width: 402, height }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const p = await c.newPage(); const cdp = await c.newCDPSession(p);
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top, bottom } });
    await p.goto(url); await p.waitForTimeout(700);
    for (const tab of ['home', 'cal', 'stats', 'more']) {
      await p.click(`#app [data-tab="${tab}"]`); await p.waitForTimeout(200);
      const m = await p.evaluate(() => {
        const probe = document.createElement('div'); probe.style.cssText = 'position:fixed;top:0;height:env(safe-area-inset-top,0px);width:1px'; document.body.appendChild(probe); const safe = probe.getBoundingClientRect().height; probe.remove();
        const t = document.querySelector('#screen > * p, #screen > * h1').getBoundingClientRect().top;
        return { safe, text: Math.round(t * 10) / 10, tabbar: Math.round(document.querySelector('#tabbar').getBoundingClientRect().bottom), inner: innerHeight, scroll: document.documentElement.scrollHeight };
      });
      const gap = Math.round((m.text - m.safe) * 10) / 10, ok = m.safe === top && gap === want && m.scroll === m.inner && m.tabbar === m.inner - bottom;
      if (!ok) bad++;
      console.log(ok ? 'ok ' : 'NG ', name, tab, `セーフエリア ${m.safe} / 1行目 ${m.text}（すき間 ${gap}、期待 ${want}）` + ` / タブバー下端 ${m.tabbar}`);
      if (name === 'iPhone17Pro' && tab === 'home') await p.screenshot({ path: path.join(root, 'shots', `top-${TAG}-home.png`) });
    }
    await c.close();
  }
  console.log(bad ? `${bad} NG` : 'all ok'); await b.close(); srv.close(); process.exit(bad ? 1 : 0);
})();
