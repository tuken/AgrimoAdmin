module.exports = function requireAuth(req, res, next) {
  const openPaths = new Set(['/signin', '/signout']);
  if (openPaths.has(req.path)) return next();
  if (req.session && req.session.user) return next();
  return res.redirect('/signin');
};
