// 画面上部の余白の確認（iPhone 17 Pro のホーム画面アプリを想定）。
// セーフエリア（上 62・下 34）をブラウザに再現させ、見出しの1行目がセーフエリアのすぐ下（4px）から始まることを確かめる。
// セーフエリアのない画面（Safari で開いたときなど）では、上端から 16px あくこと。
const { chromium } = require('playwright'); const path = require('path'); const http = require('http'); const fs = require('fs');
const root = path.join(__dirname, '..'); const DIST = process.env.DIST || path.join(root, 'dist'); const TAG = process.env.TAG || 'now';
const ISLAND_BOTTOM = 48;                                  // Dynamic Island の下端（上から 11 + 高さ 37）
(async () => {
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
  const srv = http.createServer((q, r) => { const f = decodeURIComponent(q.url.split('?')[0]).replace(/^\/pachisuro\/?/, '') || 'index.html'; const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p)); });
  await new Promise(ok => srv.listen(0, ok)); const url = `http://localhost:${srv.address().port}/pachisuro/`;
  const b = await chromium.launch(); let bad = 0;
  const hw = () => { const d = document.createElement('div'); d.id = '__hw'; d.innerHTML = '<div style="position:fixed;z-index:9999;top:11px;left:50%;width:126px;height:37px;margin-left:-63px;border-radius:19px;background:#000;box-shadow:0 0 0 1px #333"></div><div style="position:fixed;z-index:9999;top:21px;left:52px;font:600 17px -apple-system,Helvetica,sans-serif;color:#fff">9:41</div><div style="position:fixed;z-index:9999;top:23px;right:36px;width:27px;height:13px;border-radius:4px;background:#fff"></div><div style="position:fixed;z-index:9999;bottom:8px;left:50%;width:140px;height:5px;margin-left:-70px;border-radius:3px;background:#fff"></div>'; document.body.appendChild(d); };
  for (const [name, top, bottom, want] of [['iPhone17Pro', 62, 34, 4], ['no-safe-area', 0, 0, 16]]) {
    const c = await b.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
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
      console.log(ok ? 'ok ' : 'NG ', name, tab, `セーフエリア ${m.safe} / 1行目 ${m.text}（すき間 ${gap}、期待 ${want}）` + (top ? ` / Dynamic Island の下から ${Math.round((m.text - ISLAND_BOTTOM) * 10) / 10}` : '') + ` / タブバー下端 ${m.tabbar}`);
      if (top) { await p.evaluate(hw); await p.screenshot({ path: path.join(root, 'shots', `top-${TAG}-${tab}.png`), clip: { x: 0, y: 0, width: 402, height: tab === 'home' ? 874 : 300 } }); await p.evaluate(() => document.getElementById('__hw').remove()); }
    }
    await c.close();
  }
  console.log(bad ? `${bad} NG` : 'all ok'); await b.close(); srv.close(); process.exit(bad ? 1 : 0);
})();
