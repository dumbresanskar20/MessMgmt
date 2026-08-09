const nodemailer = require('nodemailer');

// Generate 6-digit numerical OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Create transport dynamically or log in dev
const sendEmail = async ({ to, subject, html, text }) => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM } = process.env;

  if (SMTP_USER && SMTP_PASS) {
    try {
      const isGmail = !SMTP_HOST || SMTP_HOST.includes('gmail');
      const transportConfig = isGmail
        ? {
            service: 'gmail',
            auth: { user: SMTP_USER, pass: SMTP_PASS },
          }
        : {
            host: SMTP_HOST,
            port: Number(SMTP_PORT) || 587,
            secure: Number(SMTP_PORT) === 465,
            auth: { user: SMTP_USER, pass: SMTP_PASS },
            connectionTimeout: 8000,
            greetingTimeout: 8000,
            socketTimeout: 10000,
          };

      const transporter = nodemailer.createTransport(transportConfig);

      const senderEmail = (EMAIL_FROM && EMAIL_FROM.includes(SMTP_USER))
        ? EMAIL_FROM
        : `"Mess Management System" <${SMTP_USER}>`;

      const info = await transporter.sendMail({
        from: senderEmail,
        to,
        subject,
        text: text || html.replace(/<[^>]*>?/gm, ''),
        html,
      });

      console.log(`[Email Service] Email sent successfully to ${to}: ${info.messageId}`);
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

const sendViaBrevo = async (to, subject, html, text) => {
  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  if (!BREVO_API_KEY) {
    console.warn('[Brevo Service] BREVO_API_KEY is not defined in environment variables! Logging OTP email instead.');
    return null;
  }

  if (BREVO_API_KEY.startsWith('xsmtpsib-')) {
    console.warn('[Brevo Service] WARNING: The BREVO_API_KEY starts with "xsmtpsib-", which indicates it is an SMTP Key (password) instead of a REST API Key. The REST API requires a REST API Key (prefixed with "xkeysib-"). Please generate one in Brevo -> SMTP & API -> API Keys.');
  }

  try {
    let senderEmail = 'dumbresanskar06@gmail.com';
    const envFrom = process.env.EMAIL_FROM;
    if (envFrom) {
      const match = envFrom.match(/<([^>]+)>/);
      if (match && match[1]) {
        senderEmail = match[1].trim();
      } else {
        senderEmail = envFrom.trim();
      }
    }

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'Mess Management System', email: senderEmail },
        to: [{ email: to }],
        subject: subject,
        htmlContent: html,
        textContent: text || html.replace(/<[^>]*>?/gm, ''),
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Failed to send transactional email');
    }

    console.log('[Brevo Service] Email sent successfully via Brevo API:', data);
    return { success: true, messageId: data.messageId };
  } catch (error) {
    console.error('[Brevo Service] Error sending email via Brevo:', error.message);
    throw error;
  }
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

  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  if (BREVO_API_KEY) {
    try {
      const res = await sendViaBrevo(email, subject, html, `Your OTP is ${otpCode}. It expires in 10 minutes.`);
      if (res && res.success) return res;
    } catch (err) {
      console.warn('[Brevo OTP] Failed to send via Brevo REST API, trying standard SMTP fallback...');
    }
  }

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

const sendStudentPasswordReset = async (email, resetLink) => {
  const subject = 'Reset Your Mess Account Password';
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #ea580c; margin-bottom: 10px;">🍱 Password Reset Request</h2>
      <p>Hello,</p>
      <p>We received a request to reset the password for your student mess account.</p>
      <p>Click the button below to set a new password. This link is valid for <strong>15 minutes</strong>:</p>
      <div style="text-align: center; margin: 25px 0;">
        <a href="${resetLink}" style="background-color: #ea580c; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Reset Password</a>
      </div>
      <p style="font-size: 13px; color: #666;">Or copy and paste this link into your browser: <br/><a href="${resetLink}">${resetLink}</a></p>
      <p style="font-size: 12px; color: #888;">If you did not request a password reset, you can safely ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="font-size: 12px; color: #777;">Campus Mess Management Team</p>
    </div>
  `;
  return await sendEmail({ to: email, subject, html });
};

const sendForgotPasswordOTP = async (email, otpCode) => {
  const subject = 'Your Mess Management Password Reset Code';
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #ea580c; margin-bottom: 10px;">🍱 Password Reset OTP</h2>
      <p>Hello,</p>
      <p>We received a request to reset the password for your student mess account.</p>
      <p>Please use the verification OTP code below to reset your password:</p>
      <div style="background-color: #fff3e0; padding: 15px; border-radius: 6px; text-align: center; margin: 20px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #ea580c;">${otpCode}</span>
      </div>
      <p>This code will expire in <strong>10 minutes</strong>. If you did not request this, you can safely ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="font-size: 12px; color: #777;">Campus Mess Management Team</p>
    </div>
  `;

  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  if (BREVO_API_KEY) {
    try {
      const res = await sendViaBrevo(email, subject, html, `Your password reset OTP is ${otpCode}. It expires in 10 minutes.`);
      if (res && res.success) return res;
    } catch (err) {
      console.warn('[Brevo Forgot Password OTP] Failed to send via Brevo REST API, trying standard SMTP fallback...', err.message);
    }
  }

  return await sendEmail({ to: email, subject, html, text: `Your password reset OTP is ${otpCode}. It expires in 10 minutes.` });
};

module.exports = {
  generateOTP,
  sendOTP,
  sendAdminInvitation,
  sendStudentPasswordReset,
  sendForgotPasswordOTP,
};

