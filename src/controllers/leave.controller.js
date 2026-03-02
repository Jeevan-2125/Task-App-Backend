import db from '../db/db.js';

// --- GET LEAVE BALANCES (Corrected for final schema) ---
export const getLeaveBalance = async (req, res) => {
  try {
    const userId = req.user.id;
    const currentYear = new Date().getFullYear();

    // 1. Fetch the user's base leave limits from the users table
    const [userRows] = await db.query(
      "SELECT sick_leave_bal, casual_leave_bal, earned_leave_bal FROM users WHERE id = ?",
      [userId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // 2. Fetch used leaves by summing 'days_requested'
    // We filter by start_date to catch leaves belonging to this year
    const [usedLeavesData] = await db.query(`
        SELECT leave_type, SUM(days_requested) as total_used 
        FROM user_leaves 
        WHERE user_id = ? 
        AND YEAR(start_date) = ? 
        AND status = 'approved'
        GROUP BY leave_type
    `, [userId, currentYear]);

    // Initialize mapping
    const used = { sick: 0, casual: 0, earned: 0, maternity: 0, paternity: 0, other: 0 };

    usedLeavesData.forEach(row => {
        // Ensure keys are lowercase to match baseBalances keys
        const type = row.leave_type.toLowerCase();
        if (used.hasOwnProperty(type)) {
            used[type] = Number(row.total_used) || 0;
        }
    });

    // 3. Final calculation: Base - Used
    const balances = {
        sick: (userRows[0].sick_leave_bal || 12) - used.sick,
        casual: (userRows[0].casual_leave_bal || 10) - used.casual,
        earned: (userRows[0].earned_leave_bal || 15) - used.earned,
        maternity: 90 - used.maternity,
        paternity: 7 - used.paternity,
        other: 5 - used.other
    };

    res.json({ success: true, balances });
  } catch (error) {
    // This log in your terminal will show the exact SQL error if it persists
    console.error("Balance fetch error details: - leave.controller.js:54", error.message);
    res.status(500).json({ success: false, message: "Database error during balance fetch" });
  }
};


export const applyLeave = async (req, res) => {
    const { leaveType, startDate, endDate, reason, totalDays } = req.body;
    const userId = req.user.id;

    try {
        // 1. Simple Overlap Check using your new columns
        const overlapQuery = `
            SELECT id FROM user_leaves 
            WHERE user_id = ? 
            AND status != 'rejected'
            AND (
                (start_date <= ? AND end_date >= ?)
            )
        `;
        const [overlap] = await db.query(overlapQuery, [userId, endDate, startDate]);

        if (overlap.length > 0) {
            return res.json({ success: false, message: "You already have a leave request for these dates." });
        }

        // 2. Insert using your final table structure
        const insertQuery = `
            INSERT INTO user_leaves 
            (user_id, leave_type, start_date, end_date, days_requested, reason, status) 
            VALUES (?, ?, ?, ?, ?, ?, 'pending')
        `;
        
        await db.query(insertQuery, [
            userId, 
            leaveType.toLowerCase(), // matches your db enums
            startDate, 
            endDate, 
            totalDays, 
            reason
        ]);

        res.json({ success: true, message: "Leave application submitted successfully!" });
    } catch (err) {
        console.error("Apply Leave Error: - leave.controller.js:98", err.message);
        res.status(500).json({ success: false, message: "Database Error: " + err.message });
    }
};

