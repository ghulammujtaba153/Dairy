const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventory.controller');

/**
 * Inventory Routes
 */

router.get('/', inventoryController.getStock.bind(inventoryController));
router.get('/movements', inventoryController.getMovements.bind(inventoryController));
router.get('/stats', inventoryController.getStats.bind(inventoryController));
router.post('/movement', inventoryController.recordMovement.bind(inventoryController));
router.put('/movement/:id', inventoryController.updateMovement.bind(inventoryController));
router.delete('/movement/:id', inventoryController.deleteMovement.bind(inventoryController));

module.exports = router;
