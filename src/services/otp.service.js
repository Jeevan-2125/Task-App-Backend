// import nodemailer from 'nodemailer';

// const transporter = nodemailer.createTransport({
//   service: 'gmail',
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS, // Your 16-digit App Password
//   },
// });

// // Change name to match your controller's import
// // Check the spelling here: sendOTPEmail
// export const sendOTPEmail = async (userEmail, otp) => {
//   const mailOptions = {
//     from: `"Task App Support (No-Reply)" <${process.env.EMAIL_USER}>`,
//     to: userEmail,
//     subject: 'Your OTP Code',
//     text: `Your OTP is ${otp}`,
//   };

//   try {
//     await transporter.sendMail(mailOptions);
//     return { success: true };
//   } catch (error) {
//     console.error("OTP email failed: - otp.service.js:25", error);
//     throw error;
//   }
// };

// import nodemailer from 'nodemailer';
// import dotenv from 'dotenv';
// dotenv.config(); // Ensure env variables are loaded here specifically

// const transporter = nodemailer.createTransport({
//   service: 'gmail',
//   auth: {
//     // Double-check these match your .env file EXACTLY
//     user: process.env.EMAIL_USER, 
//     pass: process.env.EMAIL_PASS, 
//   },
// });

// export const sendOTPEmail = async (userEmail, otp) => {
//   // Add this log to debug:
//   console.log("Using Email: - otp.service.js:45", process.env.EMAIL_USER ? "FOUND" : "NOT FOUND");

//   const mailOptions = {
//     from: `"Task App Support (No-Reply)" <${process.env.EMAIL_USER}>`,
//     to: userEmail,
//     subject: 'Your OTP Code',
//     text: `Your OTP is ${otp}`,
//   };

//   try {
//     await transporter.sendMail(mailOptions);
//     return { success: true };
//   } catch (error) {
//     console.error("OTP email failed: - otp.service.js:58", error);
//     throw error;
//   }
// };


// import nodemailer from 'nodemailer';
// import dotenv from 'dotenv';

// dotenv.config();

// const transporter = nodemailer.createTransport({
//   service: 'gmail',
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS,
//   },
// });

// // 1. Named Export
// export const sendOTPEmail = async (userEmail, otp) => {
//   const mailOptions = {
//     from: `"Task App Support" <${process.env.EMAIL_USER}>`,
//     to: userEmail,
//     subject: 'Your OTP Code',
//     text: `Your OTP is ${otp}`,
//   };

//   try {
//     const info = await transporter.sendMail(mailOptions);
//     console.log("Email sent: - otp.service.js:88" + info.response);
//     return { success: true };
//   } catch (error) {
//     console.error("OTP email failed: - otp.service.js:91", error);
//     throw error;
//   }
// };

// // 2. Default Export (Backup for some build tools)
// export default sendOTPEmail;




import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// 1. Named Export
export const sendOTPEmail = async (userEmail, otp) => {
  // Move transporter inside the function to ensure process.env is ready
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: `"Task App Support" <${process.env.EMAIL_USER}>`,
    to: userEmail,
    subject: 'Your OTP Code',
    text: `Your OTP is ${otp}`,
  };

  // try {
  //   const info = await transporter.sendMail(mailOptions);
  //   console.log("Email sent: - otp.service.js:127" + info.response);
  //   return { success: true };
  // } catch (error) {
  //   // If this log shows "undefined" for user/pass, your .env file isn't being read
  //   console.error("OTP email failed: - otp.service.js:131", error.message);
  //   console.error("Debug Credentials > User: - otp.service.js:132", process.env.EMAIL_USER ? "Present" : "Missing", "| Pass:", process.env.EMAIL_PASS ? "Present" : "Missing");
  //   throw error;
  // }

  try {
    // Add this temporary line to see what keys exist
    console.log("All Env Keys: - otp.service.js:138", Object.keys(process.env).filter(k => k.includes('EMAIL')));
    
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error("Debug Credentials > User: - otp.service.js:143", process.env.EMAIL_USER ? "Present" : "Missing", "| Pass:", process.env.EMAIL_PASS ? "Present" : "Missing");
    throw error;
  }
};

// 2. Default Export
export default sendOTPEmail;