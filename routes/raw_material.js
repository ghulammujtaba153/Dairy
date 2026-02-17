const express = require('express');
const router = express.Router();
const rawMaterialController = require('../controllers/raw_material.controller');
const { authenticateToken } = require('../utils/auth');

/**
 * Raw Material Routes
 * All routes are protected
 */

router.use(authenticateToken);

// Statistics route (place before parameterized routes)
router.get('/stats', rawMaterialController.getStats.bind(rawMaterialController));

// CRUD routes
router.get('/', rawMaterialController.getAll.bind(rawMaterialController));
router.post('/', rawMaterialController.create.bind(rawMaterialController));
router.put('/:id', rawMaterialController.update.bind(rawMaterialController));
router.delete('/:id', rawMaterialController.delete.bind(rawMaterialController));

module.exports = router;
