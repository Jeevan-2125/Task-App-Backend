import db from '../db/db.js';

export const getDashboardData = async (req, res) => {
    try {
        const userId = req.user.id;
        const { status, search, sortBy } = req.query;

        
       // 1. Task Sorting & Base Query
       const sortOrder = sortBy === 'earlier' ? 'ASC' : 'DESC';
       let query = `
           SELECT id, project_id, title, title AS name, description, status, priority, 
           DATE_FORMAT(due_date, '%Y-%m-%d') as due_date,
           DATE_FORMAT(created_at, '%Y-%m-%d') as created_at,
           (SELECT status 
            FROM reassignment_requests rr 
            WHERE rr.task_id = tasks.id 
            ORDER BY requested_at DESC LIMIT 1) AS reassign_status
           FROM tasks 
           WHERE assigned_to = ?
       `;
       const params = [userId];
        if (status && status !== 'all') { query += " AND status = ?"; params.push(status); }
        if (search) { query += " AND (title LIKE ? OR description LIKE ?)"; params.push(`%${search}%`, `%${search}%`); }
        query += ` ORDER BY created_at ${sortOrder}`;

        const [tasks] = await db.query(query, params);
        
        // 2. Presence Logic (Swiggy Toggle & Breaks)
        const [session] = await db.query("SELECT id FROM attendance WHERE user_id = ? AND date = CURDATE() AND logout_time IS NULL", [userId]);
        const [todayBreaks] = await db.query("SELECT id, break_type, break_time, end_time, TIMESTAMPDIFF(SECOND, STR_TO_DATE(CONCAT(break_date, ' ', break_time), '%Y-%m-%d %H:%i:%s'), NOW()) as elapsed_seconds FROM breaks WHERE user_id = ? AND break_date = CURDATE()", [userId]);
        const [specialStatus] = await db.query("SELECT status_type, status FROM user_status WHERE user_id = ? AND CURDATE() BETWEEN start_date AND end_date ORDER BY created_at DESC LIMIT 1", [userId]);

        // 3. Task Stats
        const [stats] = await db.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as inProgress,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
            FROM tasks WHERE assigned_to = ?
        `, [userId]);

        // 4. Graph Data: Weekly (Last 7 Days)
        const [weeklyDb] = await db.query(`
            SELECT DATE_FORMAT(date, '%a') as label, ROUND(SUM(TIMESTAMPDIFF(MINUTE, login_time, IFNULL(logout_time, NOW()))) / 60, 1) as value 
            FROM attendance WHERE user_id = ? AND date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) GROUP BY date, label ORDER BY date ASC
        `, [userId]);

        // 5. Graph Data: Yearly (12 Months)
        const [yearlyDb] = await db.query(`
            SELECT DATE_FORMAT(date, '%b') as label, ROUND(SUM(TIMESTAMPDIFF(MINUTE, login_time, IFNULL(logout_time, NOW()))) / 60, 1) as value 
            FROM attendance WHERE user_id = ? AND YEAR(date) = YEAR(CURDATE()) GROUP BY MONTH(date), label ORDER BY MONTH(date) ASC
        `, [userId]);

        // 6. Recent Unread Notifications (For Dashboard Alert Bar)
        const [recentNotifications] = await db.query(`
            SELECT id, title, message, type, created_at 
            FROM notifications 
            WHERE user_id = ? AND is_read = 0 
            ORDER BY created_at DESC LIMIT 2
        `, [userId]);

        const [unreadCountResult] = await db.query(`
            SELECT COUNT(*) as count 
            FROM notifications 
            WHERE user_id = ? AND is_read = 0
        `, [userId]);

        res.json({
            success: true,
            tasks,
            stats: stats[0],
            userName: req.user.name,
            unreadCount: unreadCountResult[0].count,
            notifications: recentNotifications,
            presence: {
                isOnline: session.length > 0,
                todayBreaks: todayBreaks,
                specialStatus: specialStatus.length > 0 ? specialStatus[0] : null
            },
            graphData: {
                weekly: {
                    labels: weeklyDb.length ? weeklyDb.map(d => d.label) : ['No Data'],
                    data: weeklyDb.length ? weeklyDb.map(d => parseFloat(d.value)) : [0]
                },
                yearly: {
                    labels: yearlyDb.length ? yearlyDb.map(d => d.label) : ['No Data'],
                    data: yearlyDb.length ? yearlyDb.map(d => parseFloat(d.value)) : [0]
                }
            }
        });
    } catch (error) {
        console.error("Dashboard API Error: - dashboard.controller.js:94", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

export const getEmployeeDashboard = getDashboardData;
