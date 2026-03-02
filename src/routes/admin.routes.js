import express from 'express';
import db from '../db/db.js'; 

const router = express.Router();

// --- CONTROLLER IMPORTS ---
import { 
    getProjectOverview, 
    getUserAttendanceLogs,
    getAttendance,
    createTask,
    getMyProjects,
    getUserFullProfile,
    getMasterAnalytics,
    getAdminAttendanceSummary,
    endAttendanceSession,
    getAllStaff, 
    getUserDetails, 
    updateUserStatus,
    createProject,
    updateProjectStatus,
    assignMember,
    removeMember,
    getProjectTeam,
    punchInBreak,
    punchOutBreak,
    getPendingLeaves, 
    handleLeaveAction,
    deleteUserAccount
} from '../controllers/admin.controller.js';

import { 
    getAdminProfileTabs, 
    updateAdminStatus 
} from '../controllers/adminProfile.controller.js';

// --- MIDDLEWARE IMPORTS ---
import { verifyToken, isAdmin } from '../middlewares/auth.middleware.js';
import { getPendingStatusRequests, handleStatusRequestAction } from '../controllers/admin.controller.js';
import { sendAlert } from '../controllers/admin.controller.js';
import { getPendingTaskReassigns, handleTaskReassignAction } from '../controllers/admin.controller.js';// Add these to your existing admin routes:
import upload from '../middlewares/upload.js';


router.get('/status-requests/pending', verifyToken, getPendingStatusRequests);
router.post('/status-requests/action', verifyToken, handleStatusRequestAction)


// --- ROUTES ---

// Dashboard & Analytics
router.get('/master-analytics', verifyToken, isAdmin, getMasterAnalytics);
router.get('/attendance-summary', verifyToken, isAdmin, getAdminAttendanceSummary);

// User Management
router.get('/all-staff', verifyToken, isAdmin, getAllStaff);
router.get('/user-details/:userId', verifyToken, isAdmin, getUserDetails);
router.get('/user-full-profile/:id', verifyToken, isAdmin, getUserFullProfile);
router.put('/user-status/:userId', verifyToken, isAdmin, updateUserStatus);

// Attendance & Breaks
router.get('/attendance', verifyToken, isAdmin, getAttendance);
router.get('/user-logs/:userId', verifyToken, isAdmin, getUserAttendanceLogs);
router.post('/attendance/end', verifyToken, endAttendanceSession);

/** * NOTE: Removed 'isAdmin' from breaks to allow normal users to punch in, 
 * which likely caused your earlier 403 error.
 */
router.post('/breaks/punch-in', verifyToken, punchInBreak);
router.post('/breaks/punch-out', verifyToken, punchOutBreak);

// Projects Management
router.get('/project-overview', verifyToken, isAdmin, getProjectOverview);
router.get('/my-projects', verifyToken, isAdmin, getMyProjects);
router.post('/projects/create', verifyToken, upload.single('file'), createProject);
router.post('/projects/update-status', verifyToken, isAdmin, updateProjectStatus);

// Integrated Team Management (Add/Remove members)
router.post('/projects/assign', verifyToken, isAdmin, assignMember);
router.post('/projects/remove-member', verifyToken, isAdmin, removeMember);
router.get('/projects/:id/team', verifyToken, isAdmin, getProjectTeam);

// Tasks
router.post('/create-task', verifyToken, isAdmin, createTask);

// Leaves
router.get('/leaves/pending', verifyToken, isAdmin, getPendingLeaves);
router.post('/leaves/action', verifyToken, isAdmin, handleLeaveAction);

// Admin Profile
router.get('/profile-tabs', verifyToken, isAdmin, getAdminProfileTabs);
router.put('/profile-status', verifyToken, isAdmin, updateAdminStatus);

// router.delete('/users/:id', protectAdmin, deleteUserAccount);
router.delete('/users/:id', verifyToken, deleteUserAccount); // Use whatever name your other routes use

router.get('/status-requests/pending', verifyToken, getPendingStatusRequests);
router.post('/status-requests/action', verifyToken, handleStatusRequestAction);
// Send Alert Route
router.post('/send-alert', verifyToken, isAdmin, sendAlert);
router.get('/task-reassign/pending', verifyToken, isAdmin, getPendingTaskReassigns);
router.post('/task-reassign/action', verifyToken, isAdmin, handleTaskReassignAction);

export default router;
