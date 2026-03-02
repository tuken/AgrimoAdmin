const express = require('express');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();
router.use(requireAuth);

router.get('/field_list', (req, res) => {
  res.render('pages/field_list', {
    title: '圃場一覧',
    user: req.session.user || null,
    activeKey: 'field'
  });
});

module.exports = router;
