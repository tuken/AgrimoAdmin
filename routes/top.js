const express = require('express');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

// TOP is protected
router.use(requireAuth);

router.get('/', (req, res) => {
  res.render('pages/top', { title: 'トップ', user: req.session.user || null, activeKey: 'top' });
});

module.exports = router;
