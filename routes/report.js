const express = require('express');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();
router.use(requireAuth);

router.get('/report_list', (req, res) => {
  res.render('pages/report_list', {
    title: '日報一覧',
    user: req.session.user || null,
    activeKey: 'report',
    pageCss: 'report',
    pageJs: 'report'
  });
});

module.exports = router;
