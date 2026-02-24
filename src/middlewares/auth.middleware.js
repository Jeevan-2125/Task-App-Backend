import jwt from 'jsonwebtoken';
import db from '../db/db.js';

// ✅ Named Export 1
export const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ success: false, message: "No token provided" });

    jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret', async (err, decoded) => {
        if (err) return res.status(403).json({ success: false, message: "Invalid or expired token" });
        
        req.user = decoded;

        // Activity Tracker
        try {
            await db.query(
                "UPDATE users SET last_activity = NOW(), status = 'active' WHERE id = ?", 
                [decoded.id]
            );
        } catch (dbErr) {
            console.error("Activity Tracker Error: - auth.middleware.js:23", dbErr);
        }

        next();
    });
};


export const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        return res.status(403).json({ 
            success: false, 
            message: "Access denied. Admin privileges required." 
        });
    }
};