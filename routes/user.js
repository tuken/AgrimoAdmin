const express = require('express');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();
router.use(requireAuth);

router.get('/user_list', (req, res) => {
  const roleId = Number(req.session?.user?.role_id);
  // role_id=1 のみユーザー一覧を閲覧可（UI非表示だけだと直リンクできるため）
  if (roleId !== 1) return res.redirect('/top');

  res.render('pages/user_list', {
    title: 'ユーザー一覧',
    user: req.session.user || null,
    activeKey: 'user'
  });
});

module.exports = router;
