const express = require('express');
const router = express.Router();
const salesController = require('../controllers/sales.controller');

/**
 * Sales Routes
 */

router.get('/', salesController.getAll);
router.get('/stats', salesController.getStats);
router.post('/', salesController.create);
router.put('/:id', salesController.update);
router.delete('/:id', salesController.delete);

module.exports = router;
