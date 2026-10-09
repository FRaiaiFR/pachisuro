// テスト用: アプリ本体とフォントファイルを同じローカルサーバーから配る
const http = require('http'), fs = require('fs'), path = require('path'); const L = require('./fontlist.js');
const root = path.join(__dirname, '..'), fdir = path.join(__dirname, 'fonts/node_modules/@fontsource');
const faces = () => L.map(([, name, dir]) => [400, 500, 600, 700].map(x => fs.existsSync(path.join(fdir, dir, 'files', `${dir}-latin-${x}-normal.woff2`)) ? `@font-face{font-family:"${name}";font-weight:${x};src:url("/f/${dir}/${dir}-latin-${x}-normal.woff2") format("woff2")}` : '').join('')).join('');
exports.faces = faces;
exports.start = (bodyFn) => new Promise(res => { const srv = http.createServer((q, r) => {
  if (q.url.startsWith('/f/')) { const f = path.join(fdir, q.url.slice(3).replace(/\.\./g, '').replace(/^([^/]+)\//, '$1/files/')); if (fs.existsSync(f)) { r.setHeader('content-type', 'font/woff2'); return r.end(fs.readFileSync(f)); } r.statusCode = 404; return r.end(); }
  r.setHeader('content-type', 'text/html; charset=utf-8'); r.end(bodyFn ? bodyFn() : `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}${faces()}</style></head><body>${fs.readFileSync(path.join(root, 'index.html'), 'utf8')}</body></html>`);
}).listen(0, () => res({ srv, url: `http://127.0.0.1:${srv.address().port}/` })); });
