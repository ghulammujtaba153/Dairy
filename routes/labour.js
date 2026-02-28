/**
 * Labour Routes
 */

const express = require('express');
const router = express.Router();
const labourController = require('../controllers/labour.controller');

// Collections/Global
router.get('/', labourController.getAllLabour);
router.get('/stats', labourController.getLabourStats);
router.get('/transactions', labourController.getRecentTransactions);

// Actions
router.post('/', labourController.createLabour);
router.post('/attendance', labourController.markAttendance);
router.delete('/attendance/:id', labourController.deleteAttendance);
router.post('/advance', labourController.recordAdvance);

// Individual Resource (Must be at the bottom)
router.get('/:id', labourController.getLabourById);
router.get('/:id/history', labourController.getLabourHistory);

module.exports = router;
