import db from '../db/db.js';
import bcrypt from 'bcryptjs';

// 1. Get Profile
export const getProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const [rows] = await db.query(
            "SELECT id, name, email, phone, address, profile_photo, role FROM users WHERE id = ?", 
            [userId]
        );
        if (rows.length === 0) return res.status(404).json({ success: false, message: "User not found" });
        
        res.json({ success: true, user: rows[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateProfile = async (req, res) => {
    // 1. Destructure the photo from the body
    const { name, email, phone, address, profile_photo } = req.body;
    const userId = req.user.id;

    try {
        // 2. Perform the update
        const [result] = await db.query(
            "UPDATE users SET name=?, email=?, phone=?, address=?, profile_photo=? WHERE id=?",
            [name, email, phone, address, profile_photo, userId]
        );

        // 3. Log this to your terminal to verify it's working
        console.log("Rows affected: - user.controller.js:33", result.affectedRows);

        // 4. Fetch the updated user data to send back
        const [updatedUser] = await db.query("SELECT * FROM users WHERE id = ?", [userId]);

        return res.json({ 
            success: true, 
            user: updatedUser[0], 
            message: "Profile and photo updated successfully" 
        });
    } catch (err) {
        console.error("Database Update Error: - user.controller.js:44", err.message);
        return res.status(500).json({ success: false, message: "Server database error" });
    }
};


export const changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    try {
        // 1. Get the current hashed password from DB
        const [user] = await db.query("SELECT password FROM users WHERE id = ?", [userId]);
        
        // 2. Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user[0].password);
        if (!isMatch) {
            return res.json({ success: false, message: "Current password incorrect" });
        }

        // 3. Hash the new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // 4. Update in database
        await db.query("UPDATE users SET password = ? WHERE id = ?", [hashedPassword, userId]);

        return res.json({ success: true, message: "Password updated successfully" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Error updating password" });
    }
};

// backend/src/controllers/user.controller.js
export const getUserProfile = async (req, res) => {
    try {
        const userId = req.user.id; // From verifyToken middleware
        const [rows] = await db.query(
            "SELECT id, name, email, phone, address, profile_photo, role FROM users WHERE id = ?", 
            [userId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        res.json({ success: true, user: rows[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};