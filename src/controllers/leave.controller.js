import db from '../db/db.js';

export const applyLeave = async (req, res) => {
    const { leaveType, startDate, endDate, reason } = req.body;
    const userId = req.user.id;

    try {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        // 1. Calculate working days (Excluding Sundays)
        let daysCount = 0;
        let tempDate = new Date(start);

        while (tempDate <= end) {
            if (tempDate.getDay() !== 0) { // Skip Sunday (0)
                daysCount++;
            }
            tempDate.setDate(tempDate.getDate() + 1);
        }

        if (daysCount === 0) {
            return res.status(400).json({ success: false, message: "Leave duration cannot only be Sundays." });
        }

        // 2. Insert using the new column names
        const query = `
            INSERT INTO user_leaves 
            (user_id, leave_type, start_date, end_date, days_requested, reason, status) 
            VALUES (?, ?, ?, ?, ?, ?, 'pending')
        `;

        await db.execute(query, [userId, leaveType, startDate, endDate, daysCount, reason]);

        res.json({ success: true, message: "Leave applied successfully!" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Database Error: " + err.message });
    }
};

// backend/src/controllers/leave.controller.js

export const getLeaveBalance = async (req, res) => {
  try {
    const userId = req.user.id;
    const [rows] = await db.query(
      "SELECT sick_leave_bal, casual_leave_bal, earned_leave_bal FROM users WHERE id = ?",
      [userId]
    );

    if (rows.length === 0) return res.status(404).json({ success: false, message: "User not found" });

    res.json({
      success: true,
      balances: {
        sick: rows[0].sick_leave_bal,
        casual: rows[0].casual_leave_bal,
        earned: rows[0].earned_leave_bal,
        maternity: 90,
        paternity: 7,
        other: 5
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};