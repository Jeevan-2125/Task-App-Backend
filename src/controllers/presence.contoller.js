import db from '../db/db.js';

// --- BREAK MANAGEMENT ---
export const toggleBreak = async (req, res) => {
    try {
        const userId = req.user.id;
        const { breakType, action } = req.body; // action: 'start' or 'stop'

        if (action === 'start') {
            // 1. Check limits (1 Lunch, 2 Teas per day)
            const [existing] = await db.query(
                "SELECT COUNT(*) as count FROM breaks WHERE user_id = ? AND break_type = ? AND break_date = CURDATE()",
                [userId, breakType]
            );
            
            const limit = breakType === 'lunch' ? 1 : 2;
            if (existing[0].count >= limit) {
                return res.status(400).json({ success: false, message: `${breakType} break limit reached for today.` });
            }

            // 2. Start the break
            const [result] = await db.query(
                "INSERT INTO breaks (user_id, break_type, break_date, break_time) VALUES (?, ?, CURDATE(), CURTIME())",
                [userId, breakType]
            );
            return res.json({ success: true, breakId: result.insertId, message: "Break started" });
            
        } else if (action === 'stop') {
            // Stop the active break
            await db.query(
                "UPDATE breaks SET end_time = CURTIME() WHERE user_id = ? AND end_time IS NULL",
                [userId]
            );
            return res.json({ success: true, message: "Break ended" });
        }
    } catch (error) {
        console.error("Break Error: - presence.controller.js:37", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// --- SPECIAL STATUS REQUEST (WFH, OOO, etc.) ---
export const requestSpecialStatus = async (req, res) => {
    try {
        // Data coming from the frontend modal
        const { statusType, reason, startDate } = req.body;
        const userId = req.user.id; 

        // Insert into your correct user_status table
        await db.query(
            `INSERT INTO user_status (user_id, status_type, reason, start_date, status) 
             VALUES (?, ?, ?, ?, 'pending')`,
            [userId, statusType, reason, startDate]
        );

        res.json({ success: true, message: "Request submitted to Admin" });
    } catch (error) {
        console.error("Submit Status Request Error: - presence.controller.js:58", error);
        res.status(500).json({ success: false, message: "Failed to save request" });
    }
};
