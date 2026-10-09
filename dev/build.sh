#!/bin/sh
# ソース（src/）から2つの成果物を作る
#   index.html      … Claude のアーティファクト用（本文だけの断片。PC で開くと説明つきのプレビューになる）
#   $OUT/index.html … GitHub Pages 用の単体ページ（既定は dist/。ホーム画面用の設定つき）
cd "$(dirname "$0")"
OUT="${OUT:-dist}"
scripts() { printf '<script>\n'; cat src/card.js; printf '</script>\n<script>\n'; sed '$d' src/calc.js; printf '</script>\n<script>\n'; sed '$d' src/merge.js; printf '</script>\n<script>\n'; cat src/app.js; printf '</script>\n'; }
{ cat src/head.html; cat src/body.html; scripts; } > index.html
mkdir -p "$OUT"
python3 - "$OUT" <<'PY'
import re, sys, io
out = sys.argv[1]
head = open('src/head.html', encoding='utf-8').read()
body = open('src/body.html', encoding='utf-8').read()
body = re.sub(r'\s*<aside class="notes".*?</aside>', '', body, flags=re.S).replace('<div class="stage">', '<div class="stage solo">')
assert 'class="notes"' not in body and 'stage solo' in body
card = open('src/card.js', encoding='utf-8').read()
calc = open('src/calc.js', encoding='utf-8').read().rstrip('\n').rsplit('\n', 1)[0] + '\n'
merge = open('src/merge.js', encoding='utf-8').read().rstrip('\n').rsplit('\n', 1)[0] + '\n'
app = open('src/app.js', encoding='utf-8').read()
html = f'''<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="スロ収支">
<meta name="theme-color" content="#0c0c0c">
<meta name="format-detection" content="telephone=no">
<meta name="robots" content="noindex,nofollow">
<link rel="apple-touch-icon" href="apple-touch-icon.png?v=2">
<link rel="icon" type="image/png" href="icon-192.png?v=2">
<link rel="manifest" href="manifest.webmanifest">
<style>:root{{padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}}body{{margin:0}}img{{max-width:100%}}[hidden]{{display:none!important}}</style>
{head}</head>
<body>
{body}<script>
{card}</script>
<script>
{calc}</script>
<script>
{merge}</script>
<script>
{app}</script>
<script>
if ('serviceWorker' in navigator) addEventListener('load', () => {{ navigator.serviceWorker.register('sw.js').catch(() => {{}}); }});
</script>
</body>
</html>
'''
open(f'{out}/index.html', 'w', encoding='utf-8').write(html)
PY
cp static/sw.js static/manifest.webmanifest static/apple-touch-icon.png static/icon-192.png static/icon-512.png "$OUT"/
wc -c index.html "$OUT"/index.html
