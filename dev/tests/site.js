// 公開用のページ（dist/）の確認: ホーム画面用の設定、オフラインでの起動と保存
const { chromium } = require('playwright'); const H = require('./helper.js');
(async () => {
  const { srv, url } = await H.serve(); const b = await chromium.launch(); const check = H.checker(); const errs = [];
  const c = await b.newContext({ viewport: { width: 402, height: 874 } }); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(url); await p.waitForTimeout(800);
  check('1 ホーム画面用の設定', await p.evaluate(() => [document.title, !!document.querySelector('.notes'), document.querySelector('link[rel="manifest"]')?.getAttribute('href'), document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href'), document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.content, document.documentElement.scrollWidth - innerWidth]),
    ['パチスロ収支', false, 'manifest.webmanifest', 'apple-touch-icon.png?v=2', 'black-translucent', 0]);
  const missing = []; for (const f of ['manifest.webmanifest', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'sw.js']) { const r = await p.request.get(url + f); if (r.status() !== 200) missing.push(f); }
  check('1 必要なファイルがそろっている', missing, []);
  check('2 オフライン用の仕組みが動いている', await p.evaluate(async () => { const r = await navigator.serviceWorker.ready; return r.active ? r.active.state : 'none'; }), 'activated');
  await H.add(p, 'm1', 7000, 500); await p.reload(); await p.waitForTimeout(600);       // 2回目の読み込みで、ページ本体が端末に保存される
  await c.setOffline(true); await p.reload(); await p.waitForTimeout(800);
  check('3 圏外でも開けて、記録が残っている', await p.evaluate(() => [__demo.db.sessions.length, !!document.querySelector('.hero .big'), document.querySelector('#app .member img')?.naturalWidth]), [1, true, 856]);
  await H.add(p, 'm2', 3000, 0); await p.reload(); await p.waitForTimeout(600);
  check('4 圏外でも保存できる', await p.evaluate(() => __demo.db.sessions.length), 2);
  check('ページのエラーなし', errs, []);
  const code = check.done(); await b.close(); srv.close(); process.exit(code);
})().catch(e => { console.error('FAILED', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
