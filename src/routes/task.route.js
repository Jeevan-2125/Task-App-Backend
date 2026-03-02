import express from 'express';
import { updateTaskStatus } from '../controllers/task.controller.js'; // Ensure this matches your controller export
import { verifyToken } from '../middlewares/auth.middleware.js';
import { getTeamMembers, requestTaskReassignment } from '../controllers/reassignment.controller.js';

const router = express.Router();

router.post('/update-status', verifyToken, updateTaskStatus);
// Add this with your other task routes
router.get('/team-members', verifyToken, getTeamMembers);
// This receives the data from the frontend
router.post('/reassign-request', verifyToken, requestTaskReassignment);

export default router;
