const express = require('express');
const router = express.Router();
const clientsController = require('../controllers/clients.controller');
const { authenticateToken } = require('../utils/auth');

/**
 * Clients Routes
 * All routes are protected
 */

// router.use(authenticateToken);

router.get('/', clientsController.getAllClients.bind(clientsController));
router.get('/:id', clientsController.getClientById.bind(clientsController));
router.post('/', clientsController.createClient.bind(clientsController));
router.put('/:id', clientsController.updateClient.bind(clientsController));
router.delete('/:id', clientsController.deleteClient.bind(clientsController));

module.exports = router;
