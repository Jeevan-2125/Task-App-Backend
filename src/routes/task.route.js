import express from 'express';
import { updateTaskStatus } from '../controllers/task.controller.js'; // Ensure this matches your controller export
import { verifyToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.post('/update-status', verifyToken, updateTaskStatus);

export default router;