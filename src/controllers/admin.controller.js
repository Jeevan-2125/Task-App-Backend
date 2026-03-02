import db from '../db/db.js';

export const getAdminDashboard = async (req, res) => {
    try {
        const [stats] = await db.query(`
            SELECT 
                (SELECT COUNT(*) FROM users WHERE role='user') as total_users,
                (SELECT COUNT(DISTINCT user_id) FROM attendance WHERE DATE(login_time) = CURDATE()) as present_today,
                (SELECT COUNT(*) FROM user_leaves 
                 WHERE status='approved' AND leave_date = CURDATE()) as on_leave,
                (SELECT COUNT(*) FROM user_leaves WHERE status='pending') as pending_leaves,
                (SELECT COUNT(*) FROM tasks WHERE status='completed') as tasks_done
        `);
        // ... rest of your code ...
        res.json({ success: true, stats: stats[0] });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
export const getAdminAttendanceSummary = async (req, res) => {
    try {
        const { month, year } = req.query;
        const adminId = req.user.id;

        // 1. Fetch current active session for the admin
        const [currentSession] = await db.query(
            `SELECT login_time FROM attendance 
             WHERE user_id = ? AND logout_time IS NULL 
             ORDER BY login_time DESC LIMIT 1`, [adminId]
        );

        // 2. Fetch pending leaves
        const [leaveCount] = await db.query(
            "SELECT COUNT(*) as count FROM user_leaves WHERE status = 'pending'"
        );

        // 3. Fetch Monthly Summary + Real-Time Presence Subqueries
        const [summary] = await db.query(`
            SELECT 
                u.id as user_id,
                u.name as user_name,
                u.email,
                u.last_activity,
                
                -- Real-time Presence checks (looks at TODAY's activity only)
                (SELECT login_time FROM attendance a2 WHERE a2.user_id = u.id AND DATE(a2.login_time) = CURDATE() AND a2.logout_time IS NULL ORDER BY a2.login_time DESC LIMIT 1) as current_session,
                (SELECT logout_time FROM attendance a3 WHERE a3.user_id = u.id AND a3.logout_time IS NOT NULL AND DATE(a3.logout_time) = CURDATE() ORDER BY a3.logout_time DESC LIMIT 1) as last_logout,
                
                -- Global Last Login (Overall)
                (SELECT login_time FROM attendance a4 WHERE a4.user_id = u.id ORDER BY a4.login_time DESC LIMIT 1) as last_login,
                
                -- Monthly Aggregates (filtered by selected month/year)
                COUNT(a.id) as present_days,
                SUM(CASE WHEN TIME(a.login_time) > '10:30:00' THEN 1 ELSE 0 END) as late_days,
                SUM(CASE WHEN a.work_hours >= 8 THEN 1 ELSE 0 END) as full_days,
                SUM(CASE WHEN a.work_hours < 8 AND a.work_hours > 0 THEN 1 ELSE 0 END) as half_days
            FROM users u
            LEFT JOIN attendance a ON u.id = a.user_id 
                AND MONTH(a.login_time) = ? AND YEAR(a.login_time) = ?
            WHERE u.role != 'admin' OR u.id = ?
            GROUP BY u.id
        `, [month, year, adminId]);

        // 4. Process presence logic and absent days in Node
        const currentTime = new Date();
        const processedSummary = summary.map(user => {
            let presenceStatus = 'offline';
            
            // Check real-time presence
            if (user.current_session) {
                presenceStatus = 'online';
            } else if (user.last_logout) {
                const logoutTime = new Date(user.last_logout);
                const diffSeconds = (currentTime - logoutTime) / 1000;
                if (diffSeconds <= 300) presenceStatus = 'recent';
            } else if (user.last_activity) {
                 const activityTime = new Date(user.last_activity);
                 const diffSeconds = (currentTime - activityTime) / 1000;
                 if (diffSeconds <= 60) presenceStatus = 'online';
                 else if (diffSeconds <= 300) presenceStatus = 'recent';
            }

            // Calculate Absent Days (Defaulting to a 22 working day month)
            const workingDays = 22; 
            let absent_days = workingDays - (user.present_days || 0);
            if (absent_days < 0) absent_days = 0;

            return {
                user_id: user.user_id,
                user_name: user.user_name,
                email: user.email,
                current_status: presenceStatus, // Yields 'online', 'recent', or 'offline'
                last_login: user.last_login,
                present_days: user.present_days || 0,
                full_days: user.full_days || 0,
                half_days: user.half_days || 0,
                late_days: user.late_days || 0,
                absent_days: absent_days
            };
        });

        // 5. Send unified response mapped perfectly for attendance.tsx
        return res.json({
            success: true,
            currentSession: currentSession[0] || null,
            pendingLeavesCount: leaveCount[0]?.count || 0,
            summary: processedSummary
        });

    } catch (err) {
        console.error("Attendance Summary Error: - admin.controller.js:109", err.message);
        if (!res.headersSent) {
            return res.status(500).json({ success: false, message: "Internal Server Error" });
        }
    }
};


// ✅ Ensur
// e this is also exported
export const getAllUsers = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT id, name, email, role, status FROM users');
        res.json({ success: true, users: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};


export const sendAnnouncement = async (req, res) => {
    try {
        const { message } = req.body;
        // Insert notification for all users with role 'user'
        await db.query(`
            INSERT INTO notifications (user_id, title, message, type, created_at)
            SELECT id, 'Admin Announcement', ?, 'global', NOW() FROM users WHERE role = 'user'
        `, [message]);
        
        res.json({ success: true, message: 'Announcement broadcasted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};


export const updateLeaveStatus = async (req, res) => {
    const { id, status } = req.body;
    
    console.log(`[Leave] Admin is updating leave ID: ${id} to Status: ${status} - admin.controller.js:148`);

    try {
        // 1. Safely fetch the leave request using SELECT * so we don't guess column names!
        const [leaveRequest] = await db.query('SELECT * FROM user_leaves WHERE id = ?', [id]);

        if (leaveRequest.length === 0) {
            console.log("[Leave] Error: Leave request not found in database. - admin.controller.js:155");
            return res.status(404).json({ success: false, message: "Leave request not found" });
        }

        const userId = leaveRequest[0].user_id;
        // Check multiple common column names just in case
        const leaveType = leaveRequest[0].leave_type || leaveRequest[0].type || leaveRequest[0].reason || 'Leave';
        
        console.log(`[Leave] Found User ID: ${userId}, Type: ${leaveType} - admin.controller.js:163`);

        // 2. Update the leave status
        await db.query('UPDATE user_leaves SET status = ? WHERE id = ?', [status, id]);
        console.log("[Leave] Status updated successfully in user_leaves table. - admin.controller.js:167");

        // 3. Format the text for the notification
        const formattedStatus = status.charAt(0).toUpperCase() + status.slice(1);
        const notifTitle = `Leave ${formattedStatus}`;
        const notifMessage = `Your request for ${leaveType} has been ${status.toLowerCase()} by the Admin.`;

        // 4. Insert the notification safely
        await db.query(`
            INSERT INTO notifications (user_id, type, title, message, is_read, related_id, created_at) 
            VALUES (?, 'leave_update', ?, ?, 0, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 330 MINUTE))
        `, [userId, notifTitle, notifMessage, id]);
        
        console.log("[Leave] Notification successfully inserted into database! - admin.controller.js:180");

        res.json({ success: true, message: `Leave ${status}` });
    } catch (err) {
        // 🚨 THIS WILL TELL US EXACTLY WHAT WENT WRONG
        console.error("🚨 LEAVE UPDATE CRASH 🚨: - admin.controller.js:185", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};
export const getAttendance = async (req, res) => {
    try {
        const { month } = req.query; // e.g., '2026-02'
        const targetMonth = month || new Date().toISOString().slice(0, 7);

        const [rows] = await db.query(`
            SELECT 
                u.name, 
                u.email,
                COUNT(DISTINCT DATE(a.login_time)) as present_days,
                SUM(CASE WHEN TIMESTAMPDIFF(HOUR, a.login_time, a.logout_time) >= 8 THEN 1 ELSE 0 END) as full_days,
                SUM(CASE WHEN TIMESTAMPDIFF(HOUR, a.login_time, a.logout_time) < 8 
                         AND TIMESTAMPDIFF(HOUR, a.login_time, a.logout_time) >= 4 THEN 1 ELSE 0 END) as half_days,
                ROUND(AVG(TIMESTAMPDIFF(MINUTE, a.login_time, a.logout_time)) / 60, 2) as avg_hours
            FROM users u
            LEFT JOIN attendance a ON u.id = a.user_id AND DATE_FORMAT(a.login_time, '%Y-%m') = ?
            WHERE u.role = 'user'
            GROUP BY u.id
        `, [targetMonth]);

        res.json({ success: true, summary: rows });
    } catch (err) {
        console.error("Attendance Summary Error: - admin.controller.js:211", err);
        res.status(500).json({ success: false, message: 'Failed to fetch attendance summary' });
    }
};

// backend/src/controllers/admin.controller.js

export const getUserAttendanceLogs = async (req, res) => {
    try {
        const { userId } = req.params;
        const [logs] = await db.query(`
            SELECT login_time, logout_time, 
            TIMESTAMPDIFF(MINUTE, login_time, logout_time) as duration_mins
            FROM attendance 
            WHERE user_id = ? 
            ORDER BY login_time DESC
        `, [userId]);
        
        res.json({ success: true, logs });
    } catch (err) {
        console.error("User Logs Error: - admin.controller.js:231", err);
        res.status(500).json({ success: false, message: 'Failed to fetch logs' });
    }
};





export const createTask = async (req, res) => {
    try {
        const { title, description, assigned_to, due_date } = req.body;
        const created_by = req.user.id;

        // ✅ Since assigned_to is an array from your new .tsx file
        if (!Array.isArray(assigned_to) || assigned_to.length === 0) {
            return res.status(400).json({ success: false, message: "No users assigned" });
        }

        // We use Promise.all to run all inserts at once
        const insertPromises = assigned_to.map(async (userId) => {
            const [result] = await db.query(
                `INSERT INTO tasks 
                (title, description, assigned_to, created_by, due_date, status, priority, created_at) 
                VALUES (?, ?, ?, ?, ?, 'pending', 'medium', NOW())`,
                [title, description, userId, created_by, due_date]
            );
            
            // Create notification for each user
            await db.query(
                `INSERT INTO notifications (user_id, type, title, message, related_id, created_at) 
                VALUES (?, 'task_assigned', 'New Task Assigned', ?, ?, NOW())`,
                [userId, `New task: ${title}`, result.insertId]
            );
            return result;
        });

        await Promise.all(insertPromises);

        return res.json({ success: true, message: `Task assigned to ${assigned_to.length} users` });
        
    } catch (err) {
        console.error("Create Task Error: - admin.controller.js:273", err.message);
        res.status(500).json({ success: false, message: "Server Database Error" });
    }
};


export const getMasterAnalytics = async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];

        // 1. Daily Analytics & Attendance Breakdown
        const [presentToday] = await db.query(
            `SELECT u.id, u.name, u.email FROM users u 
             JOIN attendance a ON u.id = a.user_id 
             WHERE DATE(a.login_time) = ?`, [today]
        );

      // 1. Update this query to fetch the id, name, and leave details
        const [onLeaveToday] = await db.query(
            `SELECT 
                u.id, 
                u.name, 
                l.leave_type, 
                l.reason 
             FROM users u 
             JOIN user_leaves l ON u.id = l.user_id 
             WHERE ? BETWEEN l.start_date AND l.end_date 
             AND l.status = 'Approved'`, [today]
        );
        
        // 🌟 FIXED: Real-time Presence Logic for Active Personnel Grid 🌟
        const [allStaffRaw] = await db.query(`
            SELECT 
                u.id, u.name, u.email, u.last_activity,
                (SELECT login_time FROM attendance a WHERE a.user_id = u.id AND DATE(a.login_time) = CURDATE() AND a.logout_time IS NULL ORDER BY a.login_time DESC LIMIT 1) as current_session,
                (SELECT logout_time FROM attendance a WHERE a.user_id = u.id AND a.logout_time IS NOT NULL AND DATE(a.logout_time) = CURDATE() ORDER BY a.logout_time DESC LIMIT 1) as last_logout
            FROM users u 
            WHERE u.role != 'admin'
        `);

        const currentTime = new Date();
        
        const allStaff = allStaffRaw.map(user => {
            let presenceStatus = 'offline'; // Default to offline (#95a5a6)

            if (user.current_session) {
                presenceStatus = 'online'; // Currently logged in (#2ecc71)
            } else if (user.last_logout) {
                // Check if they logged out within the last 5 mins (300 seconds)
                const logoutTime = new Date(user.last_logout);
                const diffSeconds = (currentTime - logoutTime) / 1000;
                if (diffSeconds <= 300) {
                    presenceStatus = 'recent'; // (#3498db)
                }
            } else if (user.last_activity) {
                // Fallback check against last API activity
                 const activityTime = new Date(user.last_activity);
                 const diffSeconds = (currentTime - activityTime) / 1000;
                 if (diffSeconds <= 60) presenceStatus = 'online';
                 else if (diffSeconds <= 300) presenceStatus = 'recent';
            }

            return {
                id: user.id,
                name: user.name,
                email: user.email,
                status: presenceStatus // This overrides the old static status
            };
        });

        // 2. Task Overview (Pending & Completed)
        const [allTasks] = await db.query(`
            SELECT t.id, t.title, t.status, t.due_date, u.name as assigned_to 
            FROM tasks t 
            LEFT JOIN users u ON t.assigned_to = u.id 
            ORDER BY t.created_at DESC
        `);

        // 3. Stats Calculation
        const presentIds = presentToday.map(p => p.id);
        const absentUsers = allStaff.filter(s => !presentIds.includes(s.id));

        const stats = {
            present_today: presentToday.length,
            total_staff: allStaff.length,
            on_leave: onLeaveToday.length,
            tasks_completed: allTasks.filter(t => t.status === 'completed').length,
            tasks_created_today: allTasks.filter(t => t.status === 'pending').length, 
            total_tasks: allTasks.length,
            pending_count: allTasks.filter(t => t.status === 'pending').length,
            progress_count: allTasks.filter(t => t.status === 'in_progress').length,
        };

      return res.json({
            success: true,
            stats,
            breakdown: {
                present: presentToday,
                absent: absentUsers,
                on_leave: onLeaveToday // <--- ADD THIS LINE
            },
            tasks: allTasks, 
            users: allStaff 
        });

    } catch (err) {
        console.error("Dashboard Data Error at - admin.controller.js:379", err.message);
        if (!res.headersSent) {
            return res.status(500).json({ success: false, message: "Internal Server Error" });
        }
    }
};




// Add this to your admin.controller.js
export const getProjectOverview = async (req, res) => {
    try {
        // 1. Fetch Projects with Assignee Name from 'users' table
        const [projects] = await db.query(`
            SELECT 
                p.id, 
                p.name as title, 
                p.description, 
                p.status, 
                p.start_date,    /* ✅ ADDED: Fetches start date for the modal */
                p.end_date,      /* ✅ ADDED: Fetches due date for the modal */
                p.created_at,
                u.name as assignee_name,
                'medium' as priority 
            FROM projects p
            LEFT JOIN users u ON p.created_by = u.id
            ORDER BY p.created_at DESC
        `);

        // 2. Calculate Stats based on project status from your DB
        const stats = {
            total: projects.length,
            // ✅ ADDED 'pending' so newly created projects count as ongoing
            ongoing: projects.filter(p => p.status === 'active' || p.status === 'planning' || p.status === 'pending').length,
            finished: projects.filter(p => p.status === 'completed').length
        };

        res.json({
            success: true,
            tasks: projects, 
            stats
        });
    } catch (err) {
        console.error("Project Fetch Error: - admin.controller.js:423", err.message);
        res.status(500).json({ success: false, message: "Failed to load projects" });
    }
};






export const getUserFullProfile = async (req, res) => {
    try {
        const { id } = req.params;
        const [user] = await db.query('SELECT name, email, role, status, profile_photo FROM users WHERE id = ?', [id]);
        const [stats] = await db.query('SELECT COUNT(*) as total FROM tasks WHERE assigned_to = ?', [id]);
        
        res.json({
            success: true,
            profile: user[0],
            stats: stats[0]
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};




// 2. End Active Session Logic
export const endAttendanceSession = async (req, res) => {
    try {
        const userId = req.user.id;
        const now = new Date();
        
        // Find the specific active session from your Attendance table
        const [active] = await db.query(
            "SELECT id, login_time FROM Attendance WHERE user_id = ? AND logout_time IS NULL LIMIT 1", 
            [userId]
        );

        if (active.length === 0) {
            return res.status(400).json({ success: false, message: "No active session found" });
        }

        // Calculate final work hours for the database record
        const loginTime = new Date(active[0].login_time);
        const hours = (now.getTime() - loginTime.getTime()) / (1000 * 60 * 60);

        await db.query(
            "UPDATE Attendance SET logout_time = ?, work_hours = ? WHERE id = ?",
            [now, hours.toFixed(2), active[0].id]
        );

        res.json({ success: true, message: "Session ended successfully" });
    } catch (err) {
        console.error("End Session Error: - admin.controller.js:479", err.message);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};



// Get All Staff for users.tsx
export const getAllStaff = async (req, res) => {
    try {
        // 1. Fetch users along with their real-time attendance data
        const [rows] = await db.query(`
            SELECT 
                u.id, u.name, u.email, u.role, u.profile_photo, u.last_activity,
                (SELECT login_time FROM attendance a WHERE a.user_id = u.id AND DATE(a.login_time) = CURDATE() AND a.logout_time IS NULL ORDER BY a.login_time DESC LIMIT 1) as current_session,
                (SELECT logout_time FROM attendance a WHERE a.user_id = u.id AND a.logout_time IS NOT NULL AND DATE(a.logout_time) = CURDATE() ORDER BY a.logout_time DESC LIMIT 1) as last_logout
            FROM users u 
            WHERE u.role != 'admin'
        `);

        const currentTime = new Date();
        
        // 2. Map through the users and calculate their active/recent/offline status
        const staffWithPresence = rows.map(user => {
            let presenceStatus = 'offline'; // Default to offline

            if (user.current_session) {
                presenceStatus = 'online'; 
            } else if (user.last_logout) {
                const logoutTime = new Date(user.last_logout);
                const diffSeconds = (currentTime - logoutTime) / 1000;
                if (diffSeconds <= 300) {
                    presenceStatus = 'recent';
                }
            } else if (user.last_activity) {
                 const activityTime = new Date(user.last_activity);
                 const diffSeconds = (currentTime - activityTime) / 1000;
                 if (diffSeconds <= 60) presenceStatus = 'online';
                 else if (diffSeconds <= 300) presenceStatus = 'recent';
            }

            return {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                profile_photo: user.profile_photo,
                status: presenceStatus // This overrides the static database status
            };
        });

        res.json({ success: true, staff: staffWithPresence });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// Suspend/Update Status
export const updateUserStatus = async (req, res) => {
    try {
        const { userId } = req.params;
        const { status } = req.body; // e.g., 'suspended' or 'active'
        await db.query("UPDATE users SET status = ? WHERE id = ?", [status, userId]);
        res.json({ success: true, message: "User status updated" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};




export const getProjectDetails = async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Get Project Info
        const [project] = await db.query(`
            SELECT p.*, u.name as creator_name 
            FROM projects p 
            JOIN users u ON p.created_by = u.id 
            WHERE p.id = ?`, [id]);

        if (!project.length) return res.status(404).json({ success: false, message: "Project not found" });

        // 2. Get Project Members
        const [members] = await db.query(`
            SELECT u.name, u.role, DATE_FORMAT(pm.joined_date, '%Y-%m-%d') as joined_date 
            FROM project_members pm
            JOIN users u ON pm.user_id = u.id
            WHERE pm.project_id = ?`, [id]);

        res.json({ 
            success: true, 
            project: project[0], 
            members 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


// FETCH Pending Requests
export const getPendingLeaves = async (req, res) => {
    try {
        const query = `
            SELECT 
                l.id, l.user_id, l.leave_type, l.reason, 
                l.start_date, l.end_date, l.days_requested,
                u.name as user_name, u.email,
                u.sick_leave_bal, u.casual_leave_bal, u.earned_leave_bal
            FROM user_leaves l
            JOIN users u ON l.user_id = u.id
            WHERE l.status = 'pending'
            ORDER BY l.start_date ASC
        `;
        const [rows] = await db.query(query);
        res.json({ success: true, requests: rows });
    } catch (error) {
        console.error("Fetch Pending Leaves Error: - admin.controller.js:599", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// APPROVE or REJECT
export const handleLeaveAction = async (req, res) => {
    // ✅ FIXED: We are now extracting 'action' exactly as the frontend sends it!
    const { id, action } = req.body; 

    try {
        // 1. Fetch the user who requested the leave
        const [leaveReq] = await db.query('SELECT * FROM user_leaves WHERE id = ?', [id]);
        
        if (leaveReq.length === 0) {
            return res.status(404).json({ success: false, message: "Leave request not found" });
        }

        const userId = leaveReq[0].user_id;
        const leaveType = leaveReq[0].leave_type || 'Leave';

        // 2. Update the leave status in the database
        await db.query('UPDATE user_leaves SET status = ? WHERE id = ?', [action, id]);

        // 3. Generate the Notification Text
        const formattedStatus = action.charAt(0).toUpperCase() + action.slice(1);
        const notifTitle = `Leave ${formattedStatus}`;
        const notifMessage = `Your request for ${leaveType} has been ${action} by the Admin.`;

        // 4. Insert the Notification
        await db.query(`
            INSERT INTO notifications (user_id, type, title, message, is_read, related_id, created_at) 
            VALUES (?, 'leave_update', ?, ?, 0, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 330 MINUTE))
        `, [userId, notifTitle, notifMessage, id]);

        res.json({ success: true, message: `Leave ${action} successfully.` });
    } catch (error) {
        console.error("Leave Action Error: - admin.controller.js:636", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getUserDetails = async (req, res) => {
    const { userId } = req.params;

    try {
        // Fetch full profile info including what the user edited
        const [user] = await db.query(
            `SELECT id, name, email, phone, address, role, status, profile_photo, created_at 
             FROM users WHERE id = ?`, [userId]
        );

        if (user.length === 0) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Fetch task stats for the StatBoxes in user-details.tsx
        const [stats] = await db.query(
            `SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
             FROM tasks WHERE assigned_to = ?`, [userId]
        );

        return res.json({
            success: true,
            user: user[0],
            stats: stats[0]
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};


// ✅ Make sure this replaces the project creation function in ADMIN.CONTROLLER.JS
export const createProject = async (req, res) => {
    const { name, description, status, startDate, endDate, members } = req.body;
    const adminId = req.user.id; 

    let parsedMembers = [];
    if (members) {
        try { parsedMembers = JSON.parse(members); } catch (e) { parsedMembers = []; }
    }

    try {
        // 1. Insert into main projects table (removed 'file' column to match your DB)
        const [project] = await db.query(
            'INSERT INTO projects (name, description, status, start_date, end_date, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())',
            [name, description, status || 'active', startDate, endDate, adminId]
        );

        const projectId = project.insertId;

        // 2. ✅ Save the uploaded file into the separate `project_files` table!
        if (req.file) {
            await db.query(
                `INSERT INTO project_files (project_id, user_id, file_name, file_path, file_type, file_size, uploaded_at) 
                 VALUES (?, ?, ?, ?, ?, ?, NOW())`,
                [
                    projectId, 
                    adminId, 
                    req.file.originalname, // Original name (e.g., Document.pdf)
                    req.file.filename,     // Saved unique name (e.g., 177...pdf)
                    req.file.mimetype,     // e.g., application/pdf
                    req.file.size          // File size in bytes
                ]
            );
        }

        // 3. Insert team members
        if (parsedMembers && parsedMembers.length > 0) {
            const memberData = parsedMembers.map(userId => [
                projectId, userId, 'member', adminId, new Date()
            ]);
            await db.query('INSERT INTO project_members (project_id, user_id, role, added_by, joined_date) VALUES ?', [memberData]);
        }

        res.json({ success: true, message: 'Project created successfully!', projectId: projectId });
    } catch (err) {
        console.error("Create Project Error: - admin.controller.js:720", err);
        res.status(500).json({ success: false, message: 'Failed to create project: ' + err.message });
    }
};


export const updateProjectStatus = async (req, res) => {
    try {
        const { projectId, status } = req.body;

        // 1. Update the status in the projects table
        const [result] = await db.query(
            "UPDATE projects SET status = ?, updated_at = NOW() WHERE id = ?",
            [status, projectId]
        );

        if (result.affectedRows > 0) {
            // 2. Optional: Log this activity in project_activities
            await db.query(
                "INSERT INTO project_activities (project_id, user_id, activity_type, description, created_at) VALUES (?, ?, 'status_change', ?, NOW())",
                [projectId, req.user.id, `Project status changed to ${status}`]
            );

            return res.json({ success: true, message: "Status updated successfully" });
        }

        res.status(400).json({ success: false, message: "Project not found or no change made" });
    } catch (error) {
        console.error("Update Status Error: - admin.controller.js:748", error);
        res.status(500).json({ success: false, message: "Database error" });
    }
};


export const getMyProjects = async (req, res) => {
    try {
        const userId = req.user.id; 

        const query = `
            SELECT 
                p.id, 
                p.name, 
                p.description, 
                p.status, 
                p.start_date, 
                p.end_date,
                u.name AS creator_name,
                -- 1. Counts unique team members
                (SELECT COUNT(DISTINCT user_id) FROM project_members WHERE project_id = p.id) AS team_count,
                -- 2. Counts total tasks
                (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) AS total_tasks,
                -- 3. Counts completed tasks
                (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'completed') AS completed_tasks,
                -- 4. Days remaining calculation
                DATEDIFF(p.end_date, CURDATE()) AS days_remaining
            FROM projects p
            JOIN users u ON p.created_by = u.id
            LEFT JOIN project_members pm ON p.id = pm.project_id
            WHERE p.created_by = ? OR pm.user_id = ?
            GROUP BY p.id
            ORDER BY p.created_at DESC
        `;

        // Pass userId twice to fill both '?' placeholders
        const [projects] = await db.query(query, [userId, userId]);

        res.json({ 
            success: true, 
            projects 
        });

    } catch (err) {
        console.error("Fetch MyProjects Error: - admin.controller.js:792", err.message);
        res.status(500).json({ 
            success: false, 
            message: "Server Database Error" 
        });
    }
};

// 1. ADD / ASSIGN MEMBER
export const assignMember = async (req, res) => {
    try {
        const { projectId, userId } = req.body;
        const adminId = req.user.id; // From your auth middleware

        // Check if member already exists to prevent duplicates
        const [existing] = await db.query(
            "SELECT * FROM project_members WHERE project_id = ? AND user_id = ?",
            [projectId, userId]
        );

        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: "User already in team" });
        }

        // Insert into project_members
        // We use current date for joined_date and the admin ID for added_by
        await db.query(
            "INSERT INTO project_members (project_id, user_id, role, added_by, joined_date) VALUES (?, ?, 'member', ?, NOW())",
            [projectId, userId, adminId]
        );

        res.json({ success: true, message: "Member added successfully" });
    } catch (err) {
        console.error("Assign Error: - admin.controller.js:825", err);
        res.status(500).json({ success: false, message: "Database Error" });
    }
};

// 2. REMOVE MEMBER
export const removeMember = async (req, res) => {
    try {
        const { projectId, userId } = req.body;

        // Delete the mapping record
        await db.query(
            "DELETE FROM project_members WHERE project_id = ? AND user_id = ?",
            [projectId, userId]
        );

        res.json({ success: true, message: "Member removed from project" });
    } catch (err) {
        console.error("Remove Error: - admin.controller.js:843", err);
        res.status(500).json({ success: false, message: "Database Error" });
    }
};

// 3. GET PROJECT TEAM (Helper for your "View Team" button)
export const getProjectTeam = async (req, res) => {
    try {
        const projectId = req.params.id; // Get ID from URL /api/projects/:id/team

        const query = `
            SELECT 
                u.id, 
                u.name, 
                u.email,
                pm.role /* ✅ ADDED: Required for frontend to display role and filter users */
            FROM users u
            INNER JOIN project_members pm ON u.id = pm.user_id
            WHERE pm.project_id = ?
        `;

        const [team] = await db.query(query, [projectId]);

        res.json({ 
            success: true, 
            team: team 
        });
    } catch (err) {
        console.error("Get Team Error: - admin.controller.js:871", err);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};


export const punchInBreak = async (req, res) => {
    const { userId, breakType } = req.body;
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const time = now.toTimeString().split(' ')[0];

    try {
        // Check if an active break of this type already exists for today
        const [existing] = await db.query(
            "SELECT id FROM breaks WHERE user_id = ? AND break_type = ? AND break_date = ? AND end_time IS NULL",
            [userId, breakType, date]
        );

        if (existing.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: `You already have an active ${breakType} break.`,
                id: existing[0].id // Send back the existing ID so the timer can resume
            });
        }

        const [result] = await db.query(
            "INSERT INTO breaks (user_id, break_type, break_date, break_time) VALUES (?, ?, ?, ?)",
            [userId, breakType, date, time]
        );
        return res.json({ success: true, id: result.insertId });
    } catch (error) {
        // If it's still a duplicate error but not caught by our check above
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: "Break already recorded for today." });
        }
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const punchOutBreak = async (req, res) => {
    const { breakId } = req.body;
    const now = new Date();
    const endTime = now.toTimeString().split(' ')[0]; 

    try {
        await db.query(
            "UPDATE breaks SET end_time = ? WHERE id = ?",
            [endTime, breakId]
        );
        return res.json({ success: true, message: "Punch-out recorded" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteUserAccount = async (req, res) => {
    try {
        const { id } = req.params;
        await db.query("DELETE FROM users WHERE id = ?", [id]);
        res.json({ success: true, message: "User deleted" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/// FETCH Pending Special Status Requests (WFH / OOO)
export const getPendingStatusRequests = async (req, res) => {
    try {
        const [requests] = await db.query(`
            SELECT us.*, u.name as user_name, u.email 
            FROM user_status us
            JOIN users u ON us.user_id = u.id
            WHERE us.status = 'pending' 
            AND us.status_type IN ('work_from_home', 'out_of_office', 'sick_leave')
            ORDER BY us.created_at DESC
        `);
        
        res.json({ success: true, requests });
    } catch (err) {
        console.error("Fetch Status Requests Error: - admin.controller.js:952", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// APPROVE or REJECT Special Status Requests
export const handleStatusRequestAction = async (req, res) => {
    try {
        const { id, status } = req.body; // 'approved' or 'rejected'
        const adminId = req.user.id; // Gets the ID of the admin making the decision
        
        await db.query(
            `UPDATE user_status 
             SET status = ?, approved_by = ?, approved_at = NOW() 
             WHERE id = ?`, 
            [status, adminId, id]
        );
        
        res.json({ success: true, message: `Request successfully ${status}` });
    } catch (err) {
        console.error("Update Status Request Error: - admin.controller.js:972", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// --- SEND CUSTOM ALERT / NOTIFICATION ---
export const sendAlert = async (req, res) => {
    try {
        const { message, users } = req.body;

        if (!message || !users || users.length === 0) {
            return res.status(400).json({ success: false, message: "Message and users are required." });
        }

        if (users.includes('all')) {
            // Insert notification for ALL staff (ignoring admins)
            await db.query(`
                INSERT INTO notifications (user_id, title, message, type, created_at)
                SELECT id, 'Admin Alert', ?, 'admin_alert', NOW() 
                FROM users WHERE role != 'admin'
            `, [message]);
        } else {
            // Insert notification ONLY for the selected users
            const notificationData = users.map(userId => [
                userId, 
                'Admin Alert', 
                message, 
                'admin_alert', 
                new Date()
            ]);

            await db.query(
                "INSERT INTO notifications (user_id, title, message, type, created_at) VALUES ?",
                [notificationData]
            );
        }

        res.json({ success: true, message: "Alert dispatched successfully." });
    } catch (err) {
        console.error("Send Alert Error: - admin.controller.js:1011", err.message);
        res.status(500).json({ success: false, message: "Database Error: " + err.message });
    }
};

// FETCH PENDING TASK REASSIGNMENTS (For Admin Notification Bell)
export const getPendingTaskReassigns = async (req, res) => {
    try {
        const [requests] = await db.query(`
            SELECT id, task_id, task_name, requester_name, new_assignees_json, reason 
            FROM reassignment_requests 
            WHERE status = 'pending'
        `);

        for (let req of requests) {
            req.task_title = req.task_name;
            req.from_user = req.requester_name;
            
            let toUserId = null;
            try {
                const parsed = JSON.parse(req.new_assignees_json);
                if (parsed && parsed.length > 0) {
                    // ✅ FIX: If the DB accidentally stored an object like {id: 1, name: "Chandru"}, 
                    // extract just the ID. If it's already a number, use it directly.
                    toUserId = typeof parsed[0] === 'object' ? parsed[0].id : parsed[0];
                }
            } catch(e) {
                console.error("Failed to parse JSON for request ID: - admin.controller.js:1038", req.id);
            }

            req.requested_to = toUserId;

            if (toUserId) {
                const [user] = await db.query("SELECT name FROM users WHERE id = ?", [toUserId]);
                req.to_user = user.length > 0 ? user[0].name : 'Unknown';
            } else {
                req.to_user = 'Unknown';
            }
        }

        res.json({ success: true, requests });
    } catch (error) {
        console.error("Fetch Pending Reassigns Error: - admin.controller.js:1053", error.message);
        res.status(500).json({ success: false, message: "Database Error" });
    }
};



// ADMIN ACTION: APPROVE OR REJECT
export const handleTaskReassignAction = async (req, res) => {
    // We will use task_id instead of id to prevent updating all '0' IDs at once
    const { action, task_id, requested_to } = req.body; 
    
    try {
        if (action === 'approved') {
            // Wrap the new user ID in an array as a JSON string
            const newAssigneesJson = JSON.stringify([String(requested_to)]);

            // Update task assignee (REMOVED reassign_status)
            await db.query(
                "UPDATE tasks SET assigned_to = ? WHERE id = ?", 
                [newAssigneesJson, task_id]
            );
        }
        
        // Update your specific table record based on task_id to avoid the '0' id bug
        await db.query(
            "UPDATE reassignment_requests SET status = ?, approved_at = NOW() WHERE task_id = ? AND status = 'pending'", 
            [action, task_id]
        );
        
        res.json({ success: true, message: `Task Reassignment ${action} successfully.` });
    } catch (error) {
        console.error("Reassign Action Error: - admin.controller.js:1085", error.message);
        res.status(500).json({ success: false, message: "Database Error" });
    }
};
