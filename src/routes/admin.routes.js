// import express from 'express';
// import db from '../db/db.js'; 


// const router = express.Router();

// import { 
//     getAdminDashboard, 
//     getAllUsers, 
//     getAttendance,
//     getProjectOverview, 
//     getUserAttendanceLogs,
//     createTask,
//     getMyProjects,
//     getAdminAttendanceSummary,
//     endAttendanceSession,
//     getUserFullProfile,
//     getMasterAnalytics,
//     getAllStaff, 
//     getUserDetails, 
//     updateUserStatus,
//     createProject,
//     updateProjectStatus,
//     assignMember,
//     removeMember,
//     getProjectTeam


// } from '../controllers/admin.controller.js';
// import { verifyToken, isAdmin } from '../middlewares/auth.middleware.js';
// import * as adminController from '../controllers/admin.controller.js';
// import { getAdminProfile, updateAdminStatus, getAdminProfileTabs } from '../controllers/adminProfile.controller.js';
// import {getPendingLeaves, handleLeaveAction } from '../controllers/admin.controller.js';
// import { protectAdmin } from '../middleware/authMiddleware.js';





// router.get('/project-overview', verifyToken, isAdmin, getProjectOverview);
// router.get('/user-logs/:userId', verifyToken, isAdmin, getUserAttendanceLogs);
// router.get('/attendance', verifyToken, isAdmin, getAttendance);
// router.post('/create-task', verifyToken, isAdmin, createTask);
// router.get('/my-projects', verifyToken, isAdmin, getMyProjects);
// router.get('/profile-tabs', verifyToken, isAdmin, getAdminProfileTabs);
// router.put('/profile-status', verifyToken, isAdmin, updateAdminStatus);
// router.get('/profile-tabs', verifyToken, isAdmin, getAdminProfileTabs);
// router.get('/user-details/:id', verifyToken, isAdmin, async (req, res) => {
//     const [user] = await db.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
//     res.json({ success: true, user: user[0] });});
// router.get('/user-full-profile/:id', verifyToken, isAdmin, getUserFullProfile);
// router.get('/master-analytics', verifyToken, isAdmin, getMasterAnalytics);
// router.get('/attendance-summary', verifyToken, isAdmin, getAdminAttendanceSummary);
// router.post('/attendance/end', verifyToken, endAttendanceSession);
// router.get('/all-staff', verifyToken, isAdmin, getAllStaff);
// router.get('/user-details/:userId', verifyToken, isAdmin, getUserDetails);
// router.put('/user-status/:userId', verifyToken, isAdmin, updateUserStatus);
// router.post('/projects/create', verifyToken, createProject);
// router.post('/breaks/punch-in', adminController.punchInBreak);
// router.post('/breaks/punch-out', adminController.punchOutBreak);
// router.post('/leaves/action', verifyToken, isAdmin, handleLeaveAction);
// router.get('/leaves/pending', verifyToken, isAdmin, getPendingLeaves);
// router.post('/projects/update-status', verifyToken, updateProjectStatus);
// router.post('/projects/assign', protectAdmin, assignMember);
// router.post('/projects/remove-member', protectAdmin, removeMember);
// router.get('/projects/:id/team', protectAdmin, getProjectTeam);


// export default router;







// import express from 'express';
// import db from '../db/db.js'; 

// const router = express.Router();

// // --- CONTROLLER IMPORTS ---
// import { 
//     getProjectOverview, 
//     getUserAttendanceLogs,
//     getAttendance,
//     createTask,
//     getMyProjects,
//     getUserFullProfile,
//     getMasterAnalytics,
//     getAdminAttendanceSummary,
//     endAttendanceSession,
//     getAllStaff, 
//     getUserDetails, 
//     updateUserStatus,
//     createProject,
//     updateProjectStatus,
//     assignMember,
//     removeMember,
//     getProjectTeam,
//     punchInBreak,
//     punchOutBreak,
//     getPendingLeaves, 
//     handleLeaveAction
    
// } from '../controllers/admin.controller.js';

// import { 
//     getAdminProfileTabs, 
//     updateAdminStatus 
// } from '../controllers/adminProfile.controller.js';

// // --- MIDDLEWARE IMPORTS ---
// // Check your folder names: "middlewares" vs "middleware"
// import { verifyToken, isAdmin } from '../middlewares/auth.middleware.js';

// // --- ROUTES ---

// // Dashboard & Analytics
// router.get('/master-analytics', verifyToken, isAdmin, getMasterAnalytics);
// router.get('/attendance-summary', verifyToken, isAdmin, getAdminAttendanceSummary);

// // User Management
// router.get('/all-staff', verifyToken, isAdmin, getAllStaff);
// router.get('/user-details/:userId', verifyToken, isAdmin, getUserDetails);
// router.get('/user-full-profile/:id', verifyToken, isAdmin, getUserFullProfile);
// router.put('/user-status/:userId', verifyToken, isAdmin, updateUserStatus);

// // Attendance & Breaks
// router.get('/attendance', verifyToken, isAdmin, getAttendance);
// router.get('/user-logs/:userId', verifyToken, isAdmin, getUserAttendanceLogs);
// router.post('/attendance/end', verifyToken, endAttendanceSession);
// router.post('/breaks/punch-in', verifyToken, isAdmin, punchInBreak);
// router.post('/breaks/punch-out', verifyToken, isAdmin, punchOutBreak);

// // Projects Management
// router.get('/project-overview', verifyToken, isAdmin, getProjectOverview);
// router.get('/my-projects', verifyToken, isAdmin, getMyProjects);
// router.post('/projects/create', verifyToken, isAdmin, createProject);
// router.post('/projects/update-status', verifyToken, isAdmin, updateProjectStatus);

// // Integrated Team Management (Add/Remove members)
// router.post('/projects/assign', verifyToken, isAdmin, assignMember);
// router.post('/projects/remove-member', verifyToken, isAdmin, removeMember);
// router.get('/projects/:id/team', verifyToken, isAdmin, getProjectTeam);

// // Tasks
// router.post('/create-task', verifyToken, isAdmin, createTask);

// // Leaves
// router.get('/leaves/pending', verifyToken, isAdmin, getPendingLeaves);
// router.post('/leaves/action', verifyToken, isAdmin, handleLeaveAction);

// // Admin Profile
// router.get('/profile-tabs', verifyToken, isAdmin, getAdminProfileTabs);
// router.put('/profile-status', verifyToken, isAdmin, updateAdminStatus);

// // router.post('/punch-in', verifyToken, punchInController);
// // router.post('/punch-in', verifyToken, isAdmin, punchInController);


// // Change line 157 and the one below it
// // router.post('/punch-in', verifyToken, punchInBreak);
// // router.post('/punch-out', verifyToken, punchOutBreak);


// // // Good (All logged in users)
// // router.post('/punch-in', verifyToken, punchInBreak);

// // // Restricted (Only Admins can hit this - triggers 403 for others)
// // router.post('/punch-in', verifyToken, isAdmin, punchInBreak);

// export default router;



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
    handleLeaveAction
} from '../controllers/admin.controller.js';

import { 
    getAdminProfileTabs, 
    updateAdminStatus 
} from '../controllers/adminProfile.controller.js';

// --- MIDDLEWARE IMPORTS ---
import { verifyToken, isAdmin } from '../middlewares/auth.middleware.js';

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
router.post('/projects/create', verifyToken, isAdmin, createProject);
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

export default router;