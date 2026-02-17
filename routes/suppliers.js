const express = require('express');
const router = express.Router();
const suppliersController = require('../controllers/suppliers.controller');
const { authenticateToken } = require('../utils/auth');

/**
 * Suppliers Routes
 * All routes are protected
 */

router.use(authenticateToken);

router.get('/', suppliersController.getAllSuppliers.bind(suppliersController));
router.get('/:id', suppliersController.getSupplierById.bind(suppliersController));
router.post('/', suppliersController.createSupplier.bind(suppliersController));
router.put('/:id', suppliersController.updateSupplier.bind(suppliersController));
router.delete('/:id', suppliersController.deleteSupplier.bind(suppliersController));

module.exports = router;
