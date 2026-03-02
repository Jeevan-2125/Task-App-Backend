import db from '../db/db.js';

export const requestTaskReassignment = async (req, res) => {
    try {
        // We only need the raw inputs from the frontend now
        const { taskId, projectId, newAssigneeId, reason } = req.body;
        const userId = req.user.id;
        const userName = req.user.name;

        // Validation
        if (!newAssigneeId) return res.status(400).json({ success: false, message: 'Please select a team member' });
        if (!reason) return res.status(400).json({ success: false, message: 'Please provide a reason' });

        // 1. Get task and project details directly from the database
        const [taskInfo] = await db.query(`
            SELECT t.title as task_name, t.assigned_to, p.name as project_name 
            FROM tasks t
            LEFT JOIN projects p ON t.project_id = p.id
            WHERE t.id = ?
        `, [taskId]);

        if (taskInfo.length === 0) throw new Error("Task not found");
        
        const taskName = taskInfo[0].task_name;
        const projectName = taskInfo[0].project_name || 'Independent Task';
        
        // 2. Format current and new assignees as JSON arrays (just like the PHP script)
        const currentAssigneesJson = JSON.stringify([taskInfo[0].assigned_to]);
        const newAssigneesJson = JSON.stringify([newAssigneeId]);

        // Get the new assignee's name for the notification
        const [newUser] = await db.query("SELECT name FROM users WHERE id = ?", [newAssigneeId]);
        const newAssigneeName = newUser.length > 0 ? newUser[0].name : 'Team Member';

        // 3. Insert into reassignment_requests
        const [insertResult] = await db.query(`
            INSERT INTO reassignment_requests 
            (task_id, project_id, requester_id, requester_name, task_name, project_name, current_assignees_json, new_assignees_json, reason, status, requested_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())
        `, [
            taskId, 
            projectId || 0, // Safe fallback
            userId, 
            userName, 
            taskName, 
            projectName,
            currentAssigneesJson, 
            newAssigneesJson, 
            reason
        ]);

        const requestId = insertResult.insertId;

        // 4. Notify ALL Admins (just like the PHP script)
        const [admins] = await db.query("SELECT id FROM users WHERE role = 'admin'");
        const notifMessage = `Task Reassignment Request: ${userName} wants to reassign '${taskName}' to ${newAssigneeName}. Reason: ${reason}`;
        
        for (let admin of admins) {
            await db.query(`
                INSERT INTO notifications (user_id, title, message, type, is_read, created_at) 
                VALUES (?, 'Task Reassignment Request', ?, 'reassignment', 0, NOW())
            `, [admin.id, notifMessage]);
        }

        // 5. Add to Project Activities (if it's linked to a project)
        if (projectId) {
            await db.query(`
                INSERT INTO project_activities (project_id, user_id, activity_type, description, created_at)
                VALUES (?, ?, 'reassignment_requested', ?, NOW())
            `, [projectId, userId, `Requested to reassign task "${taskName}" to ${newAssigneeName}. Pending admin approval.`]);
        }

        res.json({ success: true, message: "Reassignment request submitted for admin approval" });

    } catch (error) {
        console.error("Reassignment Error: - reassignment.controller.js:76", error);
        res.status(500).json({ success: false, message: "Error: " + error.message });
    }
};
export const getTeamMembers = async (req, res) => {
    try {
        const { projectId } = req.query;
        let query;
        let params = [];

        // If the task belongs to a project, fetch ONLY that project's team + Admins
        if (projectId) {
            query = `
                SELECT DISTINCT u.id, u.name, u.role 
                FROM users u
                LEFT JOIN project_members pm ON u.id = pm.user_id AND pm.project_id = ?
                WHERE (pm.project_id = ? OR u.role = 'admin') 
                AND u.status = 'active'
                ORDER BY u.role ASC, u.name ASC
            `;
            params = [projectId, projectId];
        } else {
            // If it's an independent task, fallback to all active users (or change this to just Admins if you prefer)
            query = "SELECT id, name, role FROM users WHERE status = 'active' ORDER BY role ASC, name ASC";
        }

        const [users] = await db.query(query, params);
        
        res.json({ success: true, users });
    } catch (error) {
        console.error("Fetch Team Error: - reassignment.controller.js:106", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
