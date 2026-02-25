import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

export const sendOTPEmail = async (userEmail, otp) => {
  const url = 'https://api.brevo.com/v3/smtp/email';
  
  const payload = {
    // IMPORTANT: Make sure this email matches your Brevo account email
    sender: { name: "Task App Support", email: process.env.BREVO_SMTP_USER },
    to: [{ email: userEmail }],
    subject: "Your Password Reset OTP Code",
    htmlContent: `<p>Your OTP is <b>${otp}</b>. It is valid for 10 minutes.</p>`
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': process.env.BREVO_API_KEY, // Use the new REST API key here
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Brevo API Error Details:", errorData);
      throw new Error(`Brevo HTTP API failed with status: ${response.status}`);
    }

    console.log("Email sent successfully bypassing Render's firewall!");
    return { success: true };
  } catch (error) {
    console.error("OTP Send Error:", error.message);
    throw error;
  }
};

export default sendOTPEmail;



