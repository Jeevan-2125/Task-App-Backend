import db from '../db/db.js';

export const saveMessage = async (req, res) => {
    try {
        const { project_id, task_id, message } = req.body;
        const sender_id = req.user.id;

        const [result] = await db.query(
            "INSERT INTO messages (project_id, task_id, sender_id, message) VALUES (?, ?, ?, ?)",
            [project_id || null, task_id || null, sender_id, message]
        );

        res.json({ success: true, messageId: result.insertId });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getMessages = async (req, res) => {
    try {
        const { type, id } = req.params; // type = 'project' or 'task'
        const column = type === 'project' ? 'project_id' : 'task_id';

        const [rows] = await db.query(`
            SELECT m.*, u.name as sender_name, u.profile_photo 
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.${column} = ?
            ORDER BY m.created_at ASC
        `, [id]);

        res.json({ success: true, messages: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};