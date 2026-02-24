import db from '../db/db.js';

export const createTask = async (req, res) => {
    try {
        const { title, description, assigned_to, due_date } = req.body;

        if (!title || !assigned_to || !due_date) {
            return res.status(400).json({ success: false, message: "Required fields missing" });
        }

        const query = `
            INSERT INTO tasks (title, description, assigned_to, due_date, status) 
            VALUES (?, ?, ?, ?, 'pending')
        `;

        const [result] = await db.query(query, [title, description, assigned_to, due_date]);

        res.json({ 
            success: true, 
            message: "Task created successfully", 
            taskId: result.insertId 
        });
    } catch (err) {
        console.error("Create Task Error: - task.controller.js:24", err.message);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};


export const updateTaskStatus = async (req, res) => {
    try {
        const { taskId, status } = req.body;
        const userId = req.user.id;

        // 1. Check current status
        const [task] = await db.query("SELECT status FROM tasks WHERE id = ?", [taskId]);
        const currentStatus = task[0].status;

        // 2. Prevent backward movement
        const statusOrder = { 'pending': 1, 'in_progress': 2, 'completed': 3 };
        if (statusOrder[status] <= statusOrder[currentStatus]) {
            return res.status(400).json({ 
                success: false, 
                message: "You cannot move a task back to a previous stage." 
            });
        }

        // 3. Update the task
        await db.query(
            `UPDATE tasks SET status = ?, completion_date = ${status === 'completed' ? 'NOW()' : 'NULL'} WHERE id = ?`,
            [status, taskId]
        );

        // 4. Log it
        await db.query(
            "INSERT INTO task_status_log (task_id, user_id, old_status, new_status, changed_at) VALUES (?, ?, ?, ?, NOW())",
            [taskId, userId, currentStatus, status]
        );

        res.json({ success: true, message: "Status updated successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};