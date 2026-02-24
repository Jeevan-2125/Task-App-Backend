import db from '../db/db.js';
export const getDashboardData = async (req, res) => {
    try {
        const userId = req.user.id;
        const { status, search, sortBy } = req.query;

        // 1. Determine Sort Order
        // 'latest' -> DESC (Newest first)
        // 'earlier' -> ASC (Oldest first)
        const sortOrder = sortBy === 'earlier' ? 'ASC' : 'DESC';

        // 2. Base Query
        let query = `
            SELECT id, title, description, status, priority, 
            DATE_FORMAT(due_date, '%Y-%m-%d') as due_date,
            DATE_FORMAT(created_at, '%Y-%m-%d') as created_at
            FROM tasks 
            WHERE assigned_to = ?
        `;
        const params = [userId];

        // 3. Apply Status Filter
        if (status && status !== 'all') {
            query += " AND status = ?";
            params.push(status);
        }

        // 4. Apply Search Filter
        if (search) {
            query += " AND (title LIKE ? OR description LIKE ?)";
            params.push(`%${search}%`, `%${search}%`);
        }

        // 5. Apply Dynamic Sorting
        query += ` ORDER BY created_at ${sortOrder}`;

        const [tasks] = await db.query(query, params);

        // 6. Fetch Stats for the Dashboard Circles
        const [stats] = await db.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as inProgress,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
            FROM tasks WHERE assigned_to = ?
        `, [userId]);

        res.json({
            success: true,
            tasks,
            stats: stats[0],
            userName: req.user.name
        });

    } catch (error) {
        console.error("Dashboard API Error: - dashboard.controller.js:57", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

export const getEmployeeDashboard = getDashboardData;
