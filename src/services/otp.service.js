import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// 1. Named Export
export const sendOTPEmail = async (userEmail, otp) => {
  // Move transporter inside the function to ensure process.env is ready
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    // Optional: This can help bypass some strict network proxy issues
    tls: {
      rejectUnauthorized: false 
    }
  });

  const mailOptions = {
    from: `"Task App Support" <${process.env.EMAIL_USER}>`,
    to: userEmail,
    subject: 'Your OTP Code',
    text: `Your OTP is ${otp}`,
  };



  try {
    // Add this temporary line to see what keys exist
    console.log("All Env Keys: - otp.service.js:34", Object.keys(process.env).filter(k => k.includes('EMAIL')));
    
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error("Debug Credentials > User: - otp.service.js:39", process.env.EMAIL_USER ? "Present" : "Missing", "| Pass:", process.env.EMAIL_PASS ? "Present" : "Missing");
    throw error;
  }
};

// 2. Default Export
export default sendOTPEmail;
