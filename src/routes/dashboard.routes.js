import express from 'express';
// Combine imports into one line
import { getDashboardData, getEmployeeDashboard } from '../controllers/dashboard.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/data', verifyToken, getDashboardData);
router.get('/employee/dashboard', verifyToken, getEmployeeDashboard);

export default router;