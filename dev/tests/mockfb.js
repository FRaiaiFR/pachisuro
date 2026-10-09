// テスト用の「にせの Firebase」。アプリが使う通信口だけをまねる:
//   ログイン（登録・ログイン・再設定メール・更新）と、Firestore の1文書の読み書き（「読んだ時点から変わっていなければ」の条件つき）。
const http = require('http');
exports.start = () => new Promise(done => {
  const st = { users: new Map(), docs: new Map(), resets: [], expiresIn: 3600, passwordEnabled: true, signupEnabled: true, rulesDeny: false, revoked: new Set(),
    calls: { get: 0, patch: 0, refresh: 0, conflict: 0 }, beforePatch: null, tick: 0 };
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const idToken = uid => 'id.' + b64({ uid, exp: Date.now() + st.expiresIn * 1000 });
  const now = () => { const d = new Date(); return d.toISOString().replace('Z', String(++st.tick % 1000).padStart(3, '0') + 'Z'); };
  const json = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }); res.end(JSON.stringify(body)); };
  const authErr = (res, msg) => json(res, 400, { error: { code: 400, message: msg, errors: [{ message: msg, domain: 'global', reason: 'invalid' }] } });
  const fsErr = (res, code, status, message) => json(res, code, { error: { code, message: message || status, status } });
  const session = (uid, email) => ({ kind: 'identitytoolkit#x', localId: uid, email, idToken: idToken(uid), refreshToken: 'rf.' + uid + '.' + Math.random().toString(36).slice(2), expiresIn: String(st.expiresIn) });
  const srv = http.createServer((req, res) => {
    if (req.method === 'OPTIONS') { res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS', 'access-control-max-age': '600' }); return res.end(); }
    let raw = ''; req.on('data', c => { raw += c; }); req.on('end', () => {
      const u = new URL(req.url, 'http://x'); const path = decodeURIComponent(u.pathname);
      if (path.startsWith('/auth/accounts:')) {
        const b = JSON.parse(raw || '{}'), op = path.split(':')[1], email = String(b.email || '').toLowerCase();
        if (op === 'signUp') {
          if (!st.passwordEnabled) return authErr(res, 'OPERATION_NOT_ALLOWED'); if (!st.signupEnabled) return authErr(res, 'ADMIN_ONLY_OPERATION');
          if (!/^\S+@\S+\.\S+$/.test(email)) return authErr(res, 'INVALID_EMAIL'); if (st.users.has(email)) return authErr(res, 'EMAIL_EXISTS');
          if (String(b.password || '').length < 6) return authErr(res, 'WEAK_PASSWORD : Password should be at least 6 characters');
          const uid = 'u' + (st.users.size + 1) + Math.random().toString(36).slice(2, 8); st.users.set(email, { uid, password: b.password }); return json(res, 200, session(uid, email));
        }
        if (op === 'signInWithPassword') { const usr = st.users.get(email); if (!usr || usr.password !== b.password) return authErr(res, 'INVALID_LOGIN_CREDENTIALS'); return json(res, 200, session(usr.uid, email)); }
        if (op === 'sendOobCode') { st.resets.push(email); return json(res, 200, { kind: 'identitytoolkit#x', email }); }
        return authErr(res, 'UNKNOWN');
      }
      if (path === '/token/token') {
        st.calls.refresh++; const p = new URLSearchParams(raw), rt = p.get('refresh_token') || '', uid = rt.split('.')[1];
        if (p.get('grant_type') !== 'refresh_token' || !rt.startsWith('rf.') || st.revoked.has(uid)) return authErr(res, 'INVALID_REFRESH_TOKEN');
        return json(res, 200, { access_token: idToken(uid), id_token: idToken(uid), refresh_token: rt, expires_in: String(st.expiresIn), token_type: 'Bearer', user_id: uid });
      }
      const m = path.match(/^\/store\/projects\/([^/]+)\/databases\/\(default\)\/documents\/users\/([^/]+)\/dx7\/main$/);
      if (m) {
        const tok = (req.headers.authorization || '').replace(/^Bearer /, ''); let who = null; try { who = JSON.parse(Buffer.from(tok.slice(3), 'base64url').toString()); } catch (_) {}
        if (!tok.startsWith('id.') || !who || who.exp < Date.now()) return fsErr(res, 401, 'UNAUTHENTICATED', 'Request had invalid authentication credentials.');
        if (st.rulesDeny || who.uid !== m[2]) return fsErr(res, 403, 'PERMISSION_DENIED', 'Missing or insufficient permissions.');
        const key = m[2], name = path.replace('/store/', '');
        if (req.method === 'GET') { st.calls.get++; const d = st.docs.get(key); if (!d) return fsErr(res, 404, 'NOT_FOUND', 'Document not found.'); return json(res, 200, { name, ...d }); }
        if (req.method === 'PATCH') {
          st.calls.patch++; if (st.beforePatch) { const f = st.beforePatch; st.beforePatch = null; f(key); }
          const d = st.docs.get(key), ex = u.searchParams.get('currentDocument.exists'), ut = u.searchParams.get('currentDocument.updateTime');
          if (ex === 'false' && d) { st.calls.conflict++; return fsErr(res, 409, 'ALREADY_EXISTS', 'Document already exists'); }
          if (ut && !d) { st.calls.conflict++; return fsErr(res, 404, 'NOT_FOUND', 'No document to update'); }
          if (ut && d.updateTime !== ut) { st.calls.conflict++; return fsErr(res, 400, 'FAILED_PRECONDITION', 'the stored version does not match the required base version'); }
          const t = now(), nd = { fields: JSON.parse(raw).fields, createTime: d ? d.createTime : t, updateTime: t }; st.docs.set(key, nd); return json(res, 200, { name, ...nd });
        }
      }
      json(res, 404, { error: { code: 404, message: 'no route ' + path, status: 'NOT_FOUND' } });
    });
  });
  srv.listen(0, () => { const base = `http://localhost:${srv.address().port}`; done({ st, srv, endpoints: { auth: base + '/auth', token: base + '/token', store: base + '/store' },
    body: uid => { const d = st.docs.get(uid); return d ? JSON.parse(d.fields.body.stringValue) : null; },
    setBody: (uid, body) => { const d = st.docs.get(uid), t = now(); st.docs.set(uid, { fields: { ...(d ? d.fields : {}), body: { stringValue: JSON.stringify(body) } }, createTime: d ? d.createTime : t, updateTime: t }); } }); });
});
