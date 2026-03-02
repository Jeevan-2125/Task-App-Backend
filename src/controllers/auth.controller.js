import db from '../db/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
// import { sendOTPEmail } from '../services/otp.service.js';
import { sendOTPEmail } from '../services/otp.service.js';
import { getClientIP, getUserAgent } from '../utils/ip.util.js';

/* ---------------- REGISTER ---------------- */
export const registerUser = async (req, res) => {
    try {
        const { name, email, password, gender } = req.body;
        console.log("incoming data - auth.controller.js:12", req.body);
        

        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }

        const [exists] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
        if (exists.length) {
            return res.status(409).json({ success: false, message: 'Email already exists' });
        }

        const hashed = await bcrypt.hash(password, 10);
        
        // ✅ FIXED: Added updated_at, last_seen, and last_activity to prevent the "0000-00-00" crash!
        const [result] = await db.query(
            `INSERT INTO users (
                name, email, password, role, status, gender, 
                created_at, updated_at, last_seen, last_activity
            ) VALUES (
                ?, ?, ?, ?, ?, ?, 
                DATE_ADD(UTC_TIMESTAMP(), INTERVAL 330 MINUTE), 
                DATE_ADD(UTC_TIMESTAMP(), INTERVAL 330 MINUTE), 
                DATE_ADD(UTC_TIMESTAMP(), INTERVAL 330 MINUTE), 
                DATE_ADD(UTC_TIMESTAMP(), INTERVAL 330 MINUTE)
            )`,
            [name, email, hashed, 'user', 'active', gender]
        );

        res.json({ success: true, userId: result.insertId });
    } catch (err) {
        console.error("Register Error: - auth.controller.js:43", err);
        res.status(500).json({ success: false, message: 'Server error during registration' });
    }
};

/* ---------------- LOGIN ---------------- */
export const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        const ip = getClientIP(req);
        const ua = getUserAgent(req);

        // 1. Fetch user from the database
        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (!users.length) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const user = users[0];

        // 2. Verify password (matches your bcrypt setup)
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        // 3. Generate JWT including the role for frontend access
        const token = jwt.sign(
            { id: user.id, name: user.name, role: user.role },
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: '1d' }
        );

        // 4. Record Attendance Log (✅ FIXED: Replaced NOW() with IST Calculator)
        await db.query(
            `INSERT INTO attendance (user_id, login_time, date, ip_address, user_agent) 
             VALUES (?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 330 MINUTE), DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 330 MINUTE)), ?, ?)`,
            [user.id, ip, ua]
        );

        // 5. Update user activity timestamp (✅ FIXED: Replaced NOW() with IST Calculator)
        await db.query(
            'UPDATE users SET last_activity = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 330 MINUTE) WHERE id = ?', 
            [user.id]
        );

        // 6. Return success with user role for redirection
        res.json({
            success: true,
            token,
            user: { 
                id: user.id, 
                name: user.name, 
                role: user.role, 
                gender: user.gender
            }
        });
    } catch (err) {
        console.error("Login Error: - auth.controller.js:101", err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
/* ---------------- FORGOT PASSWORD ---------------- */
export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const [users] = await db.query('SELECT id FROM users WHERE email = ?', [email]);

        if (!users.length) {
            return res.status(404).json({ success: false, message: 'Email not found' });
        }

        const otp = Math.floor(100000 + Math.random() * 900000);
        const expiry = new Date(Date.now() + 10 * 60000); 

        await db.query(
            'UPDATE users SET reset_otp = ?, otp_expiry = ? WHERE email = ?',
            [otp, expiry, email]
        );

        await sendOTPEmail(email, otp); // Match the capitalized import at the top
        res.json({ success: true, message: 'OTP sent successfully' });
    } catch (err) {
        console.error("Forgot Pwd Error: - auth.controller.js:126", err);
        res.status(500).json({ success: false, message: 'Server error during OTP generation' });
    }
};

/* ---------------- RESET PASSWORD ---------------- */
export const verifyOtpAndReset = async (req, res) => {
    try {
        const { email, otp, password } = req.body;

        const [users] = await db.query(
            'SELECT id FROM users WHERE email = ? AND reset_otp = ? AND otp_expiry > NOW()',
            [email, otp]
        );

        if (!users.length) {
            return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
        }

        const hashed = await bcrypt.hash(password, 10);

        await db.query(
            'UPDATE users SET password = ?, reset_otp = NULL, otp_expiry = NULL WHERE email = ?',
            [hashed, email]
        );

        res.json({ success: true, message: 'Password updated successfully' });
    } catch (err) {
        console.error("Reset Pwd Error: - auth.controller.js:154", err);
        res.status(500).json({ success: false, message: 'Server error during password reset' });
    }
};
