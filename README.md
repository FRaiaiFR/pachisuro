# パチスロ収支（デラックスセブン用）

iPhone のホーム画面に追加して使う、個人用の収支記録アプリです。
公開先: https://fraiaifr.github.io/pachisuro/

- 記録はまずこの端末（ブラウザ）の中に保存されます。「その他 → 同期」でログインすると、クラウド（Firebase）にも同じ内容を保存し、ほかの端末でも同じ記録を使えます。
- ログインしない場合は端末の中だけです。機種変更やデータ消去に備えて、「その他 → バックアップと復元」からときどき書き出してください。
- 以前の「収支記録」アプリは `old/` に残してあります（https://fraiaifr.github.io/pachisuro/old/）。その記録は、このアプリには取り込みません。
- アイコンを変えたあとは、ホーム画面のアイコンを削除して追加し直すと新しい絵になります。**iPhone ではホーム画面のアイコンを削除すると、その中の記録も消えます。必ず先に「その他 → バックアップと復元」で書き出し、追加し直したあとに復元してください。**

## ファイル

| 場所 | 内容 |
|---|---|
| `index.html` | アプリ本体（1ファイル） |
| `sw.js` `manifest.webmanifest` `*.png` | ホーム画面用の設定、アイコン、オフライン起動 |
| `dev/src/` | ソース（見た目 `head.html`、画面の骨組み `body.html`、計算 `calc.js`、画面の動き `app.js`、会員カード画像 `card.js`） |
| `dev/src/merge.js` | 同期のとき、端末とクラウドのどちらを残すかを決める計算 |
| `dev/src/catalog.js` | 機種名の一覧（正式名称・メーカー・種類・よみ／略称）と、打った文字から候補を探す仕組み。機種を足すときはここに1行足す |
| `dev/tests/` | 自動テスト。`calc.test.js`＝計算、`merge.test.js`＝同期の合わせ込み、`app.js`＝画面の操作全般、`draft.js`＝入力途中の自動保存、`sync.js`＝2台の同期（にせの Firebase `mockfb.js` が相手）、`site.js`＝オフライン起動、`top.js`＝画面上部の余白。`fixture.js` はテスト用の記録データ |
| `dev/icon/make_icon.py` | ホーム画面アイコン「D7E」を描くスクリプト（`dev/static/` に書き出す） |
| `old/` | 置き換え前のアプリ |

## 同期のしくみ

- 置き場所: Firebase プロジェクト `tabearuki-c5c7b`（食べ歩きアプリと同じ）の Firestore、`users/{ユーザーID}/dx7/main` の1文書。
- ログイン: メールアドレス＋パスワード。
- 同期するもの: 記録、機種、貸出・交換の条件、月間の現金投資上限。見た目・カード画像・入力途中の下書きは端末ごと。
- 同期するとき: アプリを開いたとき、記録を保存・編集・削除したとき、ほかのアプリから戻ったとき、圏外から復帰したとき。
- 食い違い: 記録1件ごとに、後から保存した方を残す。負けた方は変更履歴に入る。片方が削除・片方が編集なら、編集を残す。
- Firestore のルールには、次の3行が必要（本人だけが読み書きできる）:

```
match /users/{userId}/dx7/{docId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

## 作り直すとき

```sh
cd dev
OUT=.. ./build.sh          # ソースから index.html などを作り直す
node tests/calc.test.js    # 計算のテスト
node tests/merge.test.js   # 同期の合わせ込みのテスト
node tests/catalog.test.js # 機種名の候補探しのテスト
node tests/app.js          # 画面の操作テスト（Playwright が必要。draft.js / sync.js / site.js / top.js も同じ）
```
