const express = require('express');
const { findAuthContextByEmail, canUserSignIn, verifyPassword, toSafeUser, updateLastLoginAt } = require('../models/user');
const router = express.Router();

/*
  * ログイン画面表示
*/
router.get('/signin', (req, res) => {
    req.session.destroy();
    req.session = null;

    res.render('pages/signin', { title: 'サインイン', error: null });
});

/*
  * ログイン処理
*/
router.post('/signin', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) 
      return res.render('pages/signin', { title: 'サインイン', error: 'メールアドレスとパスワードを入力してください' });

    try {
        const ctx = await findAuthContextByEmail(email);
        const userRow = ctx ? ctx.user : null;
        const ok = await verifyPassword(userRow, password);
        if (!ok) {
            return res.render('pages/signin', { title: 'サインイン', error: 'メールアドレスまたはパスワードが正しくありません' });
        }

        const allowed = await canUserSignIn(userRow);
        if (!allowed) {
            return res.render('pages/signin', { title: 'サインイン', error: '紐づくオーナーが存在しないためログインできません' });
        }

        // ログイン日時更新
        await updateLastLoginAt(userRow.id);

        req.session.user = toSafeUser(userRow);
        // attach org (0/1) and fields (0..N) for downstream (e.g., weather)
        req.session.user.org = ctx ? ctx.org : null;
        req.session.user.fields = ctx ? (ctx.fields || []) : [];
        delete req.session.token;

        return res.redirect('/top');
    } catch (e) {
        console.error('signin error', e);
        return res.render('pages/signin', { title: 'サインイン', error: 'ログイン処理でエラーが発生しました' });
    }
});

/* サインアウト */
router.get('/signout', (req, res) => {
    req.session.destroy(() => res.redirect('/signin'));
});

module.exports = router;
