/* 収支計算（暫定案）。画面に依存しない純粋関数だけを置く。
   単位: 円は整数、メダルは整数枚。交換率は「100円あたりの枚数×10」の整数（5.6枚 → 56）で持つ。 */
const Calc = (() => {
  const n = v => (Number.isFinite(+v) ? Math.max(0, Math.round(+v)) : 0);
  const medalYen = (medals, exchX10) => medals * 1000 / exchX10;          // 交換レートでの円換算（未丸め）
  const lent = (cash, lendPer1000) => Math.round(n(cash) * lendPer1000 / 1000); // 現金で借りた枚数
  const LONG_DAY = 840;                                                    // 1日の遊技時間がこれ（分）を超えたら警告

  // 1台分
  function play(p, s) {
    const lentM = lent(p.cash, s.lendPer1000);
    const carryIn = n(p.carryIn), savedIn = n(p.savedIn), out = n(p.out), cash = n(p.cash);
    const inMedals = lentM + carryIn + savedIn;
    return {
      lent: lentM, inMedals,
      diff: out - inMedals,                                                // 差枚
      yen: Math.round(medalYen(out - carryIn - savedIn, s.exchX10)) - cash // 換算収支（交換レート評価）
    };
  }

  // 換金額の自動計算（100円単位で切り捨て）
  function autoCashOut(hand, deposit, exchX10) {
    const m = Math.max(0, n(hand) - n(deposit));
    return Math.floor(m * 10 / exchX10) * 100;
  }

  // 1実戦（1日×1店舗）
  function session(s) {
    const plays = s.plays.map(p => play(p, s));
    const sum = k => s.plays.reduce((a, p) => a + n(p[k]), 0);
    const cash = sum('cash'), savedIn = sum('savedIn'), carryIn = sum('carryIn'), out = sum('out'), minutes = sum('minutes');
    const hand = out - carryIn;                       // 最後に手元に残ったメダル
    const deposit = n(s.deposit), cashOut = n(s.cashOut), expense = n(s.expense);
    const exchMedals = hand - deposit;                // 交換に回したメダル
    const cashResult = cashOut - cash;                // 現金収支
    const savedDelta = deposit - savedIn;             // 貯メダル増減（枚）
    const savedYen = Math.round(medalYen(savedDelta, s.exchX10));
    const evalResult = cashResult + savedYen;         // 遊技収支（メダル評価込み）
    const machineSum = plays.reduce((a, p) => a + p.yen, 0);
    return {
      plays, cash, savedIn, carryIn, out, minutes, hand, deposit, cashOut, expense, exchMedals,
      lent: plays.reduce((a, p) => a + p.lent, 0),
      diff: plays.reduce((a, p) => a + p.diff, 0),
      cashResult, savedDelta, savedYen, evalResult, machineSum,
      gap: evalResult - machineSum,                   // 端数・景品差（台別合計との差）
      leftover: Math.max(0, Math.floor(exchMedals - cashOut * s.exchX10 / 1000))
    };
  }

  function validate(s, opt = {}) {
    const errors = [], warnings = [];
    if (!s.storeId) errors.push('店舗を選んでください');
    if (!s.plays.length) errors.push('台を1台以上追加してください');
    s.plays.forEach((p, i) => { if (!p.machineId) errors.push(`${i + 1}台目：機種を選んでください`); });
    let avail = 0;
    s.plays.forEach((p, i) => {
      if (n(p.carryIn) > avail) errors.push(`${i + 1}台目：持ちメダル使用が、前の台までの手元枚数（${avail}枚）を超えています`);
      avail += n(p.out) - n(p.carryIn);
    });
    const c = session(s);
    if (c.hand >= 0 && c.deposit > c.hand) errors.push(`預け入れが手元のメダル（${c.hand}枚）を超えています`);
    if (s.plays.length && c.cash + c.savedIn + c.out === 0) errors.push('現金投資・貯メダル使用・終了時の枚数のどれかを入力してください');
    const max = autoCashOut(c.hand, c.deposit, s.exchX10);
    if (c.cashOut > max) warnings.push(`換金額が交換レートでの計算値（${max.toLocaleString('ja-JP')}円）を上回っています`);
    if (opt.balance != null && c.savedIn > opt.balance) warnings.push(`貯メダル使用が残高（${opt.balance}枚）を超えています。初期残高か預け入れの記録漏れはありませんか`);
    const used = n(opt.usedToday);
    if (opt.dailyLimit > 0 && c.savedIn + used > opt.dailyLimit) errors.push(`貯メダル使用が1日の上限（${opt.dailyLimit}枚）を超えています（この日の合計 ${c.savedIn + used}枚）`);
    return { errors, warnings };
  }

  // 集計。basis: 'eval'（メダル評価込み）| 'cash'（現金のみ）。勝敗は日単位、経費は含めない。
  function stats(sessions, basis = 'eval') {
    const key = basis === 'cash' ? 'cashResult' : 'evalResult';
    const T = { n: 0, plays: 0, cash: 0, cashOut: 0, cashResult: 0, savedDelta: 0, savedYen: 0, evalResult: 0,
      expense: 0, minutes: 0, timedResult: 0, timedMinutes: 0, timedN: 0, diff: 0 };
    const byDate = new Map();
    for (const s of sessions) {
      const c = session(s);
      T.n++; T.plays += s.plays.length;
      for (const k of ['cash', 'cashOut', 'cashResult', 'savedDelta', 'savedYen', 'evalResult', 'expense', 'minutes', 'diff']) T[k] += c[k];
      if (c.minutes > 0) { T.timedResult += c[key]; T.timedMinutes += c.minutes; T.timedN++; }
      const d = byDate.get(s.date) || { date: s.date, result: 0, cash: 0, cashOut: 0, n: 0, plays: 0, minutes: 0, expense: 0 };
      d.result += c[key]; d.cash += c.cash; d.cashOut += c.cashOut; d.n++; d.plays += s.plays.length; d.minutes += c.minutes; d.expense += c.expense;
      byDate.set(s.date, d);
    }
    const days = [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
    let wins = 0, loses = 0, draws = 0, sw = 0, sl = 0, streakWin = 0, streakLose = 0, maxWin = null, maxLose = null;
    for (const d of days) {
      if (d.result > 0) { wins++; sw++; sl = 0; } else if (d.result < 0) { loses++; sl++; sw = 0; } else { draws++; sw = 0; sl = 0; }
      streakWin = Math.max(streakWin, sw); streakLose = Math.max(streakLose, sl);
      if (d.result > 0 && (!maxWin || d.result > maxWin.result)) maxWin = d;
      if (d.result < 0 && (!maxLose || d.result < maxLose.result)) maxLose = d;
    }
    const result = T[key];
    return Object.assign(T, {
      days, dayCount: days.length, wins, loses, draws, streakWin, streakLose, maxWin, maxLose, result,
      winRate: days.length ? wins / days.length : null,                    // 引き分けも分母に含める
      returnRate: T.cash > 0 ? (T.cash + result) / T.cash : null,          // 回収率
      avgCash: days.length ? T.cash / days.length : null,
      avgResult: days.length ? result / days.length : null,
      hourly: T.timedMinutes > 0 ? T.timedResult / (T.timedMinutes / 60) : null,
      finalResult: result - T.expense                                      // 経費込み
    });
  }

  // 機種別（常に交換レート換算の台別収支で集計）
  function byMachine(sessions) {
    const m = new Map();
    for (const s of sessions) s.plays.forEach(p => {
      const c = play(p, s), r = m.get(p.machineId) || { id: p.machineId, n: 0, yen: 0, diff: 0, cash: 0 };
      r.n++; r.yen += c.yen; r.diff += c.diff; r.cash += n(p.cash); m.set(p.machineId, r);
    });
    return [...m.values()].sort((a, b) => b.yen - a.yen);
  }
  function byStore(sessions, basis = 'eval') {
    const key = basis === 'cash' ? 'cashResult' : 'evalResult', m = new Map();
    for (const s of sessions) {
      const c = session(s), r = m.get(s.storeId) || { id: s.storeId, n: 0, result: 0, cash: 0 };
      r.n++; r.result += c[key]; r.cash += c.cash; m.set(s.storeId, r);
    }
    return [...m.values()].sort((a, b) => b.result - a.result);
  }
  function byWeekday(days) {
    const w = Array.from({ length: 7 }, (_, i) => ({ wd: i, n: 0, result: 0 }));
    for (const d of days) { const [y, mo, da] = d.date.split('-').map(Number); const r = w[new Date(y, mo - 1, da).getDay()]; r.n++; r.result += d.result; }
    return w;
  }
  function byMonth(days) {
    const m = new Map();
    for (const d of days) { const k = d.date.slice(0, 7), r = m.get(k) || { month: k, n: 0, result: 0, cash: 0 }; r.n++; r.result += d.result; r.cash += d.cash; m.set(k, r); }
    return [...m.values()].sort((a, b) => (a.month < b.month ? -1 : 1));
  }
  // 貯メダル残高（店舗別）= 初期残高 + Σ預け入れ − Σ使用
  function balances(stores, sessions) {
    const b = {};
    for (const st of stores) b[st.id] = n(st.initSaved);
    for (const s of sessions) { const c = session(s); b[s.storeId] = (b[s.storeId] || 0) + c.savedDelta; }
    return b;
  }

  /* ---------- 二重チェック ----------
     1件の記録を検算し、入力の矛盾・二重計上の疑い・換金額の差を返す。
     opt: { balance: この記録の直前の貯メダル残高, dailyLimit, usedToday: 同じ日の他の記録の貯メダル使用, duplicate } */
  function audit(s, opt = {}) {
    const v = validate(s, opt), c = session(s), issues = [];
    const add = (level, code, msg) => issues.push({ level, code, msg });
    v.errors.forEach(m => add('error', 'input', m));
    v.warnings.forEach(m => add('warn', 'input', m));
    let avail = 0;
    s.plays.forEach((p, i) => {
      const cash = n(p.cash), carry = n(p.carryIn), saved = n(p.savedIn), out = n(p.out), lentM = lent(cash, s.lendPer1000), no = i + 1;
      if (cash > 0 && cash % 1000 !== 0) add('warn', 'unit', `${no}台目：現金投資が1,000円単位ではありません（${cash.toLocaleString('ja-JP')}円）。桁の打ち間違いはありませんか`);
      if (lentM > 0 && (lentM === carry || lentM === saved)) add('warn', 'double', `${no}台目：現金で借りた枚数と${lentM === carry ? '持ちメダル使用' : '貯メダル使用'}が同じ${lentM}枚です。同じ投資を2回入れていませんか`);
      const left = avail - carry;   // 前の台までのメダルのうち、この台に入れなかった分
      if (i > 0 && cash > 0 && left >= 50) add('warn', 'double', `${no}台目：前の台までのメダルが${left}枚残ったまま、現金で投資しています。持ちメダルで打った分を現金投資に入れていませんか`);
      if (cash + carry + saved === 0 && out > 0) add('warn', 'missing', `${no}台目：投入が0なのに終了時の枚数があります。投資の記録漏れはありませんか`);
      if (cash + carry + saved === 0 && out === 0 && s.plays.length > 1) add('warn', 'missing', `${no}台目：投入も終了時の枚数も0です。使っていない台なら外してください`);
      avail += out - carry;
    });
    // 換金額と計算上の金額の差
    const calcOut = autoCashOut(c.hand, c.deposit, s.exchX10), cashGap = c.cashOut - calcOut;
    if (cashGap <= -1000) add('warn', 'cashout', `換金額が計算上の金額より${(-cashGap).toLocaleString('ja-JP')}円少なくなっています。景品に替えた分か、入力の間違いか確認してください`);
    if (opt.duplicate) add('warn', 'dup', '同じ日付で、内容がまったく同じ記録がもう1件あります');
    // 遊技時間が1日で14時間を超える（営業時間より長い）→ タイマーの止め忘れか、打ち間違い
    if (c.minutes > LONG_DAY) add('warn', 'time', `遊技時間の合計が${Math.floor(c.minutes / 60)}時間${c.minutes % 60 ? c.minutes % 60 + '分' : ''}になっています。タイマーの止め忘れか、打ち間違いはありませんか`);
    // 台別合計と1日の収支の照合。差 ＝ 換金額の差 − 100円に満たない端数、で必ず説明がつく
    const frac = Math.round(medalYen(c.exchMedals, s.exchX10)) - calcOut;
    const recon = { machineSum: c.machineSum, dayResult: c.evalResult, diff: c.evalResult - c.machineSum, frac, calcOut, cashOut: c.cashOut, cashGap, leftover: c.leftover,
      matched: cashGap === 0, consistent: c.evalResult - c.machineSum === cashGap - frac && c.hand >= 0 };
    if (!recon.consistent) add('error', 'broken', '台別の合計と1日の収支が計算上つながりません。記録が壊れている可能性があります');
    return { issues, errors: issues.filter(x => x.level === 'error').length, warns: issues.filter(x => x.level === 'warn').length, recon };
  }

  // 全記録を日付順にたどり、直前の貯メダル残高・同日の使用量・重複を渡しながら検算する
  function auditAll(stores, sessions) {
    const order = sessions.map((s, i) => [s, i]).sort((a, b) => (a[0].date < b[0].date ? -1 : a[0].date > b[0].date ? 1 : a[1] - b[1])).map(x => x[0]);
    const bal = {}; for (const st of stores) bal[st.id] = n(st.initSaved);
    const lim = {}; for (const st of stores) lim[st.id] = n(st.dailyLimit);
    const seen = new Map(), out = new Map();
    const sig = s => JSON.stringify([s.date, s.storeId, s.plays.map(p => [p.machineId, n(p.cash), n(p.savedIn), n(p.carryIn), n(p.out)]), n(s.deposit), n(s.cashOut)]);
    const dayUse = new Map();
    for (const s of order) { const k = sig(s), d = s.date + '|' + s.storeId; seen.set(k, (seen.get(k) || 0) + 1); dayUse.set(d, (dayUse.get(d) || 0) + session(s).savedIn); }
    for (const s of order) {
      const c = session(s), total = (dayUse.get(s.date + '|' + s.storeId) || 0) - c.savedIn;
      out.set(s.id, audit(s, { balance: bal[s.storeId] || 0, dailyLimit: lim[s.storeId] || 0, usedToday: total, duplicate: seen.get(sig(s)) > 1 }));
      bal[s.storeId] = (bal[s.storeId] || 0) + c.savedDelta;
    }
    return out;
  }

  // 修正前と修正後の違いを、人が読める行にする
  function diffSession(a, b, nameOf = id => id) {
    const lines = [], y = v => n(v).toLocaleString('ja-JP');
    if (a.date !== b.date) lines.push(`日付：${a.date} → ${b.date}`);
    const m = Math.max(a.plays.length, b.plays.length);
    for (let i = 0; i < m; i++) {
      const p = a.plays[i], q = b.plays[i], no = `${i + 1}台目`;
      if (!p) { lines.push(`${no}を追加（${nameOf(q.machineId)}）`); continue; }
      if (!q) { lines.push(`${no}を削除（${nameOf(p.machineId)}）`); continue; }
      if (p.machineId !== q.machineId) lines.push(`${no} 機種：${nameOf(p.machineId)} → ${nameOf(q.machineId)}`);
      for (const [k, label, unit] of [['cash', '現金投資', '円'], ['carryIn', '持ちメダル使用', '枚'], ['savedIn', '貯メダル使用', '枚'], ['out', '終了時の枚数', '枚'], ['minutes', '遊技時間', '分']])
        if (n(p[k]) !== n(q[k])) lines.push(`${no} ${label}：${y(p[k])}${unit} → ${y(q[k])}${unit}`);
    }
    for (const [k, label, unit] of [['deposit', '貯メダルに預ける', '枚'], ['cashOut', '換金額', '円'], ['expense', '経費', '円']])
      if (n(a[k]) !== n(b[k])) lines.push(`${label}：${y(a[k])}${unit} → ${y(b[k])}${unit}`);
    if ((a.memo || '') !== (b.memo || '')) lines.push('メモを変更');
    return lines;
  }

  return { n, medalYen, lent, play, autoCashOut, session, validate, audit, auditAll, diffSession, stats, byMachine, byStore, byWeekday, byMonth, balances };
})();
if (typeof module !== 'undefined') module.exports = Calc;
