const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { z } = require('zod');
const prisma = require('../config/prisma');
const { generateOTP, sendOTP, sendStudentPasswordReset } = require('../services/otpService');

// Zod schemas for input validation
const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  roll_no: z.string().min(3, 'Roll number must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const verifyOtpSchema = z.object({
  email: z.string().email('Invalid email address'),
  otp_code: z.string().length(6, 'OTP must be 6 digits'),
});

const generateTokens = (student) => {
  const accessToken = jwt.sign(
    { id: student.id, role: 'student', email: student.email },
    process.env.JWT_SECRET || 'super_secret_jwt_access_key_change_in_production',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  const refreshToken = jwt.sign(
    { id: student.id, role: 'student' },
    process.env.JWT_REFRESH_SECRET || 'super_secret_jwt_refresh_key_change_in_production',
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
  );

  return { accessToken, refreshToken };
};

// Signup controller
const registerStudent = async (req, res) => {
  try {
    const parseResult = signupSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parseResult.error.errors.map((e) => e.message),
      });
    }

    const { name, email, roll_no, password } = parseResult.data;
    const cleanEmail = email.toLowerCase().trim();
    const cleanRollNo = roll_no.trim();

    // Check if a verified student already exists with either email or roll_no
    const existingByEmail = await prisma.student.findUnique({ where: { email: cleanEmail } });
    const existingByRollNo = await prisma.student.findUnique({ where: { roll_no: cleanRollNo } });

    if (existingByEmail?.is_verified) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email address already exists.',
      });
    }

    if (existingByRollNo?.is_verified) {
      return res.status(400).json({
        success: false,
        message: 'An account with this roll number already exists.',
      });
    }

    // If both exist as separate unverified records, delete the roll_no one to clean up conflicts
    if (existingByEmail && existingByRollNo && existingByEmail.id !== existingByRollNo.id) {
      await prisma.student.delete({ where: { id: existingByRollNo.id } });
    }

    const unverifiedTarget = existingByEmail || existingByRollNo;

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const otpCode = generateOTP();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    if (unverifiedTarget) {
      await prisma.student.update({
        where: { id: unverifiedTarget.id },
        data: {
          name: name.trim(),
          email: cleanEmail,
          roll_no: cleanRollNo,
          password_hash: hashedPassword,
          otp_code: otpCode,
          otp_expires_at: otpExpiresAt,
        },
      });
    } else {
      await prisma.student.create({
        data: {
          name: name.trim(),
          email: cleanEmail,
          roll_no: cleanRollNo,
          password_hash: hashedPassword,
          is_verified: false,
          otp_code: otpCode,
          otp_expires_at: otpExpiresAt,
        },
      });
    }

    // Dispatch OTP email asynchronously so HTTP response is instant
    sendOTP(cleanEmail, otpCode).catch((err) =>
      console.warn('[RegisterStudent] Background OTP send warning:', err.message)
    );

    return res.status(201).json({
      success: true,
      message: 'Account created! Please check your email for the verification code.',
      email: cleanEmail,
      requires_otp: true,
    });
  } catch (error) {
    console.error('Student registration error:', error);
    return res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
};

// OTP verification controller
const verifyOTP = async (req, res) => {
  try {
    const parseResult = verifyOtpSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parseResult.error.errors.map((e) => e.message),
      });
    }

    const { email, otp_code } = parseResult.data;
    const cleanEmail = email.toLowerCase().trim();

    let student = await prisma.student.findUnique({ where: { email: cleanEmail } });

    // Fallback: If not found by email, check if an unverified account matches this exact active OTP code
    if (!student && otp_code) {
      student = await prisma.student.findFirst({
        where: {
          otp_code: otp_code.trim(),
          is_verified: false,
          otp_expires_at: { gt: new Date() },
        },
      });
    }

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student account not found or verification code is invalid.' });
    }

    if (student.is_verified) {
      const { accessToken, refreshToken } = generateTokens(student);
      return res.status(200).json({
        success: true,
        message: 'Account already verified.',
        accessToken,
        refreshToken,
        student: {
          id: student.id,
          _id: student.id,
          name: student.name,
          email: student.email,
          roll_no: student.roll_no,
        },
      });
    }

    if (!student.otp_code || student.otp_code !== otp_code.trim()) {
      return res.status(400).json({ success: false, message: 'Invalid verification code.' });
    }

    if (student.otp_expires_at && student.otp_expires_at < new Date()) {
      return res.status(400).json({ success: false, message: 'Verification code has expired. Request a new one.' });
    }

    const updatedStudent = await prisma.student.update({
      where: { id: student.id },
      data: {
        is_verified: true,
        otp_code: null,
        otp_expires_at: null,
      },
    });

    const { accessToken, refreshToken } = generateTokens(updatedStudent);

    return res.status(200).json({
      success: true,
      message: 'Account verified successfully!',
      accessToken,
      refreshToken,
      student: {
        id: updatedStudent.id,
        _id: updatedStudent.id,
        name: updatedStudent.name,
        email: updatedStudent.email,
        roll_no: updatedStudent.roll_no,
      },
    });
  } catch (error) {
    console.error('OTP Verification error:', error);
    return res.status(500).json({ success: false, message: 'Server error during OTP verification.' });
  }
};

// Resend OTP controller
const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const cleanEmail = email.toLowerCase().trim();
    const student = await prisma.student.findUnique({ where: { email: cleanEmail } });

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student account not found.' });
    }

    if (student.is_verified) {
      return res.status(400).json({ success: false, message: 'Account is already verified. Please login.' });
    }

    const otpCode = generateOTP();
    await prisma.student.update({
      where: { id: student.id },
      data: {
        otp_code: otpCode,
        otp_expires_at: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    sendOTP(cleanEmail, otpCode).catch((err) =>
      console.warn('[ResendOTP] Background OTP send warning:', err.message)
    );

    return res.status(200).json({
      success: true,
      message: 'A new verification code has been sent to your email.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to resend verification code.' });
  }
};

// Student login controller with account lock after failed attempts
const loginStudent = async (req, res) => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parseResult.error.errors.map((e) => e.message),
      });
    }

    const { email, password } = parseResult.data;
    const cleanEmail = email.toLowerCase().trim();

    const student = await prisma.student.findUnique({ where: { email: cleanEmail } });
    if (!student) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    // Check account lockout status
    if (student.locked_until && student.locked_until > new Date()) {
      const minutesRemaining = Math.ceil((student.locked_until - new Date()) / (60 * 1000));
      return res.status(423).json({
        success: false,
        message: `Account is temporarily locked due to repeated failed login attempts. Try again in ${minutesRemaining} minutes.`,
      });
    }

    const isMatch = await bcrypt.compare(password, student.password_hash);
    if (!isMatch) {
      const newAttempts = student.failed_login_attempts + 1;
      const updateData = { failed_login_attempts: newAttempts };
      if (newAttempts >= 5) {
        updateData.locked_until = new Date(Date.now() + 15 * 60 * 1000);
      }
      await prisma.student.update({ where: { id: student.id }, data: updateData });

      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.',
        attempts_left: Math.max(0, 5 - newAttempts),
      });
    }

    if (!student.is_verified) {
      const otpCode = generateOTP();
      await prisma.student.update({
        where: { id: student.id },
        data: {
          otp_code: otpCode,
          otp_expires_at: new Date(Date.now() + 10 * 60 * 1000),
        },
      });
      sendOTP(cleanEmail, otpCode).catch((err) =>
        console.warn('[LoginStudent] Background OTP send warning:', err.message)
      );

      return res.status(403).json({
        success: false,
        message: 'Account is not verified. A verification code has been sent to your email.',
        requires_otp: true,
        email: cleanEmail,
      });
    }

    // Reset failed login counter on success
    await prisma.student.update({
      where: { id: student.id },
      data: { failed_login_attempts: 0, locked_until: null },
    });

    const { accessToken, refreshToken } = generateTokens(student);

    return res.status(200).json({
      success: true,
      message: 'Login successful!',
      accessToken,
      refreshToken,
      student: {
        id: student.id,
        _id: student.id,
        name: student.name,
        email: student.email,
        roll_no: student.roll_no,
      },
    });
  } catch (error) {
    console.error('Student login error:', error);
    return res.status(500).json({ success: false, message: 'Server error during login.' });
  }
};

// Get profile
const getStudentProfile = async (req, res) => {
  return res.status(200).json({
    success: true,
    student: req.user,
  });
};

// Forgot Password Controller
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email address is required.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const student = await prisma.student.findFirst({
      where: { email: cleanEmail, is_verified: true },
    });

    if (student) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetExpires = new Date(Date.now() + 15 * 60 * 1000);

      await prisma.student.update({
        where: { id: student.id },
        data: { reset_token: resetToken, reset_token_expires: resetExpires },
      });

      const studentAppUrl = (process.env.FRONTEND_STUDENT_URL || 'https://mess-mgmt.vercel.app').replace(/\/+$/, '');
      const resetLink = `${studentAppUrl}/?reset_token=${resetToken}`;
      await sendStudentPasswordReset(cleanEmail, resetLink);
    }

    // Always respond generically to prevent email enumeration
    return res.status(200).json({
      success: true,
      message: 'If an account exists with this email, a reset link has been sent.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ success: false, message: 'Server error processing password reset request.' });
  }
};

// Reset Password Controller
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid or missing password reset token.' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
    }

    const student = await prisma.student.findFirst({
      where: {
        reset_token: token.trim(),
        reset_token_expires: { gt: new Date() },
      },
    });

    if (!student) {
      return res.status(400).json({
        success: false,
        message: 'This reset link has expired or is invalid — please request a new one.',
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await prisma.student.update({
      where: { id: student.id },
      data: {
        password_hash: hashedPassword,
        reset_token: null,
        reset_token_expires: null,
        failed_login_attempts: 0,
        locked_until: null,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully — please sign in with your new password.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ success: false, message: 'Server error resetting password.' });
  }
};

module.exports = {
  registerStudent,
  verifyOTP,
  resendOTP,
  loginStudent,
  getStudentProfile,
  forgotPassword,
  resetPassword,
};
