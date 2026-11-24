const { REFRESH_COOKIE, readBrowserCookies, invalidRefresh } = require('../security/browserAuthCookies');

const createBrowserAuthController = ({ authService, tokenService, cookies }) => {
  const sendUser = (res, status, user) => {
    res.status(status).json({ success: true, data: { user: { name: user.name } } });
  };

  return {
    async register(req, res) {
      const session = await authService.register(req.body, { browser: true });
      cookies.set(res, session);
      sendUser(res, 201, session.user);
    },
    async login(req, res) {
      const session = await authService.login(req.body, { browser: true });
      cookies.set(res, session);
      sendUser(res, 200, session.user);
    },
    async refresh(req, res) {
      const refreshToken = readBrowserCookies(req.headers.cookie)[REFRESH_COOKIE];
      if (!refreshToken) throw invalidRefresh();
      const { user, accessToken } = await authService.refreshBrowserSession(refreshToken);
      cookies.setAccess(res, accessToken);
      sendUser(res, 200, user);
    },
    async logout(req, res) {
      // Una cookie de acceso dañada no impide revocar la sesión por su refresh vigente.
      const refreshToken = readBrowserCookies(req.headers.cookie, { refreshOnly: true })[REFRESH_COOKIE];
      if (refreshToken) await tokenService.logoutBrowserSession(refreshToken);
      cookies.clear(res);
      res.status(200).json({ success: true, data: { user: null } });
    },
  };
};

module.exports = { createBrowserAuthController };
