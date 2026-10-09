/* 機種名の一覧（正式名称・メーカー・種類・よみ／略称）と、打った文字から候補を探す仕組み。
   機種を選ぶ画面で、一覧にない名前が打たれたときに「正式名称の候補」として出す。通信はしない。
   載せるのはデラックスセブンの設置機種だけ（設置機種の一覧をもらってから足す）。いまは最初から入っている6機種のみ。
   id は固定。どの端末で追加しても同じ機種として扱われる（同期で二重にならない）。 */
const Catalog = (() => {
  const LIST = [
    { id: 'm1', name: 'スマスロ北斗の拳', maker: 'サミー', type: 'スマスロ・AT', alias: ['ほくとのけん', 'ほくと', '北斗', 'スマスロ北斗'] },
    { id: 'm2', name: 'L 東京喰種', maker: 'スパイキー', type: 'スマスロ・AT', alias: ['とうきょうぐーる', 'ぐーる', '東京グール', '喰種', 'グール'] },
    { id: 'm3', name: 'パチスロ 甲鉄城のカバネリ', maker: 'サミー', type: '6.5号機・AT', alias: ['こうてつじょうのかばねり', 'かばねり', '甲鉄城', 'カバネリ'] },
    { id: 'm4', name: 'スマスロ モンキーターンV', maker: '山佐', type: 'スマスロ・AT', alias: ['もんきーたーん', 'もんきー', 'モンキーターン5', 'モンキー5', 'モンキーV'] },
    { id: 'm5', name: 'マイジャグラーV', maker: '北電子', type: '6号機・ノーマル', alias: ['まいじゃぐらー', 'まいじゃぐ', 'じゃぐらー', 'マイジャグ5', 'マイジャグ'] },
    { id: 'm6', name: 'Lパチスロ 革命機ヴァルヴレイヴ', maker: 'SANKYO', type: 'スマスロ・AT', alias: ['かくめいきゔぁるゔれいゔ', 'ゔぁるゔれいゔ', 'ばるぶれいぶ', 'ヴヴヴ', 'vvv', 'ヴァルヴレイヴ'] }
  ];
  // 見比べ用の形にそろえる: 全角半角・大文字小文字・カタカナひらがなの違い、空白や記号、頭の「スマスロ」「パチスロ」「L」を無視する
  function key(s) {
    let k = String(s || '').normalize('NFKC').toLowerCase().replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60)).replace(/[\s・\-‐－:：!！?？'’"”.,、。/／()（）\[\]【】~〜]/g, '');
    for (let i = 0; i < 3; i++) k = k.replace(/^(すますろ|ぱちすろ|すろっと|[ls]ぱちすろ)/, '').replace(/^[ls](?![a-z0-9])/, '');
    return k;
  }
  const KEYS = LIST.map(e => [key(e.name), ...e.alias.map(key)].filter(Boolean));
  function score(i, q) {
    let best = 0;
    for (const k of KEYS[i]) { const s = k === q ? 100 : k.startsWith(q) ? 80 : k.includes(q) ? 60 : q.includes(k) && k.length >= 2 ? 50 : 0; if (s > best) best = s; }
    return best;
  }
  // 打った文字に合う機種を、近い順に返す。1文字だけでは探さない
  function find(text, limit = 6) {
    const q = key(text); if (q.length < 2) return [];
    return LIST.map((e, i) => ({ e, s: score(i, q) })).filter(x => x.s).sort((a, b) => b.s - a.s || a.e.name.length - b.e.name.length).slice(0, limit).map(x => x.e);
  }
  const matches = (entryOrName, text) => { const q = key(text); if (!q) return true; const i = LIST.findIndex(e => e === entryOrName || e.id === entryOrName.id || key(e.name) === key(entryOrName.name)); return i >= 0 && q.length >= 2 && score(i, q) > 0; };
  const byId = id => LIST.find(e => e.id === id) || null;
  return { LIST, key, find, matches, byId };
})();
if (typeof module !== 'undefined') module.exports = Catalog;
