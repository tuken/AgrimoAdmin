const { AsyncLocalStorage } = require('async_hooks');

const als = new AsyncLocalStorage();

function requestContextMiddleware(req, res, next) {
  const store = {
    sessionId: req.sessionID || null,
    requestId: req.headers['x-request-id'] || null,
  };
  als.run(store, () => next());
}

function getRequestContext() {
  return als.getStore() || null;
}

module.exports = {
  requestContextMiddleware,
  getRequestContext,
};
