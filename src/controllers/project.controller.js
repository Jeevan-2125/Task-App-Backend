import db from '../db/db.js';

// ✅ Fetch projects assigned to the logged-in employee
export const getMyProjects = async (req, res) => {
    try {
        const userId = req.user.id;

        // Query to get projects where the user is a member
        const [projects] = await db.query(`
            SELECT 
                p.id, 
                p.name, 
                p.description, 
                p.status, 
                DATE_FORMAT(p.start_date, '%Y-%m-%d') as start_date, 
                DATE_FORMAT(p.end_date, '%Y-%m-%d') as end_date
            FROM projects p
            INNER JOIN project_members pm ON p.id = pm.project_id
            WHERE pm.user_id = ?
            ORDER BY p.created_at DESC
        `, [userId]);

        res.json({
            success: true,
            projects: projects
        });
    } catch (error) {
        console.error("Project Fetch Error: - project.controller.js:28", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ✅ Admin Project Creation & Multi-Member Assignment
export const createProject = async (req, res) => {
    const { name, description, status, startDate, endDate, members } = req.body;
    const adminId = req.user.id; // From verifyToken middleware

    try {
        // 1. Insert into main projects table 
        // Note: Using 'name' instead of 'project_name' to match your schema
        const [project] = await db.query(
            'INSERT INTO projects (name, description, status, start_date, end_date, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())',
            [name, description, status || 'active', startDate, endDate, adminId]
        );

        const projectId = project.insertId;

        // 2. Insert multiple members into project_members
        if (members && members.length > 0) {
            // Mapping to: [project_id, user_id, role, added_by, joined_date]
            const memberData = members.map(userId => [
                projectId, 
                userId, 
                'member', 
                adminId, 
                new Date()
            ]);

            // Using the nested array format for bulk insertion
            await db.query(
                'INSERT INTO project_members (project_id, user_id, role, added_by, joined_date) VALUES ?',
                [memberData]
            );

            // 3. Optional: Log activity in project_activities
            await db.query(
                'INSERT INTO project_activities (project_id, user_id, activity_type, description, created_at) VALUES (?, ?, ?, ?, NOW())',
                [projectId, adminId, 'project_created', `Project '${name}' was created`]
            );
        }

        res.json({ 
            success: true, 
            message: 'Project created and team assigned successfully!',
            projectId: projectId 
        });
    } catch (err) {
        console.error("Create Project Error: - project.controller.js:78", err);
        res.status(500).json({ success: false, message: 'Failed to create project: ' + err.message });
    }
};


export const updateProjectStatus = async (req, res) => {
    try {
        const { projectId, status } = req.body;
        const userId = req.user.id; // Get the user making the change

        // 1. Get current status from DB
        const [project] = await db.query("SELECT status FROM projects WHERE id = ?", [projectId]);
        if (!project.length) return res.status(404).json({ success: false, message: "Project not found" });

        const currentStatus = project[0].status;
        
        // Define hierarchy: pending (1) -> in_progress (2) -> completed (3)
        const statusOrder = { 'pending': 1, 'in_progress': 2, 'completed': 3 };

        // 2. Logic: Block backward movement (e.g., In Progress to Pending)
        if (statusOrder[status] <= statusOrder[currentStatus]) {
            return res.status(400).json({ 
                success: false, 
                message: "You cannot move a project back to a previous stage." 
            });
        }

        // 3. Perform update
        await db.query(
            "UPDATE projects SET status = ?, updated_at = NOW() WHERE id = ?", 
            [status, projectId]
        );

        // 4. Log the activity (This ensures the Admin sees the history)
        await db.query(
            "INSERT INTO project_activities (project_id, user_id, activity_type, description, created_at) VALUES (?, ?, 'status_change', ?, NOW())",
            [projectId, userId, `Project status moved from ${currentStatus} to ${status}.`]
        );
        
        res.json({ success: true, message: `Project is now ${status.replace('_', ' ')}` });
    } catch (error) {
        console.error("Update Status Error: - project.controller.js:120", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};


// Example in your projects controller
export const getEmployeeProjects = async (req, res) => {
    try {
        const userId = req.user.id; // Get ID from the login token
        
        const query = `
            SELECT p.* FROM projects p 
            JOIN project_members pm ON p.id = pm.project_id 
            WHERE pm.user_id = ?
        `;

        // The second argument [userId] fills the '?' placeholder safely
        const [projects] = await db.query(query, [userId]);

        res.status(200).json({ success: true, projects });
    } catch (error) {
        res.status(500).json({ success: false, message: "Database error" });
    }
};

// export const updateProjectStatus = async (req, res) => {
//     try {
//         const { projectId, status } = req.body;
//         // Verify user is assigned to this project or is admin
//         await db.query(
//             'UPDATE projects SET status = ? WHERE id = ?',
//             [status, projectId]
//         );
//         res.json({ success: true, message: 'Status updated' });
//     } catch (err) {
//         res.status(500).json({ success: false, message: 'Database error' });
//     }
// };
