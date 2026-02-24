import express from 'express';
import db from '../db/db.js'; // Ensure path to your db.js is correct
import { verifyToken } from '../middlewares/auth.middleware.js'; // Protect the chat history

const router = express.Router();

router.get('/:type/:id', verifyToken, async (req, res) => {
    try {
        const { type, id } = req.params;

        // Security check: only allow 'project' or 'task' types
        if (type !== 'project' && type !== 'task') {
            return res.status(400).json({ success: false, message: "Invalid chat type" });
        }

        const column = type === 'project' ? 'project_id' : 'task_id';

        // Fetch messages sorted by time so the conversation flows correctly
        const [messages] = await db.query(
            `SELECT 
                id, 
                project_id, 
                task_id, 
                sender_id, 
                sender_name, 
                message, 
                message_type, 
                created_at 
             FROM messages 
             WHERE ${column} = ? 
             ORDER BY created_at ASC`,
            [id]
        );

        res.json({ 
            success: true, 
            messages: messages 
        });

    } catch (err) {
        console.error("Chat History Error: - chat.routes.js:41", err);
        res.status(500).json({ success: false, message: "Server error retrieving messages" });
    }
});

export default router;