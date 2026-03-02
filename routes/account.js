const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const { updateProfile, updatePassword, toSafeUser } = require('../models/user');

const router = express.Router();

router.use(requireAuth);

// Update profile (email, last_name, first_name)
router.post('/profile', async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    const { email, lastName, firstName } = req.body || {};
    const updatedRow = await updateProfile(userId, { email, lastName, firstName });

    // update session
    req.session.user = toSafeUser(updatedRow);

    return res.status(200).json({ ok: true, message: '保存しました' });
  } catch (e) {
    return res.status(400).json({ ok: false, error: e.message || '保存に失敗しました' });
  }
});

// Update password (new password + confirm)
router.post('/password', async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    const { password, passwordConfirm } = req.body || {};

    if (String(password || '') !== String(passwordConfirm || '')) {
      return res.status(400).json({ ok: false, error: 'パスワードが一致しません' });
    }

    await updatePassword(userId, password);
    return res.status(200).json({ ok: true, message: '変更しました' });
  } catch (e) {
    return res.status(400).json({ ok: false, error: e.message || '変更に失敗しました' });
  }
});

module.exports = router;
