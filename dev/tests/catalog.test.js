// 機種名の候補探しのテスト:  node tests/catalog.test.js
const assert = require('assert'); const C = require('../src/catalog.js');
let n = 0; const test = (name, fn) => { fn(); n++; console.log('ok ', name); };
const names = t => C.find(t).map(e => e.name);
test('略称・ひらがな・カタカナ・全角半角のどれで打っても、正式名称が出る', () => {
  for (const t of ['北斗', 'ほくと', 'ホクト', 'スマスロ北斗', 'すますろ ほくとのけん']) assert.strictEqual(names(t)[0], 'スマスロ北斗の拳', t);
  for (const t of ['グール', 'ぐーる', '東京喰種', 'L東京喰種', 'Ｌ 東京喰種']) assert.strictEqual(names(t)[0], 'L 東京喰種', t);
  for (const t of ['カバネリ', 'かばねり', '甲鉄城']) assert.strictEqual(names(t)[0], 'パチスロ 甲鉄城のカバネリ', t);
  for (const t of ['ヴヴヴ', 'vvv', 'VVV', 'ヴァルヴレイヴ', 'ばるぶれいぶ']) assert.strictEqual(names(t)[0], 'Lパチスロ 革命機ヴァルヴレイヴ', t);
  for (const t of ['マイジャグ', 'まいじゃぐ', 'ﾏｲｼﾞｬｸﾞ', 'マイジャグラー5']) assert.strictEqual(names(t)[0], 'マイジャグラーV', t);
  assert.strictEqual(names('モンキー')[0], 'スマスロ モンキーターンV');
});
test('1文字だけ・空・一覧にない名前では、候補を出さない', () => { for (const t of ['', ' ', '北', 'L', 'スマスロ', 'パチスロ', '聞いたことのない台']) assert.deepStrictEqual(names(t), [], t); });
test('頭の「スマスロ」「パチスロ」「L」は見比べるときに無視する', () => { assert.strictEqual(C.key('スマスロ 北斗の拳'), C.key('北斗の拳')); assert.strictEqual(C.key('Ｌパチスロ　革命機ヴァルヴレイヴ'), C.key('革命機ヴァルヴレイヴ')); assert.notStrictEqual(C.key('LOVE嬢'), C.key('OVE嬢')); });
test('一覧の中身に抜けがない（名前・メーカー・種類・id が全部ある。id と名前は重複しない）', () => {
  const ids = new Set(), ks = new Set();
  for (const e of C.LIST) { assert.ok(e.id && e.name && e.maker && e.type && Array.isArray(e.alias), e.name); assert.ok(!ids.has(e.id) && !ks.has(C.key(e.name)), e.name); ids.add(e.id); ks.add(C.key(e.name)); assert.strictEqual(names(e.name)[0], e.name); }
});
console.log(`\n${n} tests passed`);
