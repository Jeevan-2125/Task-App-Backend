import express from 'express';
import {
  loginUser,          
  registerUser,       
  forgotPassword,     
  verifyOtpAndReset   
} from '../controllers/auth.controller.js';

const router = express.Router();

router.post('/login', loginUser);
router.post('/register', registerUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', verifyOtpAndReset);

export default router;