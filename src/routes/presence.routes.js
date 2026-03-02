import express from 'express';
import { toggleBreak, requestSpecialStatus } from '../controllers/presence.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.post('/break', verifyToken, toggleBreak);
router.post('/request-status', verifyToken, requestSpecialStatus);

export default router;
