import express from 'express';
import { getMyProjects, createProject } from '../controllers/project.controller.js';
import { verifyToken, isAdmin } from '../middlewares/auth.middleware.js';
import { updateProjectStatus } from '../controllers/project.controller.js';
import upload from '../middlewares/upload.js';

const router = express.Router();

router.get('/my-projects', verifyToken, getMyProjects);
router.post('/create', verifyToken, isAdmin, createProject);
router.post('/update-status', verifyToken, updateProjectStatus);
router.post('/projects/create', verifyToken, upload.single('file'), createProject);

export default router;
