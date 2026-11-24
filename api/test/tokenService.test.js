const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const test = require('node:test');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// This test file runs in its own node:test process; use synthetic keys only.
const accessKey = 'synthetic-access-key-only-for-token-tests';
const refreshKey = 'synthetic-refresh-key-only-for-token-tests';
process.env.JWT_SECRET = accessKey;
process.env.JWT_REFRESH_SECRET = refreshKey;
process.env.JWT_ACCESS_EXPIRES_IN = '10d'; // Exercise the bound for initial browser issuance too.

const Tokens = require('../src/models/Tokens');
const User = require('../src/models/Usuari');
const tokenService = (() => {
  const previous = process.env.JWT_REFRESH_EXPIRES_IN;
  try {
    process.env.JWT_REFRESH_EXPIRES_IN = '30d';
    return require('../src/services/token/tokenService');
  } finally {
    if (previous === undefined) delete process.env.JWT_REFRESH_EXPIRES_IN;
    else process.env.JWT_REFRESH_EXPIRES_IN = previous;
  }
})();
const userService = require('../src/services/userService');
const authService = require('../src/services/authService');
const jsonController = require('../src/controllers/authController');
const { createBrowserAuthController } = require('../src/controllers/browserAuthController');
const { createCookieWriter } = require('../src/security/browserAuthCookies');

const user = {
  _id: 'test-user', active: true, role: 'client', name: 'Test User', passwordHash: 'synthetic-hash',
};
const claims = { sub: user._id, sid: 'test-session', jti: 'current-jti', tokenUse: 'refresh' };
const browserClaims = { ...claims, tokenChannel: 'browser' };
const SECONDS_PER_DAY = 24 * 60 * 60;
const invalid = { statusCode: 401, code: 'INVALID_REFRESH_TOKEN' };
const signRefresh = (payload = browserClaims, options = {}) => jwt.sign(payload, refreshKey, { expiresIn: 3600, ...options });
const hash = (token) => createHash('sha256').update(token).digest('hex');

const sessionFor = (token) => ({
  _id: claims.sid,
  userId: claims.sub,
  currentJti: claims.jti,
  tokenHash: hash(token),
  revokedAt: null,
  expiresAt: new Date(jwt.decode(token).exp * 1000),
});

function fakeModels(t, session, currentUser = user) {
  const state = { session, mutations: [], reads: 0, concurrentReads: 0, maxConcurrentReads: 0 };
  const matches = (filter) => state.session && Object.entries(filter).every(([key, value]) =>
    value?.$gt !== undefined ? state.session[key] > value.$gt : state.session[key] === value
  );
  t.mock.method(Tokens, 'findOne', (filter) => ({
    async select(projection) {
      assert.equal(projection, 'expiresAt');
      state.reads++;
      state.concurrentReads++;
      state.maxConcurrentReads = Math.max(state.maxConcurrentReads, state.concurrentReads);
      await Promise.resolve();
      state.concurrentReads--;
      return matches(filter) ? { expiresAt: state.session.expiresAt } : null;
    },
  }));
  t.mock.method(Tokens, 'findById', (id) => ({
    async select(projection) {
      assert.equal(projection, '+tokenHash');
      return matches({ _id: id }) ? { ...state.session } : null;
    },
  }));
  t.mock.method(Tokens, 'create', async (values) => {
    state.session = { revokedAt: null, ...values };
    state.mutations.push('create');
  });
  for (const method of ['updateOne', 'findOneAndUpdate']) {
    t.mock.method(Tokens, method, async (filter, update) => {
      state.mutations.push(method);
      const matched = matches(filter);
      if (matched) Object.assign(state.session, update.$set);
      return method === 'updateOne' ? { acknowledged: true, matchedCount: Number(Boolean(matched)) }
        : matched ? state.session : null;
    });
  }
  t.mock.method(User, 'findById', async (id) => (id === currentUser?._id ? currentUser : null));
  return state;
}

const controller = createBrowserAuthController({ authService, tokenService, cookies: createCookieWriter('production') });
const request = (cookie) => ({ headers: { cookie }, body: { refreshToken: 'not-used-by-browser' } });

function response() {
  return {
    written: [],
    cleared: [],
    cookie(...args) { this.written.push(args); },
    clearCookie(...args) { this.cleared.push(args); },
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; },
  };
}

function assertNoResponseChanges(res) {
  assert.deepEqual(res.written, []);
  assert.deepEqual(res.cleared, []);
  assert.equal(res.body, undefined);
}

test('browser refresh requires HS256, signature, expiration and browser refresh claims before querying models', async (t) => {
  const state = fakeModels(t);
  for (const token of [
    jwt.sign(browserClaims, refreshKey),
    jwt.sign(JSON.stringify(browserClaims).slice(0, -1) + ',"exp":1e999}', refreshKey),
    signRefresh(browserClaims, { expiresIn: -60 }),
    signRefresh(browserClaims, { algorithm: 'HS384' }),
    jwt.sign(browserClaims, accessKey, { expiresIn: 60 }),
    signRefresh({ ...browserClaims, tokenUse: 'access' }),
    signRefresh({ ...browserClaims, sub: 7 }),
    signRefresh({ ...browserClaims, sid: undefined }),
    signRefresh({ ...browserClaims, jti: '' }),
    signRefresh({ ...browserClaims, tokenChannel: 'another-channel' }),
  ]) await assert.rejects(tokenService.refreshBrowserSession(token), invalid);
  assert.equal(state.reads, 0);
  assert.deepEqual(state.mutations, []);
});

test('browser rejects missing, expired, revoked, replaced, or mismatched sessions without setting or clearing cookies', async (t) => {
  const token = signRefresh();
  const state = fakeModels(t);
  for (const session of [
    null,
    { ...sessionFor(token), _id: 'another-sid' },
    { ...sessionFor(token), userId: 'another-user' },
    { ...sessionFor(token), currentJti: 'already-rotated' },
    { ...sessionFor(token), tokenHash: hash('different-value') },
    { ...sessionFor(token), revokedAt: new Date() },
    { ...sessionFor(token), expiresAt: new Date(Date.now() - 1000) },
  ]) {
    state.session = session;
    const res = response();
    await assert.rejects(controller.refresh(request(`pm_refresh=${token}`), res), invalid);
    assertNoResponseChanges(res);
  }
  for (const cookie of [undefined, 'pm_refresh=a.b.c', 'pm_refresh=a.b.c; pm_refresh=d.e.f']) {
    const res = response();
    await assert.rejects(controller.refresh(request(cookie), res), invalid);
    assertNoResponseChanges(res);
  }
  assert.deepEqual(state.mutations, []);
});

test('browser refresh rejects missing and inactive users', async (t) => {
  const token = signRefresh();
  const state = fakeModels(t, sessionFor(token));
  const findUser = User.findById;
  for (const current of [null, { ...user, active: false }]) {
    findUser.mock.mockImplementationOnce(async () => current);
    await assert.rejects(tokenService.refreshBrowserSession(token), invalid);
  }
  assert.deepEqual(state.mutations, []);
});

test('two overlapping browser refreshes reuse the original cookie without writes or extending the session', async (t) => {
  const token = signRefresh();
  const session = { ...sessionFor(token), expiresAt: new Date(Date.now() + 180000) };
  const state = fakeModels(t, session);
  const snapshot = { ...session };
  const originalExpiry = Math.floor(session.expiresAt.getTime() / 1000);
  const results = [response(), response()];
  await Promise.all([
    controller.refresh(request(`pm_refresh=${token}; pm_refresh=${token}`), results[0]),
    controller.refresh(request(`pm_refresh=${token}`), results[1]),
  ]);
  assert.equal(state.reads, 2);
  assert.equal(state.maxConcurrentReads, 2);
  assert.deepEqual(state.mutations, []);
  assert.deepEqual(state.session, snapshot);
  for (const res of results) {
    assert.equal(res.code, 200);
    assert.deepEqual(res.body, { success: true, data: { user: { name: user.name } } });
    assert.deepEqual(res.cleared, []);
    assert.deepEqual(res.written.map(([name]) => name), ['pm_access']);
    const access = jwt.verify(res.written[0][1], accessKey, { algorithms: ['HS256'] });
    assert.equal(access.exp, originalExpiry);
    assert.equal(access.sid, claims.sid);
    assert.equal(access.sub, user._id);
    assert.equal(access.tokenUse, 'access');
    assert.equal(access.role, user.role);
  }
});

test('browser register and login issue both cookies and persist seven days despite the 30-day JSON setting', async (t) => {
  const state = fakeModels(t);
  t.mock.method(userService, 'createUser', async () => user);
  t.mock.method(User, 'findOne', () => ({ select: async () => user }));
  t.mock.method(bcrypt, 'compare', async () => true);
  for (const [method, status] of [['register', 201], ['login', 200]]) {
    const res = response();
    const before = Date.now();
    await controller[method]({ body: { email: 'test@example.test', password: 'synthetic' } }, res);
    const after = Date.now();
    assert.equal(res.code, status);
    assert.deepEqual(res.body, { success: true, data: { user: { name: user.name } } });
    assert.deepEqual(res.written.map(([name]) => name), ['pm_access', 'pm_refresh']);
    const [[, access], [, refresh, { maxAge }]] = res.written;
    const verified = tokenService.verifyRefreshToken(refresh);
    const expiry = verified.exp * 1000;
    assert.equal(verified.tokenChannel, 'browser');
    assert.equal(verified.exp - verified.iat, 7 * SECONDS_PER_DAY);
    assert.equal(state.session.expiresAt.getTime(), expiry);
    assert.ok(maxAge >= expiry - after && maxAge <= expiry - before);
    assert.equal(state.session.tokenHash, hash(refresh));
    assert.equal(jwt.decode(access).exp, verified.exp);
  }
  assert.deepEqual(state.mutations, ['create', 'create']);
});

test('JSON issuance keeps its JWT shape and configured lifetimes; browser endpoints reject unmarked tokens', async (t) => {
  const state = fakeModels(t);
  const pair = await tokenService.issueTokens(user);
  const jsonAccess = jwt.verify(pair.accessToken, accessKey, { algorithms: ['HS256'] });
  const jsonRefresh = tokenService.verifyRefreshToken(pair.refreshToken);
  assert.equal(jsonAccess.exp - jsonAccess.iat, 10 * SECONDS_PER_DAY);
  assert.equal(jsonRefresh.exp - jsonRefresh.iat, 30 * SECONDS_PER_DAY);
  assert.equal(pair.refreshTokenExpiresIn, '30d');
  assert.equal(state.session.expiresAt.getTime(), jsonRefresh.exp * 1000);
  assert.equal(Object.hasOwn(jsonRefresh, 'tokenChannel'), false);

  const req = request(`pm_refresh=${pair.refreshToken}`);
  const res = response();
  await assert.rejects(controller.refresh(req, res), invalid);
  assertNoResponseChanges(res);
  await controller.logout(req, response());
  assert.equal(state.reads, 0);
  assert.equal(state.session.revokedAt, null);
  assert.deepEqual(state.mutations, ['create']);
});

test('JSON rotation cannot touch a browser session; its original refresh still works and can log out', async (t) => {
  const state = fakeModels(t);
  const { refreshToken } = await tokenService.issueTokens(user, { browser: true });
  const original = { ...state.session };
  await assert.rejects(jsonController.refresh({ body: { refreshToken } }, response()), invalid);
  assert.equal(Tokens.findById.mock.callCount(), 0);
  assert.deepEqual(state.mutations, ['create']);
  assert.deepEqual(state.session, original);

  const req = request(`pm_refresh=${refreshToken}`);
  const refreshed = response();
  await controller.refresh(req, refreshed);
  assert.equal(refreshed.code, 200);
  assert.deepEqual(refreshed.written.map(([name]) => name), ['pm_access']);
  assert.equal(jwt.decode(refreshed.written[0][1]).sid, original._id);
  assert.deepEqual(state.mutations, ['create']);
  assert.deepEqual(state.session, original);

  const loggedOut = response();
  await controller.logout(req, loggedOut);
  assert.equal(loggedOut.code, 200);
  assert.equal(state.session.revokeReason, 'logout');
  assert.deepEqual(state.mutations, ['create', 'updateOne']);
  await assert.rejects(controller.refresh(req, response()), invalid);
});

test('logout revokes a unique current refresh once even with malformed access or a repeated identical refresh', async (t) => {
  const token = signRefresh();
  const state = fakeModels(t);
  for (const cookie of [
    `pm_access="malformed"; pm_refresh=${token}; pm_access=a.b.c`,
    `pm_refresh=${token}; pm_refresh=${token}`,
  ]) {
    state.session = sessionFor(token);
    const res = response();
    await controller.logout(request(cookie), res);
    assert.equal(res.code, 200);
    assert.deepEqual(res.body, { success: true, data: { user: null } });
    assert.deepEqual(res.cleared.map(([name]) => name), ['pm_access', 'pm_refresh']);
    assert.deepEqual(res.written, []);
    assert.equal(state.session.revokeReason, 'logout');
  }
  assert.deepEqual(state.mutations, ['updateOne', 'updateOne']);
});

test('logout clears absent, invalid or expired refresh but rejects ambiguous or malformed headers', async (t) => {
  const token = signRefresh();
  const state = fakeModels(t, sessionFor(token));
  for (const cookie of [undefined, 'pm_refresh=a.b.c', `pm_refresh=${signRefresh(browserClaims, { expiresIn: -60 })}`]) {
    const res = response();
    await controller.logout(request(cookie), res);
    assert.equal(res.code, 200);
    assert.equal(res.cleared.length, 2);
  }
  for (const cookie of [
    `pm_refresh=${token}; pm_refresh=a.b.c`,
    `pm_refresh=${token}; pm_refresh="malformed"`,
    'pm_refresh ="malformed"',
  ]) {
    const res = response();
    await assert.rejects(controller.logout(request(cookie), res), invalid);
    assertNoResponseChanges(res);
  }
  assert.deepEqual(state.mutations, []);
  assert.equal(state.session.revokedAt, null);
});

test('logout with a verified but noncurrent token cannot revoke the current session', async (t) => {
  const token = signRefresh();
  const state = fakeModels(t);
  for (const session of [
    { ...sessionFor(token), currentJti: 'different' },
    { ...sessionFor(token), tokenHash: hash('different') },
  ]) {
    state.session = session;
    const res = response();
    await controller.logout(request(`pm_refresh=${token}`), res);
    assert.equal(res.code, 200);
    assert.equal(res.cleared.length, 2);
    assert.equal(state.session.revokedAt, null);
  }
});

test('logout configuration, rejected update and unacknowledged write errors cannot claim success', async (t) => {
  const token = signRefresh();
  const state = fakeModels(t, sessionFor(token));
  const req = request(`pm_refresh=${token}`);
  const configRes = response();
  process.env.JWT_SECRET = 'short';
  try {
    await assert.rejects(controller.logout(req, configRes), { statusCode: 500, code: 'AUTH_CONFIGURATION_ERROR' });
  } finally {
    process.env.JWT_SECRET = accessKey;
  }
  assertNoResponseChanges(configRes);
  assert.deepEqual(state.mutations, []);

  const failure = new Error('synthetic revocation failure');
  Tokens.updateOne.mock.mockImplementationOnce(async () => { throw failure; });
  const errorRes = response();
  await assert.rejects(controller.logout(req, errorRes), (error) => error === failure);
  assertNoResponseChanges(errorRes);

  Tokens.updateOne.mock.mockImplementationOnce(async () => ({ acknowledged: false }));
  const unackedRes = response();
  await assert.rejects(controller.logout(req, unackedRes), { statusCode: 500, code: 'BROWSER_LOGOUT_FAILED' });
  assertNoResponseChanges(unackedRes);
});

test('old JSON refresh still rotates, returns the pair, and revokes the family on reuse', async (t) => {
  const token = signRefresh(claims);
  const state = fakeModels(t, sessionFor(token));
  const rotate = t.mock.method(tokenService, 'rotateRefreshToken');
  const req = { body: { refreshToken: token } };
  const res = response();
  await jsonController.refresh(req, res);
  assert.equal(rotate.mock.callCount(), 1);
  assert.deepEqual(rotate.mock.calls[0].arguments, [token]);
  assert.equal(res.code, 200);
  const { data } = res.body;
  assert.equal(data.tokenType, 'Bearer');
  assert.equal(data.accessTokenExpiresIn, '10d');
  assert.equal(data.refreshTokenExpiresIn, '30d');
  assert.equal(data.user.passwordHash, undefined);
  assert.ok(data.accessToken);
  assert.notEqual(data.refreshToken, token);
  const next = tokenService.verifyRefreshToken(data.refreshToken);
  assert.equal(Object.hasOwn(next, 'tokenChannel'), false);
  assert.equal(next.exp - next.iat, 30 * SECONDS_PER_DAY);
  assert.equal(state.session.expiresAt.getTime(), next.exp * 1000);
  assert.equal(state.session.tokenHash, hash(data.refreshToken));
  assert.deepEqual(state.mutations, ['findOneAndUpdate']);

  await assert.rejects(jsonController.refresh(req, response()), { statusCode: 401, code: 'REFRESH_TOKEN_REUSED' });
  assert.equal(state.session.revokeReason, 'refresh_token_reuse');
  assert.deepEqual(state.mutations, ['findOneAndUpdate', 'updateOne']);
});
