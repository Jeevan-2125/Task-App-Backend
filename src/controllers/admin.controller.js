import db from '../db/db.js';

export const getAdminDashboard = async (req, res) => {
    try {
        const [stats] = await db.query(`
            SELECT 
                (SELECT COUNT(*) FROM users WHERE role='user') as total_users,
                (SELECT COUNT(DISTINCT user_id) FROM attendance WHERE DATE(login_time) = CURDATE()) as present_today,
                (SELECT COUNT(*) FROM user_leaves 
                 WHERE status='Approved' 
                 AND CURDATE() BETWEEN start_date AND end_date) as on_leave,
                (SELECT COUNT(*) FROM user_leaves WHERE status='pending') as pending_leaves,
                (SELECT COUNT(*) FROM tasks WHERE status='completed') as tasks_done
        `);

        const [activeUsers] = await db.query(`
            SELECT id, name, email, status FROM users WHERE role='user'
        `);

        // ✅ Use 'return' to ensure the function stops here
        return res.json({ 
            success: true, 
            stats: stats[0], 
            activeUsers 
        });
    } catch (err) {
        console.error("Dashboard Error at - admin.controller.js:27", err.message);
        return res.status(500).json({ 
            success: false, 
            message: 'Dashboard data fetch failed: ' + err.message 
        });
    }
};

export const getAdminAttendanceSummary = async (req, res) => {
    try {
        const { month, year } = req.query;
        const adminId = req.user.id;

        // 1. Fetch current active session
        const [currentSession] = await db.query(
            `SELECT login_time FROM attendance 
             WHERE user_id = ? AND logout_time IS NULL 
             ORDER BY login_time DESC LIMIT 1`, [adminId]
        );

        // 2. ✅ FIXED: Changed 'leave_applications' to 'user_leaves' 
        // because 'leave_applications' does not exist in your DB.
        const [leaveCount] = await db.query(
            "SELECT COUNT(*) as count FROM user_leaves WHERE status = 'pending'"
        );

        // 3. Fetch Monthly Summary
        const [summary] = await db.query(`
            SELECT 
                u.name as user_name,
                u.email,
                u.status as current_status,
                u.last_login as last_logon,
                COUNT(a.id) as present_days,
                SUM(CASE WHEN a.work_hours >= 8 THEN 1 ELSE 0 END) as full_days,
                SUM(CASE WHEN a.work_hours < 8 AND a.work_hours > 0 THEN 1 ELSE 0 END) as half_days,
                IFNULL(SUM(a.work_hours), 0) as total_hours,
                IFNULL(ROUND(AVG(a.work_hours), 1), 0) as avg_per_day
            FROM users u
            LEFT JOIN attendance a ON u.id = a.user_id 
                AND MONTH(a.login_time) = ? AND YEAR(a.login_time) = ?
            WHERE u.role != 'admin' OR u.id = ?
            GROUP BY u.id
        `, [month, year, adminId]);

        // ✅ FIXED: Consolidated into ONE res.json response. 
        // Previously you had two res.json calls, which caused the "headers already sent" crash.
        return res.json({
            success: true,
            currentSession: currentSession[0] || null,
            pendingLeavesCount: leaveCount[0].count,
            summary: summary || []
        });

    } catch (err) {
        console.error("Attendance Summary Error: - admin.controller.js:82", err.message);
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
    try {
        await db.query('UPDATE user_leaves SET status = ? WHERE id = ?', [status, id]);
        res.json({ success: true, message: `Leave ${status}` });
    } catch (err) {
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
        console.error("Attendance Summary Error: - admin.controller.js:153", err);
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
        console.error("User Logs Error: - admin.controller.js:173", err);
        res.status(500).json({ success: false, message: 'Failed to fetch logs' });
    }
};



// export const createTask = async (req, res) => {
//     try {
//         const { title, description, assigned_to, due_date } = req.body;
//         const created_by = req.user.id; // From your auth middleware

//         // Map data to your tasks table columns
//         const [result] = await db.query(
//             `INSERT INTO tasks 
//             (title, description, assigned_to, created_by, due_date, status, priority, created_at) 
//             VALUES (?, ?, ?, ?, ?, 'pending', 'medium', NOW())`,
//             [title, description, assigned_to, created_by, due_date]
//         );

//         if (result.affectedRows > 0) {
//             // Optional: Create a notification for the user
//             await db.query(
//                 `INSERT INTO notifications (user_id, type, title, message, related_id, created_at) 
//                 VALUES (?, 'task_assigned', 'New Task Assigned', ?, ?, NOW())`,
//                 [assigned_to, `You have been assigned: ${title}`, result.insertId]
//             );

//             return res.json({ success: true, message: "Task created and user notified" });
//         }

//         res.status(400).json({ success: false, message: "Failed to create task" });
//     } catch (err) {
//         console.error("Create Task Error: - admin.controller.js:206", err.message);
//         res.status(500).json({ success: false, message: "Server Database Error" });
//     }
// };


// export const createTask = async (req, res) => {
//     try {
//         const { title, description, assigned_to, due_date } = req.body;
//         const created_by = req.user.id; 

//         // 1. Title, 2. Description, 3. Assigned_to, 4. Created_by, 5. Due_date, 6. Status, 7. Priority, 8. Created_at
//         const [result] = await db.query(
//             `INSERT INTO tasks 
//             (title, description, assigned_to, created_by, due_date, status, priority, created_at) 
//             VALUES (?, ?, ?, ?, ?, 'pending', 'medium', NOW())`,
//             // Count must match the number of '?' in the query
//             [title, description, assigned_to, created_by, due_date] 
//         );

//         /* ❌ WHY IT WAS FAILING:
//            Your SQL query has 8 columns listed.
//            You only have 5 '?' placeholders.
//            SQL needs 8 values if you list 8 columns.
//         */

//         // ✅ FIXED QUERY:
//         const [fixedResult] = await db.query(
//             `INSERT INTO tasks 
//             (title, description, assigned_to, created_by, due_date, status, priority, created_at) 
//             VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`, // Added placeholders for status and priority
//             [title, description, assigned_to, created_by, due_date, 'pending', 'medium']
//         );

//         if (fixedResult.affectedRows > 0) {
//             await db.query(
//                 `INSERT INTO notifications (user_id, type, title, message, related_id, created_at) 
//                 VALUES (?, 'task_assigned', 'New Task Assigned', ?, ?, NOW())`,
//                 [assigned_to, `You have been assigned: ${title}`, fixedResult.insertId]
//             );

//             return res.json({ success: true, message: "Task created and user notified" });
//         }

//         res.status(400).json({ success: false, message: "Failed to create task" });
//     } catch (err) {
//         console.error("Create Task Error: - admin.controller.js:252", err.message);
//         res.status(500).json({ success: false, message: "Server Database Error" });
//     }
// };

// export const createTask = async (req, res) => {
//     try {
//         const { title, description, assigned_to, due_date } = req.body;
//         const created_by = req.user.id; 

//         // Columns listed: 8
//         // Values (?) provided: 8
//         const query = `
//             INSERT INTO tasks 
//             (title, description, assigned_to, created_by, due_date, status, priority, created_at) 
//             VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
//         `;

//         const values = [
//             title,           // 1
//             description,     // 2
//             assigned_to,     // 3
//             created_by,      // 4
//             due_date || null,// 5
//             'pending',       // 6 (maps to status)
//             'medium',        // 7 (maps to priority)
//             // NOW() handles the 8th value (created_at) automatically
//         ];

//         const [result] = await db.query(query, values);

//         if (result.affectedRows > 0) {
//             return res.json({ success: true, message: "Task created successfully" });
//         }
//     } catch (err) {
//         console.error("Database Error: - admin.controller.js:287", err.message);
//         res.status(500).json({ success: false, message: "Server Database Error" });
//     }
// };



// --- Inside admin.controller.js ---

// export const createTask = async (req, res) => {
//     try {
//         const { title, description, assigned_to, due_date } = req.body;
//         const created_by = req.user.id; 

//         // 1. Column Names (Total 8 columns mentioned here)
//         const sql = `
//             INSERT INTO tasks 
//             (title, description, assigned_to, created_by, due_date, status, priority, created_at) 
//             VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
//         `;

//         // 2. Corresponding Values (Total 7 placeholders '?' + 1 SQL function 'NOW()')
//         const values = [
//             title,           // ? 1
//             description,     // ? 2
//             assigned_to,     // ? 3
//             created_by,      // ? 4
//             due_date || null,// ? 5
//             'pending',       // ? 6
//             'medium'         // ? 7
//         ];

//         // Execute the query
//         const [result] = await db.query(sql, values);

//         if (result.affectedRows > 0) {
//             return res.json({ success: true, message: "Task created successfully" });
//         }
        
//     } catch (err) {
//         // This is where your line 287 error log is coming from
//         console.error("Database Error: - admin.controller.js:328", err.message);
//         res.status(500).json({ success: false, message: "Server Database Error" });
//     }
// };



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
        console.error("Create Task Error: - admin.controller.js:368", err.message);
        res.status(500).json({ success: false, message: "Server Database Error" });
    }
};

// export const getMyProjects = async (req, res) => {
//     try {
//         const adminId = req.user.id; // From verifyToken middleware
//         const [projects] = await db.query(`
//             SELECT p.* FROM projects p
//             WHERE p.added_by = ? 
//             OR p.id IN (SELECT project_id FROM project_members WHERE user_id = ?)
//             ORDER BY p.created_at DESC
//         `, [adminId, adminId]);
        
//         res.json({ success: true, projects });
//     } catch (err) {
//         res.status(500).json({ success: false, message: err.message });
//     }
// };



export const getMasterAnalytics = async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];

        // 1. Daily Analytics & Attendance Breakdown
        // Fetch users present today (logged in)
        const [presentToday] = await db.query(
            `SELECT u.id, u.name, u.email FROM users u 
             JOIN attendance a ON u.id = a.user_id 
             WHERE DATE(a.login_time) = ?`, [today]
        );

        // ✅ FIXED: Updated to use start_date and end_date
        // We check if 'today' falls between the start and end of the leave
        const [onLeaveToday] = await db.query(
            `SELECT u.name FROM users u 
             JOIN user_leaves l ON u.id = l.user_id 
             WHERE ? BETWEEN l.start_date AND l.end_date 
             AND l.status = 'Approved'`, [today]
        );

        // Fetch all staff to calculate absents
        const [allStaff] = await db.query("SELECT id, name, email, status FROM users WHERE role != 'admin'");

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

        // ✅ Use return to prevent header errors
        return res.json({
            success: true,
            stats,
            breakdown: {
                present: presentToday,
                absent: absentUsers
            },
            tasks: allTasks, 
            users: allStaff 
        });

    } catch (err) {
        console.error("Dashboard Data Error at - admin.controller.js:451", err.message);
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
            ongoing: projects.filter(p => p.status === 'active' || p.status === 'planning').length,
            finished: projects.filter(p => p.status === 'completed').length
        };

        res.json({
            success: true,
            tasks: projects, 
            stats
        });
    } catch (err) {
        console.error("Project Fetch Error: - admin.controller.js:493", err.message);
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
        console.error("End Session Error: - admin.controller.js:549", err.message);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};



// Get All Staff for users.tsx
export const getAllStaff = async (req, res) => {
    try {
        const [rows] = await db.query(
            "SELECT id, name, email, role, status, profile_photo FROM users WHERE role != 'admin'"
        );
        res.json({ success: true, staff: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// Get Single User Details for user-details.tsx
// export const getUserDetails = async (req, res) => {
//     try {
//         const { userId } = req.params;

//         // 1. Basic User Info
//         const [user] = await db.query(
//             "SELECT id, name, email, role, status, profile_photo FROM users WHERE id = ?", 
//             [userId]
//         );

//         // 2. Task Stats
//         const [taskStats] = await db.query(
//             "SELECT COUNT(*) as total FROM tasks WHERE assigned_to = ?", 
//             [userId]
//         );

//         // 3. Project Stats (from project_members table)
//         const [projectStats] = await db.query(
//             "SELECT COUNT(*) as total FROM project_members WHERE user_id = ?", 
//             [userId]
//         );

//         // 4. Attendance Percentage (Last 30 days)
//         const [attendance] = await db.query(
//             "SELECT COUNT(*) as days FROM Attendance WHERE user_id = ? AND login_time >= NOW() - INTERVAL 30 DAY",
//             [userId]
//         );

//         res.json({
//             success: true,
//             user: user[0],
//             stats: {
//                 tasks: taskStats[0].total,
//                 projects: projectStats[0].total,
//                 attendance: Math.min(((attendance[0].days / 22) * 100).toFixed(0), 100) + '%'
//             }
//         });
//     } catch (err) {
//         res.status(500).json({ success: false, message: err.message });
//     }
// };

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



// export const createProject = async (req, res) => {
//     // We use a connection from the pool to handle the transaction
//     const connection = await db.getConnection();
    
//     try {
//         await connection.beginTransaction();

//         const { name, description, start_date, end_date, members } = req.body;
//         const adminId = req.user.id; // Get the ID of the admin creating the project

//         // 1. Insert into 'projects' table
//         const [projectResult] = await connection.query(
//             `INSERT INTO projects (name, description, status, start_date, end_date, created_by, created_at, updated_at) 
//              VALUES (?, ?, 'active', ?, ?, ?, NOW(), NOW())`,
//             [name, description, start_date || null, end_date || null, adminId]
//         );

//         const projectId = projectResult.insertId;

//         // 2. Insert members into 'project_members' table
//         if (members && members.length > 0) {
//             // Prepare the data for bulk insertion
//             const memberData = members.map(userId => [
//                 projectId,
//                 userId,
//                 'member',   // Default role
//                 adminId,    // added_by
//                 new Date()  // joined_date
//             ]);

//             await connection.query(
//                 "INSERT INTO project_members (project_id, user_id, role, added_by, joined_date) VALUES ?",
//                 [memberData]
//             );
//         }

//         // 3. Log the activity in 'project_activities'
//         await connection.query(
//             "INSERT INTO project_activities (project_id, user_id, activity_type, description, created_at) VALUES (?, ?, 'project_created', ?, NOW())",
//             [projectId, adminId, `Project '${name}' was created by Admin`]
//         );

//         await connection.commit();
//         res.status(201).json({ success: true, message: "Project created and members assigned successfully!", projectId });

//     } catch (error) {
//         await connection.rollback();
//         console.error("Project Creation Error: - admin.controller.js:672", error);
//         res.status(500).json({ success: false, message: "Failed to create project: " + error.message });
//     } finally {
//         connection.release();
//     }
// };

// export const createProject = async (req, res) => {
//     const connection = await db.getConnection();
//     try {
//         await connection.beginTransaction();
//         const { name, description, start_date, end_date, members } = req.body;
//         const adminId = req.user.id; 

//         // 1. Insert Project
//         const [projectResult] = await connection.query(
//             `INSERT INTO projects (name, description, status, start_date, end_date, created_by, created_at, updated_at) 
//              VALUES (?, ?, 'active', ?, ?, ?, NOW(), NOW())`,
//             [name, description, start_date || null, end_date || null, adminId]
//         );
//         const projectId = projectResult.insertId;

//         // 2. Prepare Member Data (Include the Admin + Selected Members)
//         // We use a Set to ensure the adminId isn't duplicated if they were also selected in the UI
//         const uniqueMembers = Array.from(new Set([...(members || []), adminId]));

//         const memberData = uniqueMembers.map(userId => [
//             projectId,
//             userId,
//             userId === adminId ? 'admin' : 'member', // Role logic
//             adminId,
//             new Date()
//         ]);

//         // 3. Insert into project_members
//         await connection.query(
//             "INSERT INTO project_members (project_id, user_id, role, added_by, joined_date) VALUES ?",
//             [memberData]
//         );

//         // 4. Log Activity
//         await connection.query(
//             "INSERT INTO project_activities (project_id, user_id, activity_type, description, created_at) VALUES (?, ?, 'project_created', ?, NOW())",
//             [projectId, adminId, `Project '${name}' created and initialized.`]
//         );

//         await connection.commit();
//         res.status(201).json({ success: true, projectId });
//     } catch (error) {
//         await connection.rollback();
//         res.status(500).json({ success: false, message: error.message });
//     } finally {
//         connection.release();
//     }
// };


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


// export const punchInController = async (req, res) => {
//     const { userId, breakType } = req.body;
//     const now = new Date();
//     const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
//     const time = now.toTimeString().split(' ')[0]; // HH:MM:SS

//     try {
//         const [result] = await db.query(
//             "INSERT INTO breaks (user_id, break_type, break_date, break_time) VALUES (?, ?, ?, ?)",
//             [userId, breakType, date, time]
//         );
//         res.json({ success: true, id: result.insertId });
//     } catch (error) {
//         res.status(500).json({ success: false, message: error.message });
//     }
// };


// // POST /api/admin/breaks/punch-out
// export const punchOutController = async (req, res) => {
//     const { breakId } = req.body;
//     const now = new Date();
//     const endTime = now.toTimeString().split(' ')[0]; // HH:MM:SS

//     try {
//         // ✅ Updates the existing record with the end time 
//         await db.query(
//             "UPDATE breaks SET end_time = ? WHERE id = ?",
//             [endTime, breakId]
//         );
//         res.json({ success: true, message: "Punch-out recorded" });
//     } catch (error) {
//         res.status(500).json({ success: false, message: error.message });
//     }
// };

// backend/src/controllers/admin.controller.js

export const getPendingLeaves = async (req, res) => {
    try {
        const query = `
            SELECT 
                ul.id, 
                ul.user_id, 
                ul.leave_type, 
                ul.reason, 
                ul.start_date, 
                ul.end_date, 
                ul.days_requested, 
                u.name as user_name, 
                u.email,
                CASE 
                    WHEN ul.leave_type = 'SICK LEAVE' THEN u.sick_leave_bal
                    WHEN ul.leave_type = 'CASUAL LEAVE' THEN u.casual_leave_bal
                    WHEN ul.leave_type = 'EARNED LEAVE' THEN u.earned_leave_bal
                    ELSE 0
                END as current_balance
            FROM user_leaves ul
            JOIN users u ON ul.user_id = u.id
            WHERE ul.status = 'pending'
            ORDER BY ul.created_at DESC
        `;

        const [rows] = await db.query(query);
        res.json({ success: true, requests: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


export const handleLeaveAction = async (req, res) => {
    const { id, action } = req.body; // id = leave application ID, action = 'Approved' or 'Rejected'

    try {
        // 1. Fetch the specific leave request details
        const [leaveRows] = await db.query(
            "SELECT user_id, leave_type, days_requested, start_date FROM user_leaves WHERE id = ?", 
            [id]
        );

        if (leaveRows.length === 0) {
            return res.status(404).json({ success: false, message: "Leave request not found." });
        }

        const { user_id, leave_type, days_requested, start_date } = leaveRows[0];

        // 2. If Approved, update the user's balance
       // Inside handleLeaveAction in admin.controller.js
  // Inside handleLeaveAction in admin.controller.js
if (action === 'Approved') {
    const [application] = await db.query("SELECT * FROM user_leaves WHERE id = ?", [id]);
    const { user_id, leave_type, days_requested } = application[0];

    const colMap = {
        'SICK LEAVE': 'sick_leave_bal',
        'CASUAL LEAVE': 'casual_leave_bal',
        'EARNED LEAVE': 'earned_leave_bal'
    };

    const col = colMap[leave_type.toUpperCase().trim()];

    if (col) {
        // ✅ Deducts the specific working days (excluding Sundays)
        await db.query(
            `UPDATE users SET ${col} = GREATEST(0, ${col} - ?) WHERE id = ?`, 
            [days_requested, user_id]
        );
    }
}
            // 3. Update the status of the leave request itself
        await db.query("UPDATE user_leaves SET status = ? WHERE id = ?", [action, id]);

        // 4. Create a notification for the user
        const notifType = action === 'Approved' ? 'leave_approved' : 'leave_rejected';
        const notifTitle = `Leave Request ${action}`;
        const notifMessage = `Your ${leave_type} request for ${new Date(start_date).toLocaleDateString()} (${days_requested} working days) has been ${action.toLowerCase()}.`;

        await db.query(
            `INSERT INTO notifications (user_id, type, title, message, related_id) 
             VALUES (?, ?, ?, ?, ?)`,
            [user_id, notifType, notifTitle, notifMessage, id]
        );

        res.json({ 
            success: true, 
            message: `Leave ${action} successfully. ${days_requested} days deducted from balance.` 
        });

    } catch (error) {
        console.error("Admin Action Error: - admin.controller.js:890", error);
        res.status(500).json({ success: false, message: "Internal Server Error: " + error.message });
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


// export const getMyProjects = async (req, res) => {

//     try {
//         const userId = req.user.id; // Extract from token

//         const query = `
//             SELECT 
//                 p.*,
//                 (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as team_count,
//                 (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as total_tasks,
//                 (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'completed') as completed_tasks,
//                 u.name as creator_name
//             FROM projects p
//             JOIN project_members pm ON p.id = pm.project_id
//             JOIN users u ON p.created_by = u.id
//             WHERE pm.user_id = ?
//             ORDER BY p.created_at DESC
//         `;

//         const [projects] = await db.query(query, [userId]);

//         res.json({ success: true, projects });
//     } catch (error) {
//         console.error("Fetch Projects Error: - admin.controller.js:902", error);
//         res.status(500).json({ success: false, message: "Database error" });
//     }
// };




// export const getMyProjects = async (req, res) => {
//     try {
//         const userId = req.user.id; // User ID from decoded token

//         const query = `
//             SELECT 
//                 p.id, p.name, p.description, p.status, p.start_date, p.end_date,
//                 u.name as creator_name,
//                 (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as team_count,
//                 (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND assigned_to = ?) as my_total_tasks,
//                 (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND assigned_to = ? AND status = 'completed') as my_completed_tasks,
//                 DATEDIFF(p.end_date, CURDATE()) as days_remaining
//             FROM projects p
//             JOIN project_members pm ON p.id = pm.project_id
//             JOIN users u ON p.created_by = u.id
//             WHERE pm.user_id = ?
//             ORDER BY p.created_at DESC
//         `;

//         const [projects] = await db.query(query, [userId, userId, userId]);
//         res.json({ success: true, projects });
//     } catch (error) {
//         console.error("Database Error: - admin.controller.js:933", error);
//         res.status(500).json({ success: false, message: "Server Error" });
//     }
// };

// export const getMyProjects = async (req, res) => {
//     try {
//         const userId = req.user.id; // User ID from decoded auth token

//         const query = `
//             SELECT 
//                 p.id, p.name, p.description, p.status, p.start_date, p.end_date,
//                 u.name as creator_name,
//                 (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as team_count,
//                 (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as total_tasks,
//                 (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'completed') as completed_tasks,
//                 DATEDIFF(p.end_date, CURDATE()) as days_remaining
//             FROM projects p
//             JOIN project_members pm ON p.id = pm.project_id
//             JOIN users u ON p.created_by = u.id
//             WHERE pm.user_id = ?
//             ORDER BY p.created_at DESC
//         `;

//         const [projects] = await db.query(query, [userId]);
//         res.json({ success: true, projects });
//     } catch (error) {
//         console.error("Fetch Projects Error: - admin.controller.js:960", error);
//         res.status(500).json({ success: false, message: "Database Error: " + error.message });
//     }
// };

// --- Inside admin.controller.js ---

// export const getMyProjects = async (req, res) => {
//     try {
//         // This comes from your authentication middleware (protectAdmin)
//         const userId = req.user.id; 

//         const query = `
//             SELECT 
//                 p.id, 
//                 p.name, 
//                 p.description, 
//                 p.status, 
//                 p.start_date, 
//                 p.end_date,
//                 u.name AS creator_name,
//                 -- 1. Counts unique team members joined in project_members
//                 (SELECT COUNT(DISTINCT user_id) FROM project_members WHERE project_id = p.id) AS team_count,
//                 -- 2. Counts total tasks linked to this project_id
//                 (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) AS total_tasks,
//                 -- 3. Counts only completed tasks for the progress bar calculation
//                 (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'completed') AS completed_tasks,
//                 -- 4. Calculates the "X days remaining" logic shown in your image
//                 DATEDIFF(p.end_date, CURDATE()) AS days_remaining
//             FROM projects p
//             JOIN users u ON p.created_by = u.id
//             JOIN project_members pm ON p.id = pm.project_id
//             WHERE pm.user_id = ? 
//             ORDER BY p.created_at DESC
//         `;

//         const [projects] = await db.query(query, [userId]);

//         res.json({ 
//             success: true, 
//             projects 
//         });

//     } catch (err) {
//         console.error("Fetch MyProjects Error: - admin.controller.js:1054", err.message);
//         res.status(500).json({ 
//             success: false, 
//             message: "Server Database Error" 
//         });
//     }
// };


export const createProject = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const { name, description, start_date, end_date, members } = req.body;
        const adminId = req.user.id; 

        // 1. Insert into 'projects' table
        // Changed 'active' to 'pending' to satisfy your new default state requirement
        const [projectResult] = await connection.query(
            `INSERT INTO projects (name, description, status, start_date, end_date, created_by, created_at, updated_at) 
             VALUES (?, ?, 'pending', ?, ?, ?, NOW(), NOW())`,
            [name, description, start_date || null, end_date || null, adminId]
        );

        const projectId = projectResult.insertId;

        // 2. Prepare Member Data
        const allMemberIds = new Set([...(members || []), adminId]);
        
        const memberData = Array.from(allMemberIds).map(userId => [
            projectId,
            userId,
            userId === adminId ? 'admin' : 'member',
            adminId,
            new Date()
        ]);

        // 3. Insert all members
        await connection.query(
            "INSERT INTO project_members (project_id, user_id, role, added_by, joined_date) VALUES ?",
            [memberData]
        );

        // 4. Log the activity
        await connection.query(
            "INSERT INTO project_activities (project_id, user_id, activity_type, description, created_at) VALUES (?, ?, 'project_created', ?, NOW())",
            [projectId, adminId, `Project '${name}' was created and initialized as PENDING.`]
        );

        await connection.commit();
        res.status(201).json({ success: true, message: "Project created in pending state!", projectId });

    } catch (error) {
        await connection.rollback();
        console.error("Project Creation Error: - admin.controller.js:1109", error.message);
        res.status(500).json({ success: false, message: "Failed to create project: " + error.message });
    } finally {
        connection.release();
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
        console.error("Update Status Error: - admin.controller.js:1138", error);
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
            -- We use LEFT JOIN so we don't hide projects that don't have members yet
            LEFT JOIN project_members pm ON p.id = pm.project_id
            -- FIX: Show if I created it OR if I am a member
            WHERE p.created_by = ? OR pm.user_id = ?
            -- GROUP BY is needed because one project might have multiple members
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
        console.error("Fetch MyProjects Error: - admin.controller.js:1185", err.message);
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
        console.error("Assign Error: - admin.controller.js:1219", err);
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
        console.error("Remove Error: - admin.controller.js:1237", err);
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
                u.email 
            FROM users u
            INNER JOIN project_members pm ON u.id = pm.user_id
            WHERE pm.project_id = ?
        `;

        const [team] = await db.query(query, [projectId]);

        // console.log para debug: check if this prints names in your terminal
        console.log(`Fetching team for Project ${projectId}: - admin.controller.js:1260`, team);

        res.json({ 
            success: true, 
            team: team 
        });
    } catch (err) {
        console.error("Get Team Error: - admin.controller.js:1267", err);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};


// Ensure 'export' is at the start of the function
// export const punchInController = async (req, res) => {
//     try {
//         const { userId, breakType } = req.body;
//         // Your logic to insert into the database here...
//         res.json({ success: true, message: "Punch-in successful" });
//     } catch (error) {
//         res.status(500).json({ success: false, message: error.message });
//     }
// };


// Ensure 'export' is present and names are exact
// export const punchInBreak = async (req, res) => {
//     const { userId, breakType } = req.body;
//     const now = new Date();
//     const date = now.toISOString().split('T')[0]; 
//     const time = now.toTimeString().split(' ')[0]; 

//     try {
//         const [result] = await db.query(
//             "INSERT INTO breaks (user_id, break_type, break_date, break_time) VALUES (?, ?, ?, ?)",
//             [userId, breakType, date, time]
//         );
//         res.json({ success: true, id: result.insertId });
//     } catch (error) {
//         res.status(500).json({ success: false, message: error.message });
//     }
// };

// export const punchOutBreak = async (req, res) => {
//     const { breakId } = req.body;
//     const now = new Date();
//     const endTime = now.toTimeString().split(' ')[0]; 

//     try {
//         await db.query(
//             "UPDATE breaks SET end_time = ? WHERE id = ?",
//             [endTime, breakId]
//         );
//         res.json({ success: true, message: "Punch-out recorded" });
//     } catch (error) {
//         res.status(500).json({ success: false, message: error.message });
//     }
// };
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