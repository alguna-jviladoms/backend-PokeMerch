const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const test = require('node:test');
const { setTimeout: delay } = require('node:timers/promises');
const { pathToFileURL } = require('node:url');
const jwt = require('jsonwebtoken');
const { createBrowserAuthController } = require('../src/controllers/browserAuthController');
const { createCookieWriter, readBrowserCookies } = require('../src/security/browserAuthCookies');
const { createOriginGuard, getAllowedOrigins, hasAllowedSource } = require('../src/security/browserAuthOrigin');

const goodOrigin = 'https://shop.example';
const anotherOrigin = 'https://other.example';
const getProductionOrigins = (AUTH_ALLOWED_ORIGINS) => getAllowedOrigins({ NODE_ENV: 'production', AUTH_ALLOWED_ORIGINS });

function fakeResponse() {
  return {
    written: [],
    cleared: [],
    cookie(...args) { this.written.push(args); },
    clearCookie(...args) { this.cleared.push(args); },
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; },
  };
}

test('only accepts exact configured HTTPS origins and consistent Referer headers', () => {
  const allowed = getProductionOrigins(`${goodOrigin},${anotherOrigin},http://localhost:5173,*,https://bad.example/path`);
  assert.deepEqual([...allowed], [goodOrigin, anotherOrigin]);
  assert.equal(hasAllowedSource({ origin: goodOrigin }, allowed), true);
  assert.equal(hasAllowedSource({ origin: goodOrigin, referer: `${goodOrigin}/login` }, allowed), true);
  assert.equal(hasAllowedSource({ origin: goodOrigin, 'sec-fetch-site': 'same-origin' }, allowed), true);
  for (const headers of [
    {},
    { host: 'shop.example', 'x-forwarded-host': 'shop.example', 'x-forwarded-proto': 'https' },
    { origin: 'null', referer: `${goodOrigin}/login` },
    { origin: goodOrigin, 'sec-fetch-site': 'same-site' },
    { origin: `${goodOrigin}.evil.example` },
    { origin: `${goodOrigin}:8443` },
    { origin: `${goodOrigin}/` },
    { origin: `${goodOrigin},${anotherOrigin}` },
    { origin: goodOrigin, referer: `${anotherOrigin}/login` },
    { origin: goodOrigin, referer: 'https:shop.example/login' },
    { origin: goodOrigin, referer: 'https:///shop.example/login' },
    { origin: goodOrigin, referer: 'https://user:password@shop.example/login' },
    { referer: `${goodOrigin}/login` },
  ]) {
    assert.equal(hasAllowedSource(headers, allowed), false, JSON.stringify(headers));
  }
});

test('an allowed Referer without Origin gets 403 before calling the login service', async () => {
  let serviceCalls = 0;
  const controller = createBrowserAuthController({
    authService: { async login() { serviceCalls += 1; } },
  });
  const guard = createOriginGuard(getProductionOrigins(goodOrigin));
  await assert.rejects(Promise.resolve().then(() => {
    const req = { headers: { referer: `${goodOrigin}/login` } };
    return guard(req, fakeResponse(), (error) => {
      if (error) throw error;
      return controller.login(req, fakeResponse());
    });
  }), { statusCode: 403, code: 'AUTH_ORIGIN_DENIED' });
  assert.equal(serviceCalls, 0);
});

test('origin guard fails closed if production has no valid HTTPS origin', () => {
  const headers = { origin: goodOrigin };
  for (const config of [undefined, '', '*,http://localhost:5173,https://invalid.example/']) {
    createOriginGuard(getProductionOrigins(config))({ headers }, {}, (error) => {
      assert.equal(error.statusCode, 503);
      assert.equal(error.code, 'BROWSER_AUTH_UNAVAILABLE');
    });
  }
  createOriginGuard(getProductionOrigins(anotherOrigin))({ headers }, {}, (error) => {
    assert.equal(error.statusCode, 403);
  });
  createOriginGuard(getProductionOrigins(goodOrigin))({ headers }, {}, (error) => {
    assert.equal(error, undefined);
  });
  const dev = getAllowedOrigins({ NODE_ENV: 'development', AUTH_ALLOWED_ORIGINS: goodOrigin });
  assert.equal(hasAllowedSource({ origin: 'http://localhost:5173' }, dev), true);
  assert.equal(hasAllowedSource({ origin: 'http://127.0.0.1:5173' }, dev), true);
  assert.equal(hasAllowedSource({ origin: 'http://localhost:5174' }, dev), false);
  assert.equal(hasAllowedSource({ origin: goodOrigin }, dev), false);
});

test('reads only browser session cookies, deduplicating exact copies and rejecting conflicts', () => {
  assert.deepEqual(readBrowserCookies('pm_access=a.b.c; pm_refresh=d.e.f; preferences=%ZZ'), {
    pm_access: 'a.b.c', pm_refresh: 'd.e.f',
  });
  assert.deepEqual(readBrowserCookies('pm_access=a.b.c; pm_access=a.b.c; pm_refresh=d.e.f; pm_refresh=d.e.f'), {
    pm_access: 'a.b.c', pm_refresh: 'd.e.f',
  });
  assert.deepEqual(readBrowserCookies(), {});
  for (const header of [
    'pm_refresh=a.b.c; pm_refresh=d.e.f',
    'pm_refresh=a.b.c; pm_refresh="a.b.c"',
    'pm_access=a.b.c; pm_access=d.e.f',
    'pm_refresh=a.b.%63',
    'pm_refresh=a.b.c\n',
    'pm_refresh="a.b.c"',
    'pm_refresh =a.b.c',
    'pm_refresh=',
    'pm_refresh',
  ]) {
    assert.throws(() => readBrowserCookies(header), { statusCode: 401, code: 'INVALID_REFRESH_TOKEN' });
  }
});

test('session cookie flags and scope are identical when clearing, with lifetimes from JWT exp', () => {
  const accessToken = jwt.sign({}, 'synthetic-cookie-test-key', { expiresIn: 40 });
  const refreshToken = jwt.sign({}, 'synthetic-cookie-test-key', { expiresIn: 80 });
  for (const environment of ['production', 'development', undefined]) {
    const res = fakeResponse();
    const writer = createCookieWriter(environment);
    const before = Date.now();
    writer.set(res, { accessToken, refreshToken });
    const after = Date.now();
    writer.clear(res);
    const options = { httpOnly: true, secure: environment !== 'development', sameSite: 'lax', path: '/api/auth/browser' };
    assert.deepEqual(res.cleared, [['pm_access', options], ['pm_refresh', options]]);
    assert.equal(res.written.length, 2);
    res.written.forEach(([name, value, { maxAge, ...flags }], index) => {
      assert.equal(name, ['pm_access', 'pm_refresh'][index]);
      assert.equal(value, [accessToken, refreshToken][index]);
      assert.deepEqual(flags, options);
      const expiry = jwt.decode(value).exp * 1000;
      assert.ok(maxAge >= expiry - after && maxAge <= expiry - before);
    });
  }
});

test('controller propagates service failures without setting or clearing cookies', async () => {
  for (const target of ['logout', 'refresh']) {
    const failure = new Error(target);
    const controller = createBrowserAuthController({
      authService: { refreshBrowserSession: async () => { throw failure; } },
      tokenService: { logoutBrowserSession: async () => { throw failure; } },
      cookies: createCookieWriter('production'),
    });
    const res = fakeResponse();
    await assert.rejects(controller[target]({ headers: { cookie: 'pm_refresh=a.b.c' } }, res), (error) => error === failure);
    assert.deepEqual(res.cleared, []);
    assert.deepEqual(res.written, []);
    assert.equal(res.body, undefined);
  }
});

test('a delayed refresh response cannot overwrite a newer refresh cookie or restore one after logout', async () => {
  const sign = (label) => jwt.sign({ label }, 'synthetic-cookie-test-key', { expiresIn: 80 });
  const oldRefresh = sign('old refresh');
  const oldAccess = sign('old access');
  const newSession = { user: { name: 'Misty' }, accessToken: sign('new access'), refreshToken: sign('new refresh') };
  const controller = createBrowserAuthController({
    authService: {
      async refreshBrowserSession(token) {
        assert.equal(token, oldRefresh);
        return { user: { name: 'Ash' }, accessToken: oldAccess };
      },
      async login() { return newSession; },
    },
    tokenService: {
      async logoutBrowserSession(token) { assert.equal(token, oldRefresh); },
    },
    cookies: createCookieWriter('production'),
  });
  const req = { headers: { cookie: `pm_refresh=${oldRefresh}` } };
  for (const [action, expectedRefresh] of [['login', newSession.refreshToken], ['logout', undefined]]) {
    const jar = new Map([['pm_refresh', oldRefresh]]);
    const deliver = (res) => {
      for (const [name, value] of res.written) jar.set(name, value);
      for (const [name] of res.cleared) jar.delete(name);
    };
    const delayed = fakeResponse();
    await controller.refresh(req, delayed);
    const latest = fakeResponse();
    await controller[action](req, latest);
    deliver(latest);
    assert.equal(jar.get('pm_refresh'), expectedRefresh);

    deliver(delayed);
    assert.equal(jar.get('pm_access'), oldAccess, 'the delayed response did arrive');
    assert.equal(jar.get('pm_refresh'), expectedRefresh);
  }
});

// Opt in with PM_BROWSER_TEST_PLAYWRIGHT pointing to the entry point of an installed
// Playwright. Use a loopback Vite middleware and synthetic cookies, never the real API.
const playwrightPath = process.env.PM_BROWSER_TEST_PLAYWRIGHT;
for (const webLocks of [true, false]) {
  test(`two browser tabs serialize refresh and reject a stale logout (Web Locks: ${webLocks})`, {
    skip: playwrightPath ? false : 'PM_BROWSER_TEST_PLAYWRIGHT is not set',
    timeout: 35000,
  }, async (t) => {
    const frontend = resolve(__dirname, '../../../frontend/frontend-react');
    const dependency = (name) => import(pathToFileURL(require.resolve(name, { paths: [frontend] })));
    const { chromium } = await import(pathToFileURL(playwrightPath));
    const { createServer } = await dependency('vite');
    const { default: react } = await dependency('@vitejs/plugin-react');
    const { default: tailwind } = await dependency('@tailwindcss/vite');
    let token = '0';
    let generation = 0;
    let name = 'Ash';
    let refreshes = 0;
    let activeRefreshes = 0;
    let peakRefreshes = 0;
    let logouts = 0;
    const tokensSeen = [];
    let loginStarted;
    let finishLogin;
    const loginEntered = new Promise((done) => { loginStarted = done; });
    const loginMayFinish = new Promise((done) => { finishLogin = done; });
    const server = await createServer({
      root: frontend,
      configFile: false,
      envDir: false,
      plugins: [react(), tailwind(), {
        name: 'synthetic-browser-auth',
        configureServer(vite) {
          vite.middlewares.use(async (req, res, next) => {
            const action = req.url.match(/^\/api\/auth\/browser\/(refresh|login|logout)$/u)?.[1];
            if (req.method !== 'POST' || !action) return next();
            const presented = req.headers.cookie?.match(/(?:^|;\s*)pm_refresh=(\d+)/u)?.[1];
            const reply = (status, body, cookie) => {
              res.statusCode = status;
              res.setHeader('Content-Type', 'application/json');
              if (cookie) res.setHeader('Set-Cookie', `pm_refresh=${cookie}; HttpOnly; Path=/api/auth/browser`);
              res.end(JSON.stringify(body));
            };
            const success = (user, cookie) => reply(200, { success: true, data: { user } }, cookie);
            if (action === 'login') {
              loginStarted();
              await loginMayFinish;
              name = 'Misty';
              token = String(++generation);
              return success({ name }, token);
            }
            if (action === 'logout') {
              logouts += 1;
              token = null;
              return success(null, '; Max-Age=0');
            }
            refreshes += 1;
            tokensSeen.push(presented);
            activeRefreshes += 1;
            peakRefreshes = Math.max(peakRefreshes, activeRefreshes);
            await delay(200);
            activeRefreshes -= 1;
            if (!token || presented !== token) {
              return reply(401, { success: false, error: { code: 'INVALID_REFRESH_TOKEN' } });
            }
            return success({ name });
          });
        },
      }],
      server: { host: '127.0.0.1', port: 0 },
    });
    t.after(() => { finishLogin(); return server.close(); });
    await server.listen();
    const url = `http://127.0.0.1:${server.httpServer.address().port}`;
    const browser = await chromium.launch({ channel: process.env.PM_BROWSER_TEST_CHANNEL });
    t.after(() => browser.close());
    const context = await browser.newContext();
    await context.route('**/*', (route) => route.request().url().startsWith(`${url}/`) ? route.continue() : route.abort());
    await context.addInitScript((enabled) => {
      if (!enabled) Object.defineProperty(navigator, 'locks', { value: undefined });
      addEventListener('storage', (event) => {
        if (window.ignoreSessionStorageEvent) event.stopImmediatePropagation();
      }, true);
    }, webLocks);
    await context.addCookies([{ name: 'pm_refresh', value: token, domain: '127.0.0.1', path: '/api/auth/browser', httpOnly: true }]);
    const [first, second] = await Promise.all([context.newPage(), context.newPage()]);
    const ready = Promise.all([first, second].map((page) => page.waitForResponse('**/api/auth/browser/refresh')));
    await Promise.all([first.goto(`${url}/home`), second.goto(`${url}/login`)]);
    for (const response of await ready) assert.equal(response.status(), 200);
    assert.equal(await second.evaluate(() => Boolean(navigator.locks)), webLocks);
    await first.getByText('Hola, Ash', { exact: true }).waitFor();
    assert.equal(refreshes, 2, 'one bootstrap request per StrictMode tab');
    assert.equal(peakRefreshes, 1);
    assert.deepEqual(tokensSeen, ['0', '0']);

    // Simulate a suspended tab that missed the account-switch broadcast.
    await first.evaluate(() => { window.ignoreSessionStorageEvent = true; });
    await second.getByLabel('Correo electrónico').fill('misty@example.test');
    await second.getByLabel('Contraseña').fill('synthetic-test-password');
    await second.getByRole('button', { name: 'Iniciar sesión' }).click();
    await loginEntered;
    await first.getByRole('button', { name: 'Cerrar sesión' }).evaluate((button) => button.click());
    finishLogin();
    for (const page of [first, second]) await page.getByText('Hola, Misty', { exact: true }).waitFor();
    assert.equal(logouts, 0, 'the stale Ash button must not revoke Misty');
    const snapshot = await first.evaluate(() => JSON.parse(localStorage.getItem('pokemerch-browser-session:public')));
    assert.deepEqual(snapshot, { status: 'authenticated', user: { name: 'Misty' }, revision: snapshot.revision });

    // Queue a valid logout while another tab boots; the boot cannot restore it afterward.
    const boot = first.waitForRequest('**/api/auth/browser/refresh');
    const reload = first.reload();
    await boot;
    await second.getByRole('button', { name: 'Cerrar sesión' }).click();
    await reload;
    for (const page of [first, second]) {
      await page.getByRole('link', { name: 'Cuenta' }).waitFor();
      assert.equal(await page.getByText('Hola, Misty', { exact: true }).count(), 0);
    }
    assert.equal(logouts, 1);
    assert.equal(token, null);

    if (!webLocks) {
      const requestsBefore = refreshes;
      const unsupported = await context.newPage();
      await unsupported.addInitScript(() => Object.defineProperty(window, 'indexedDB', { value: undefined }));
      await unsupported.goto(`${url}/home`);
      await unsupported.getByText('No se pudo comprobar la sesión.', { exact: false }).waitFor();
      assert.equal(refreshes, requestsBefore, 'without either lock, bootstrap does not send a refresh');
    }
  });
}
