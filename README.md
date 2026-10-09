# パチスロ収支（デラックスセブン用）

iPhone のホーム画面に追加して使う、個人用の収支記録アプリです。
公開先: https://fraiaifr.github.io/pachisuro/

- 記録はこの端末（ブラウザ）の中だけに保存されます。サーバーには送りません。
- 機種変更やデータ消去に備えて、「その他 → バックアップと復元」からときどき書き出してください。
- 以前の「収支記録」アプリは `old/` に残してあります（https://fraiaifr.github.io/pachisuro/old/）。

## ファイル

| 場所 | 内容 |
|---|---|
| `index.html` | アプリ本体（1ファイル） |
| `sw.js` `manifest.webmanifest` `*.png` | ホーム画面用の設定、アイコン、オフライン起動 |
| `dev/src/` | ソース（見た目 `head.html`、画面の骨組み `body.html`、計算 `calc.js`、画面の動き `app.js`、会員カード画像 `card.js`） |
| `dev/tests/` | 計算の自動テストと、ブラウザでの操作テスト |
| `old/` | 置き換え前のアプリ |

## 作り直すとき

```sh
cd dev
OUT=.. ./build.sh          # ソースから index.html などを作り直す
node tests/calc.test.js    # 計算のテスト
```
