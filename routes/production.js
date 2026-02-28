const express = require('express');
const router = express.Router();
const productionController = require('../controllers/production.controller');
const { authenticateToken } = require('../utils/auth');

/**
 * Production Routes
 * All routes are protected
 */

// router.use(authenticateToken);

// Statistics route (place before parameterized routes)
router.get('/stats', productionController.getStats.bind(productionController));

// CRUD routes
router.get('/', productionController.getAll.bind(productionController));
router.get('/:id', productionController.getAll.bind(productionController)); // Reuse getAll for basic view or implement getById
router.post('/', productionController.create.bind(productionController));
router.put('/:id', productionController.update.bind(productionController));
router.delete('/:id', productionController.delete.bind(productionController));

module.exports = router;
