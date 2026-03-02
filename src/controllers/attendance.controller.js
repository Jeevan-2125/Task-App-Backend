import db from '../db/db.js';

export const getAttendanceHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        const { month, year } = req.query;

        // ✅ FIX 1: We use DATE_FORMAT to force MySQL to output a plain string. 
        // This stops Node.js from magically converting the timezone!
        const [rows] = await db.query(`
            SELECT 
                DATE_FORMAT(a.date, '%Y-%m-%d') as date,
                DATE_FORMAT(a.login_time, '%Y-%m-%d %H:%i:%s') as login,
                DATE_FORMAT(a.logout_time, '%Y-%m-%d %H:%i:%s') as logout_time,
                a.status as original_status,
                h.reason as holiday_reason,
                CASE 
                    WHEN h.holiday_date IS NOT NULL THEN 'Holiday'
                    WHEN DAYOFWEEK(a.date) = 1 THEN 'Weekend'
                    ELSE a.status 
                END as status
            FROM attendance a
            LEFT JOIN holidays h ON a.date = h.holiday_date
            WHERE a.user_id = ? AND MONTH(a.date) = ? AND YEAR(a.date) = ?
        `, [userId, month, year]);

        const history = rows.reduce((acc, row) => {
            acc[row.date] = { 
                login: row.login, 
                status: row.status,
                logout_time: row.logout_time 
            };
            return acc;
        }, {});

        res.json({ success: true, history });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const handleSession = async (req, res) => {
    try {
        const userId = req.user.id;
        const { action } = req.body; 
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const userAgent = req.headers['user-agent'];

        if (action === 'refresh') {
            const [existing] = await db.query(
                "SELECT id FROM attendance WHERE user_id = ? AND date = DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 330 MINUTE))", 
                [userId]
            );

            if (existing.length === 0) {
                // ✅ FIX 2: Replaced NOW() with a bulletproof MySQL IST calculator (UTC + 330 mins)
                await db.query(`
                    INSERT INTO attendance (
                        user_id, login_time, ip_address, user_agent, status, date, created_at
                    ) 
                    VALUES (?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 330 MINUTE), ?, ?, 'Active session', DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 330 MINUTE)), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 330 MINUTE))
                `, [userId, ip, userAgent]);
            }
            
            await db.query("UPDATE users SET status = 'active' WHERE id = ?", [userId]);
        } 
        else if (action === 'end') {
            await db.query(`
                UPDATE attendance 
                SET logout_time = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 330 MINUTE), 
                    status = 'Present',
                    work_hours = ROUND(TIMESTAMPDIFF(MINUTE, login_time, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 330 MINUTE)) / 60, 2)
                WHERE user_id = ? AND date = DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 330 MINUTE)) AND logout_time IS NULL
            `, [userId]);

            await db.query("UPDATE users SET status = 'inactive' WHERE id = ?", [userId]);
        }

        res.json({ success: true });
    } catch (error) {
        console.error("HandleSession Error: - attendance.controller.js:81", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const checkCurrentSession = async (req, res) => {
    try {
        const userId = req.user.id; 
        const [session] = await db.query(
          "SELECT id FROM attendance WHERE user_id = ? AND date = DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 330 MINUTE)) AND logout_time IS NULL",
            [userId]
        );

        res.json({ 
            success: true, 
            isActive: session.length > 0 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getAdminAttendanceDashboard = async (req, res) => {
    try {
        const [stats] = await db.query(`
            SELECT 
                COUNT(CASE WHEN status = 'Present' THEN 1 END) as presentCount,
                COUNT(CASE WHEN status = 'Absent' THEN 1 END) as absentCount
            FROM attendance WHERE date = DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 330 MINUTE))
        `);
        
        res.json({ success: true, stats: stats[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const toggleHoliday = async (req, res) => {
    const { date, reason, type } = req.body; 
    try {
        const [existing] = await db.query("SELECT id FROM holidays WHERE holiday_date = ?", [date]);
        if (existing.length > 0) {
            await db.query("DELETE FROM holidays WHERE holiday_date = ?", [date]);
            return res.json({ success: true, message: "Holiday removed successfully" });
        } else {
            await db.query(
                "INSERT INTO holidays (holiday_date, reason, type) VALUES (?, ?, ?)",
                [date, reason, type || 'Government']
            );
            return res.json({ success: true, message: "Holiday set successfully" });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: "Database error: " + error.message });
    }
};

export const getHolidays = async (req, res) => {
    try {
        const [holidays] = await db.query("SELECT holiday_date, reason, type FROM holidays");
        res.json({ success: true, holidays });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
