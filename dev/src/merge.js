/* 同期の合わせ込み（計算だけ。画面にも通信にも触れない）
   3つを比べて決める: この端末の内容（local）／クラウドの内容（remote）／前回の同期が終わった時点の内容の控え（base）。
   - 片方だけが変えたものは、変えた方を採る（追加・編集・削除のどれでも）。
   - 両方が同じ記録を別々に編集していたら、保存時刻が新しい方を採り、負けた方は変更履歴に入れる。
   - 片方が削除し、もう片方が編集していたら、編集を残す（記録を失わない側に倒す）。
   base は中身そのものではなく、1件ごとの指紋（ハッシュ）だけを持つ。 */
const Merge = (() => {
  const num = v => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  // キーの並び順に左右されない文字列にする
  function canon(v) {
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
    return JSON.stringify(v === undefined ? null : v);
  }
  function hash(str) {
    let a = 0x811c9dc5, b = 0x9747b28c;
    for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); a = Math.imul(a ^ c, 0x01000193); b = (Math.imul(b ^ c, 0x85ebca6b) + 0x1f) | 0; }
    return (a >>> 0).toString(36) + '.' + (b >>> 0).toString(36) + '.' + str.length.toString(36);
  }
  const fp = v => hash(canon(v));                                  // 指紋
  const same = (a, b) => canon(a) === canon(b);
  const stampOf = s => Math.max(num(s.updatedAt), num(s.createdAt));
  const coreOf = s => { const c = { ...s }; delete c.history; return c; };
  const shown = s => ({ date: s.date, plays: s.plays, deposit: num(s.deposit), cashOut: num(s.cashOut), expense: num(s.expense), memo: s.memo || '' });   // 履歴で見比べる部分
  const empty = () => ({ v: 1, sessions: [], machines: [], store: null, budget: null });

  function snapshot(st) {
    return { sessions: Object.fromEntries(st.sessions.map(s => [s.id, fp(s)])), machines: Object.fromEntries(st.machines.map(m => [m.id, fp(m)])),
      store: st.store ? fp(st.store) : '', budget: st.budget == null ? '' : fp(st.budget) };
  }

  // 同じ記録を両方で編集していたとき: 新しい方を残し、負けた方の内容を変更履歴に足す
  function sessionConflict(l, r) {
    const win = stampOf(l) > stampOf(r) ? l : r, lose = win === l ? r : l;
    const hist = [...(win.history || []), ...(lose.history || [])];
    if (!same(shown(win), shown(lose))) hist.push({ at: stampOf(win), before: coreOf(lose), sync: true });
    const seen = new Map();
    for (const e of hist) { if (!e || !e.before) continue; const k = canon(shown(e.before)), p = seen.get(k); if (!p || num(e.at) < num(p.at)) seen.set(k, e); }
    const merged = [...seen.values()].sort((x, y) => num(x.at) - num(y.at) || (canon(x.before) < canon(y.before) ? -1 : 1)).slice(-20);
    const out = coreOf(win); if (merged.length) out.history = merged; return out;
  }

  // 一覧（記録・機種）を1件ずつ合わせる。base は { id: 指紋 }。無ければ「初めての同期」として両方を足し合わせる
  function mergeList(L, R, B, onConflict) {
    const lm = new Map(L.map(x => [x.id, x])), rm = new Map(R.map(x => [x.id, x])), out = [], conflicts = [];
    const ids = [...new Set([...R.map(x => x.id), ...L.map(x => x.id)])];          // 並びはクラウドの順を先に。どの端末でも同じ並びになる
    for (const id of ids) {
      const l = lm.get(id), r = rm.get(id), b = B ? B[id] : undefined;
      if (l && r) {
        const hl = fp(l), hr = fp(r);
        if (hl === hr) out.push(r);
        else if (b !== undefined && hl === b) out.push(r);                          // クラウド側だけが変えた
        else if (b !== undefined && hr === b) out.push(l);                          // この端末だけが変えた
        else { out.push(onConflict(l, r)); conflicts.push(id); }                    // 両方が変えた
      } else if (l) { if (!(b !== undefined && fp(l) === b)) out.push(l); }         // クラウドで消されていて、こちらは触っていない → 消す。それ以外は残す
      else if (r) { if (!(b !== undefined && fp(r) === b)) out.push(r); }           // この端末で消していて、クラウドは触っていない → 消す
    }
    return { out, conflicts };
  }
  function mergeValue(l, r, b) {                                                    // 1つだけの値（条件・上限額）
    if (r == null) return l; if (l == null) return r;
    const hl = fp(l), hr = fp(r);
    if (hl === hr) return r; if (b && hl === b) return r; return l;                 // 両方が変えていたら、いま使っている端末の値
  }

  function merge(local, remote, base) {
    if (!remote) { remote = empty(); base = null; }                                 // クラウドに何も無いときは、消す判断をしない
    const ss = mergeList(local.sessions, remote.sessions, base && base.sessions, sessionConflict);
    const ms = mergeList(local.machines, remote.machines, base && base.machines, l => l);
    ss.out.sort((x, y) => num(x.createdAt) - num(y.createdAt) || (x.date < y.date ? -1 : x.date > y.date ? 1 : 0) || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
    return { state: { v: 1, sessions: ss.out, machines: ms.out, store: mergeValue(local.store, remote.store, base && base.store), budget: mergeValue(local.budget, remote.budget, base && base.budget) },
      conflicts: ss.conflicts };
  }
  return { merge, snapshot, same, canon, fp, empty, stampOf };
})();
if (typeof module !== 'undefined') module.exports = Merge;
