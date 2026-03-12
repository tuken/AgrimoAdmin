const { AsyncLocalStorage } = require('async_hooks');

const als = new AsyncLocalStorage();

/**
 * Httpリクエストごとに、セッションIDやリクエストIDなどのコンテキスト情報を保存するミドルウェア。
 * これにより、リクエストのライフサイクル全体で、明示的に引き渡さなくてもコンテキスト情報にアクセスできるようになる。
 */
function requestContextMiddleware(req, res, next) {
  const store = {
    sessionId: req.sessionID || null,
    requestId: req.headers['x-request-id'] || null,
  };
  als.run(store, () => next());
}

/**
 * 現在のリクエストコンテキストを取得するユーティリティ関数。
 * ミドルウェア内で設定されたコンテキスト情報（例: sessionId, requestId）にアクセスできる。
 * @returns {Object|null} 現在のリクエストコンテキストオブジェクト、または利用できない場合はnull。
 */
function getRequestContext() {
  return als.getStore() || null;
}

module.exports = {
  requestContextMiddleware,
  getRequestContext,
};
