import db from '../db/db.js';

// Get Admin Profile Details
export const getAdminProfile = async (req, res) => {
    try {
        const adminId = req.user.id; 
        const [rows] = await db.query(
            'SELECT id, name, email, role, status, profile_photo, created_at FROM users WHERE id = ? AND role = "admin"',
            [adminId]
        );

        if (rows.length === 0) return res.status(404).json({ success: false, message: 'Admin not found' });
        res.json({ success: true, admin: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// Toggle Admin Online/Offline Status (Image 8 logic)
export const updateAdminStatus = async (req, res) => {
    try {
        const adminId = req.user.id;
        const { status } = req.body; 
        await db.query('UPDATE users SET status = ? WHERE id = ?', [status, adminId]);
        res.json({ success: true, message: 'Status updated' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};


/**
 * Fetches all necessary data for the Admin Profile tabs
 * Mapped to 'projects', 'tasks', and 'attendance' tables
 */

export const getAdminProfileTabs = async (req, res) => {
    try {
        const adminId = req.user.id; // From verifyToken middleware
        
        // 1. Fetch Admin Info from 'users' table
        const [adminRows] = await db.query(
            'SELECT name, email, role, status, profile_photo, created_at FROM users WHERE id = ?', 
            [adminId]
        );

        // 2. Fetch Projects linked to the Admin (created_by)
        const [projects] = await db.query(
            'SELECT id, name as title, status, start_date, created_at FROM projects WHERE created_by = ?', 
            [adminId]
        );
        
        // 3. Fetch Recent Attendance for this specific Admin
        const [attendance] = await db.query(
            'SELECT login_time, logout_time, status FROM attendance WHERE user_id = ? ORDER BY login_time DESC LIMIT 10',
            [adminId]
        );

        // 4. Fetch Task Statistics for tasks assigned to the Admin
        const [taskStats] = await db.query(`
            SELECT 
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
                COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as progress,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
                COUNT(*) as total
            FROM tasks WHERE assigned_to = ?`, [adminId]);

        // 5. Build Response Object
        res.json({
            success: true,
            admin: adminRows[0] || { name: "Admin", role: "Software Developer" },
            projects: projects || [],
            projectStats: {
                planning: projects.filter(p => p.status === 'planning').length,
                active: projects.filter(p => p.status === 'active').length,
                onHold: projects.filter(p => p.status === 'on_hold').length,
                completed: projects.filter(p => p.status === 'completed').length
            },
            attendance: attendance || [],
            tasks: taskStats[0] || { pending: 0, progress: 0, completed: 0, total: 0 }
        });

    } catch (err) {
        console.error("Profile Backend Error: - adminProfile.controller.js:84", err.message);
        res.status(500).json({ success: false, message: "Server Error: Database connection failed." });
    }
};