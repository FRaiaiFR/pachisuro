// テストの共通部品: 公開用のページ（dist/）を配る小さなサーバー、結果の照合、よく使う操作。
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'); exports.root = root;
exports.serve = (dir = path.join(root, process.env.DIST || 'dist')) => new Promise(done => {
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
  const srv = http.createServer((q, r) => {
    const u = decodeURIComponent(q.url.split('?')[0]); if (!u.startsWith('/pachisuro/')) { r.writeHead(404); return r.end(); }
    const f = path.join(dir, u.slice('/pachisuro/'.length) || 'index.html'); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(fs.readFileSync(f));
  });
  srv.listen(0, () => done({ srv, url: `http://localhost:${srv.address().port}/pachisuro/` }));
});
exports.checker = () => {
  const c = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) c.bad++; console.log(ok ? 'ok ' : 'NG ', name, ok ? '' : `\n     得た値 ${JSON.stringify(got)}\n     期待   ${JSON.stringify(want)}`); return ok; };
  c.bad = 0; c.done = extra => { console.log(c.bad ? `${c.bad} NG` : 'all ok', extra || ''); return c.bad ? 1 : 0; };
  return c;
};
exports.closeSheets = async p => { while (await p.$('.sheet [data-act="closeSheet"]')) { await p.click('.sheet [data-act="closeSheet"]'); await p.waitForTimeout(150); } };
// 1台だけの記録を足す
exports.add = async (p, mid, cash, out, opt = {}) => {
  await exports.closeSheets(p); await p.click('#app [data-tab="add"]'); await p.waitForTimeout(250);
  await p.click('[data-act="pickMachine"][data-i="0"]'); await p.click(`[data-act="chooseMachine"][data-id="${mid}"]`);
  await p.fill('#f-p-0-cash', String(cash)); await p.fill('#f-p-0-out', String(out)); if (opt.depositAll) await p.click('[data-act="depSet"][data-v="all"]');
  await p.click('[data-act="save"]'); await p.waitForTimeout(250);
};
