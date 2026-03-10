const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const { findAuthContextByUserId } = require('../models/user');

const router = express.Router();
router.use(requireAuth);

async function refreshSessionUserFields(req) {
  const sessionUser = req.session?.user || null;
  if (!sessionUser?.id) return;
  try {
    const ctx = await findAuthContextByUserId(sessionUser.id);
    if (!ctx?.user) return;
    req.session.user = {
      ...req.session.user,
      ...ctx.user,
      org: ctx.org || null,
      fields: Array.isArray(ctx.fields) ? ctx.fields : [],
    };
  } catch (err) {
    console.error('[user_list] session field refresh failed:', err);
  }
}

router.get('/user_list', async (req, res) => {
  await refreshSessionUserFields(req);
  const roleId = Number(req.session?.user?.role_id ?? req.session?.user?.roleId ?? req.session?.user?.roleID ?? req.session?.user?.role_type ?? req.session?.user?.roleType);
  // role_id=1 のみユーザー一覧を閲覧可（UI非表示だけだと直リンクできるため）
  // if (roleId !== 1) return res.redirect('/top');

  res.render('pages/user_list', {
    title: 'ユーザー一覧',
    user: req.session.user || null,
    activeKey: 'user'
  });
});

module.exports = router;
