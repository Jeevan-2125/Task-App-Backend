import db from '../db/db.js';

/**
 * @desc    Fetch all notifications for a specific user
 * @route   GET /api/notifications
 */
export const getUserNotifications = async (req, res) => {
    try {
        const userId = req.user.id;
        // Using DATE_FORMAT to make the date frontend-ready
        const [rows] = await db.execute(
            `SELECT id, type, title, message, is_read, related_id,
             DATE_FORMAT(created_at, '%b %d, %h:%i %p') as date 
             FROM notifications 
             WHERE user_id = ? 
             ORDER BY created_at DESC`,
            [userId]
        );

        res.json({ success: true, notifications: rows });
    } catch (error) {
        console.error("Fetch Notifications Error: - notification.controller.js:22", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Mark a single notification as read
 * @route   PUT /api/notifications/:id/read
 */
export const markNotificationRead = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        const [result] = await db.execute(
            "UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?",
            [id, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Notification not found" });
        }

        res.json({ success: true, message: "Marked as read" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * @desc    Mark all notifications as read for the logged-in user
 * @route   PUT /api/notifications/read-all
 */
export const markAllAsRead = async (req, res) => {
    try {
        const userId = req.user.id;
        await db.execute(
            "UPDATE notifications SET is_read = 1 WHERE user_id = ?",
            [userId]
        );
        res.json({ success: true, message: "All notifications marked as read" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};