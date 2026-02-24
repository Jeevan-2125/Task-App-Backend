import express from 'express';
import { 
    getAttendanceHistory, 
    handleSession, 
    getAdminAttendanceDashboard,
    checkCurrentSession, 
    toggleHoliday,  
    getHolidays     
} from '../controllers/attendance.controller.js';

import { verifyToken, isAdmin } from '../middlewares/auth.middleware.js';

const router = express.Router();


router.get('/history', verifyToken, getAttendanceHistory);
router.post('/session', verifyToken, handleSession);
router.get('/current-session', verifyToken, checkCurrentSession);
router.get('/admin-summary', verifyToken, isAdmin, getAdminAttendanceDashboard);
router.get('/admin/holidays', verifyToken, isAdmin, getHolidays);
router.post('/holidays/toggle', verifyToken, toggleHoliday);
router.get('/holidays', verifyToken, getHolidays);

export default router;