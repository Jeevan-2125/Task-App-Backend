import db from '../db/db.js';

export const getAttendanceHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        const { month, year } = req.query;

        // ✅ FIXED: Added DATE_FORMAT for login_time to provide a clean string for the frontend
        const [rows] = await db.query(`
            SELECT 
                DATE_FORMAT(a.date, '%Y-%m-%d') as date,
                DATE_FORMAT(a.login_time, '%h:%i %p') as login, 
                a.login_time as raw_login_time,
                a.logout_time,
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

        // ✅ FIXED: Mapping 'login' field so frontend record.login is never undefined
        const history = rows.reduce((acc, row) => {
            acc[row.date] = { 
                login: row.login, // This will now show as "09:30 AM"
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
        const { action } = req.body; // 'refresh' or 'end'
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const userAgent = req.headers['user-agent'];

        if (action === 'refresh') {
            const [existing] = await db.query(
                "SELECT id FROM attendance WHERE user_id = ? AND date = CURDATE()", 
                [userId]
            );

            if (existing.length === 0) {
                await db.query(`
                    INSERT INTO attendance (
                        user_id, login_time, ip_address, user_agent, status, date, created_at
                    ) 
                    VALUES (?, NOW(), ?, ?, 'Active session', CURDATE(), NOW())
                `, [userId, ip, userAgent]);
            }
            
            await db.query("UPDATE users SET status = 'active' WHERE id = ?", [userId]);
        } 
        else if (action === 'end') {
            await db.query(`
                UPDATE attendance 
                SET logout_time = NOW(), 
                    status = 'Present',
                    work_hours = ROUND(TIMESTAMPDIFF(MINUTE, login_time, NOW()) / 60, 2)
                WHERE user_id = ? AND date = CURDATE() AND logout_time IS NULL
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
          "SELECT id FROM attendance WHERE user_id = ? AND date = CURDATE() AND logout_time IS NULL",
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
            FROM attendance WHERE date = CURDATE()
        `);
        
        res.json({ success: true, stats: stats[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const toggleHoliday = async (req, res) => {
    const { date, reason, type } = req.body; 

    try {
        // 1. Check if the holiday already exists on this date
        const [existing] = await db.query("SELECT id FROM holidays WHERE holiday_date = ?", [date]);

        if (existing.length > 0) {
            // 2. If it exists, delete it (Toggle Off)
            await db.query("DELETE FROM holidays WHERE holiday_date = ?", [date]);
            return res.json({ success: true, message: "Holiday removed successfully" });
        } else {
            // 3. If not, insert it (Toggle On) 
            // Matches your columns: holiday_date, reason, type
            await db.query(
                "INSERT INTO holidays (holiday_date, reason, type) VALUES (?, ?, ?)",
                [date, reason, type || 'Government']
            );
            return res.json({ success: true, message: "Holiday set successfully" });
        }
    } catch (error) {
        console.error("Database Error: - attendance.controller.js:139", error);
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