import express from 'express';
import { updateProfile, changePassword, getProfile } from '../controllers/user.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';
import { markNotificationRead, getUserNotifications } from '../controllers/notification.controller.js';
import { getUserProfile } from '../controllers/user.controller.js';
const router = express.Router();

router.put('/update-profile', verifyToken, updateProfile);
router.put('/change-password', verifyToken, changePassword);
router.put('/profile', verifyToken, updateProfile);
router.put('/notifications/:id/read', verifyToken, markNotificationRead);
router.get('/notifications', verifyToken, getUserNotifications);
router.get('/profile', verifyToken, getUserProfile);
export default router;
