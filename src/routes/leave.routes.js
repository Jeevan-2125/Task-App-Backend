import express from 'express';
import { applyLeave, getLeaveBalance } from '../controllers/leave.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

// ✅ This must be EXACTLY '/balance'
router.get('/balance', verifyToken, getLeaveBalance); 
router.post('/apply', verifyToken, applyLeave);

export default router;