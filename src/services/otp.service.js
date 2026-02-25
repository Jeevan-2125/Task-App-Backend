import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Reusable transporter (defined outside the function for better performance)
const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false, 
  auth: {
    user: process.env.BREVO_SMTP_USER,
    pass: process.env.BREVO_SMTP_PASS,
  },
});

export const sendOTPEmail = async (userEmail, otp) => {
  const mailOptions = {
    // Make sure this email matches your Brevo account email exactly
    from: `"Task App Support" <${process.env.BREVO_SMTP_USER}>`, 
    to: userEmail,
    subject: 'Your Password Reset OTP Code',
    text: `Your OTP is ${otp}. It is valid for 10 minutes.`,
    // Optional: Add some basic HTML to make it look nicer
    html: `<p>Your OTP is <b>${otp}</b>.</p><p>It is valid for 10 minutes. Do not share this code with anyone.</p>`
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully! Message ID:", info.messageId);
    return { success: true };
  } catch (error) {
    console.error("Brevo Email Error:", error.message);
    throw error;
  }
};

export default sendOTPEmail;


