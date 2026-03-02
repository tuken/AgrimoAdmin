const express = require('express');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => res.redirect('/top'));

module.exports = router;
