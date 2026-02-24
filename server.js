import db from './src/db/db.js'; 
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import authRoutes from "./src/routes/auth.routes.js";
import dashboardRoutes from './src/routes/dashboard.routes.js';
import attendanceRoutes from './src/routes/attendance.routes.js';
import userTabs from './src/routes/user.routes.js';
// import projectRoutes from './src/routes/project.route.js';
import projectRoutes from './src/routes/project.route.js';
import taskRoutes from './src/routes/task.route.js';
import { createServer } from 'http'; 
import { Server } from 'socket.io'; 
import chatRoutes from './src/routes/chat.routes.js';
import leaveRoutes from './src/routes/leave.routes.js';
import adminRoutes from './src/routes/admin.routes.js';
import notificationRoutes from './src/routes/notification.routes.js';
import userRoutes from './src/routes/user.routes.js';




dotenv.config();

const PORT = process.env.PORT || 5000;
const app = express();
const httpServer = createServer(app); 
const io = new Server(httpServer, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

// 1. Basic Health Checks
app.get("/", (req, res) => {
  res.send("API is running 🚀");
});

app.get('/ping', (req, res) => {
  res.json({ ok: true });
});

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes); // Moved up!
app.use('/api/attendance', attendanceRoutes); // ✅ Path prefix must be /api/attendance
app.use('/api/users', userTabs);
// app.use('/api/projects', projectRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/users', userRoutes);
app.use((req, res) => {
  res.status(404).json({ message: `API route not found: ${req.originalUrl}` });
});
// ✅ SOCKET.IO LOGIC
io.on('connection', (socket) => {
    console.log('User connected: - server.js:64', socket.id);

    // Join a specific room (Project or Task ID)
    socket.on('join_room', (roomID) => {
        socket.join(roomID);
        console.log(`User ${socket.id} joined room: ${roomID} - server.js:69`);
    });

// Listen for typing events
    socket.on('typing_status', (data) => {
        // data = { room: "task_10", isTyping: true, userName: "Chirag" }
        socket.to(data.room).emit('display_typing', data);
    });

 socket.on('send_message', async (data) => {
    // 1. Broadcast the message to the room instantly
    io.to(data.room).emit('receive_message', data);

    // 2. Database logic for notifications
    try {
        // Now 'db' will be defined because of the import
        const [members] = await db.query(
            data.task_id 
            ? "SELECT user_id FROM project_tasks JOIN project_members USING(project_id) WHERE task_id = ?" 
            : "SELECT user_id FROM project_members WHERE project_id = ?", 
            [data.task_id || data.project_id]
        );

        console.log(`Message handled for room ${data.room} - server.js:92`);
    } catch (err) {
        console.error("Notification trigger error: - server.js:94", err);
    }
});

// server.js
socket.on('send_message', async (data) => {
    try {
        const { room, project_id, task_id, sender_id, sender_name, message } = data;

        // 1. Permanently store in MySQL
        const [result] = await db.query(
            "INSERT INTO messages (project_id, task_id, sender_id, sender_name, message) VALUES (?, ?, ?, ?, ?)",
            [project_id || null, task_id || null, sender_id, sender_name, message]
        );

        // 2. Broadcast to everyone in the room
        io.to(room).emit('receive_message', {
            id: result.insertId,
            ...data,
            created_at: new Date()
        });

    } catch (err) {
        console.error("Chat persistence error: - server.js:117", err);
    }
});
    socket.on('disconnect', () => {
        console.log('User disconnected - server.js:121');
    });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server & Socket running on http://10.101.74.100:${PORT} - server.js:126`);
});

