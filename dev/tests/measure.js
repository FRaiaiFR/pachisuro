const { chromium } = require('playwright'); const L = require('./fontlist.js'); const FS = require('./fontserver.js');
(async () => {
  const { srv, url } = await FS.start(() => `<!doctype html><meta charset="utf-8"><style>${FS.faces()}</style><body>${L.map(([id, name, , w]) => `<span id="${id}" style="font:${w} 100px '${name}',monospace;font-variant-numeric:tabular-nums lining-nums;white-space:nowrap">−128,400</span><br>`).join('')}`);
  const b = await chromium.launch(); const p = await b.newPage(); await p.goto(url); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(600);
  const r = await p.evaluate(L => L.map(([id, name, , w]) => { const el = document.getElementById(id); const c = document.createElement('canvas').getContext('2d'); c.font = `${w} 100px "${name}"`; const m = c.measureText('0'), d = c.measureText('8').width; return [id, Math.round(el.getBoundingClientRect().width), Math.round(m.actualBoundingBoxAscent), document.fonts.check(`${w} 100px "${name}"`), Math.round(d)]; }), L);
  const base = r[0]; for (const x of r) console.log(x[0].padEnd(9), 'width', String(x[1]).padStart(4), 'digitW', x[4], 'digitH', x[2], 'loaded', x[3], 'w-ratio', (base[1] / x[1]).toFixed(2), 'h-ratio', (base[2] / x[2]).toFixed(2));
  await b.close(); srv.close();
})();
