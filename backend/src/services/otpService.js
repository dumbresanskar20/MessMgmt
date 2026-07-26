const nodemailer = require('nodemailer');

// Generate 6-digit numerical OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Create transport dynamically or log in dev
const sendEmail = async ({ to, subject, html, text }) => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM } = process.env;

  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    try {
      const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT) || 587,
        secure: Number(SMTP_PORT) === 465,
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS,
        },
      });

      const info = await transporter.sendMail({
        from: EMAIL_FROM || '"Mess Management System" <no-reply@messapp.com>',
        to,
        subject,
        text: text || html.replace(/<[^>]*>?/gm, ''),
        html,
      });

      console.log(`[Email Service] Email sent to ${to}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.warn(`[Email Service] Failed to send email via SMTP (${err.message}). Logging message instead.`);
    }
  }

  // Fallback for local development or missing SMTP credentials
  console.log('\n========================================');
  console.log(`[DEV EMAIL MOCK] To: ${to}`);
  console.log(`[DEV EMAIL MOCK] Subject: ${subject}`);
  console.log(`[DEV EMAIL MOCK] Content:\n${text || html}`);
  console.log('========================================\n');
  return { success: true, mock: true };
};

const sendOTP = async (email, otpCode) => {
  const subject = 'Your Mess Management Verification Code';
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #e65100; margin-bottom: 10px;">🍱 Mess Management Verification</h2>
      <p>Hello,</p>
      <p>Thank you for signing up for the Mess Management System. Use the OTP verification code below to complete your registration:</p>
      <div style="background-color: #fff3e0; padding: 15px; border-radius: 6px; text-align: center; margin: 20px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #d84315;">${otpCode}</span>
      </div>
      <p>This code will expire in <strong>10 minutes</strong>. If you did not request this, please ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="font-size: 12px; color: #777;">Campus Mess Management Team</p>
    </div>
  `;
  return await sendEmail({ to: email, subject, html, text: `Your OTP is ${otpCode}. It expires in 10 minutes.` });
};

const sendAdminInvitation = async (email, username, inviteLink) => {
  const subject = 'Staff Account Invitation - Mess Management System';
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #2e7d32; margin-bottom: 10px;">👨‍🍳 Welcome to Canteen Operations</h2>
      <p>Hello <strong>${username}</strong>,</p>
      <p>An administrator has created a staff account for you on the Mess Management Panel.</p>
      <p>Please click the link below to set up your password and activate your account:</p>
      <div style="text-align: center; margin: 25px 0;">
        <a href="${inviteLink}" style="background-color: #2e7d32; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Set Up Password</a>
      </div>
      <p style="font-size: 13px; color: #666;">Or copy and paste this link in your browser: <br/><a href="${inviteLink}">${inviteLink}</a></p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="font-size: 12px; color: #777;">Campus Canteen Management</p>
    </div>
  `;
  return await sendEmail({ to: email, subject, html });
};

module.exports = {
  generateOTP,
  sendOTP,
  sendAdminInvitation,
};
