const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { z } = require('zod');
const AdminUser = require('../models/AdminUser');
const { sendAdminInvitation } = require('../services/otpService');

const loginSchema = z.object({
  usernameOrEmail: z.string().min(1, 'Username or email is required'),
  password: z.string().min(1, 'Password is required'),
});

const createStaffSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Invalid email address'),
  role: z.enum(['super_admin', 'staff']).default('staff'),
});

const setPasswordSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const generateAdminToken = (admin) => {
  return jwt.sign(
    { id: admin._id, role: admin.role, username: admin.username },
    process.env.JWT_SECRET || 'super_secret_jwt_access_key_change_in_production',
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
};

// Admin Login
const loginAdmin = async (req, res) => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parseResult.error.errors.map((e) => e.message),
      });
    }

    const { usernameOrEmail, password } = parseResult.data;
    const searchParam = usernameOrEmail.toLowerCase().trim();

    const admin = await AdminUser.findOne({
      $or: [{ email: searchParam }, { username: searchParam }],
    });

    if (!admin) {
      return res.status(401).json({ success: false, message: 'Invalid admin credentials.' });
    }

    if (!admin.is_active) {
      return res.status(403).json({ success: false, message: 'Your account has been deactivated by Super Admin.' });
    }

    if (!admin.is_verified) {
      return res.status(403).json({ success: false, message: 'Account password not set yet. Please check your invitation email.' });
    }

    const isMatch = await bcrypt.compare(password, admin.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid admin credentials.' });
    }

    // Audit trail: update last_login_at
    admin.last_login_at = new Date();
    await admin.save();

    const token = generateAdminToken(admin);

    return res.status(200).json({
      success: true,
      message: 'Admin login successful!',
      token,
      admin: {
        id: admin._id,
        username: admin.username,
        email: admin.email,
        role: admin.role,
        last_login_at: admin.last_login_at,
      },
    });
  } catch (error) {
    console.error('Admin login error:', error);
    return res.status(500).json({ success: false, message: 'Server error during admin login.' });
  }
};

// Create new Staff account (Super Admin only)
const createStaffAccount = async (req, res) => {
  try {
    const parseResult = createStaffSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parseResult.error.errors.map((e) => e.message),
      });
    }

    const { username, email, role } = parseResult.data;
    const cleanEmail = email.toLowerCase().trim();

    const existingAdmin = await AdminUser.findOne({
      $or: [{ email: cleanEmail }, { username: username.trim() }],
    });

    if (existingAdmin) {
      return res.status(400).json({ success: false, message: 'An admin user with this username or email already exists.' });
    }

    // Generate token for invitation link
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const dummyPasswordHash = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);

    const newAdmin = new AdminUser({
      username: username.trim(),
      email: cleanEmail,
      password_hash: dummyPasswordHash,
      role,
      is_active: true,
      is_verified: false,
      verification_token: verificationToken,
      created_by: req.admin._id, // Audit trail
    });

    await newAdmin.save();

    const adminAppUrl = process.env.FRONTEND_ADMIN_URL || 'http://localhost:5174';
    const inviteLink = `${adminAppUrl}/set-password?token=${verificationToken}`;

    await sendAdminInvitation(cleanEmail, username, inviteLink);

    return res.status(201).json({
      success: true,
      message: `Staff account for ${username} created! Invitation link dispatched.`,
      inviteLink, // Returned for dev convenience
      account: {
        id: newAdmin._id,
        username: newAdmin.username,
        email: newAdmin.email,
        role: newAdmin.role,
        created_by: req.admin.username,
      },
    });
  } catch (error) {
    console.error('Create staff error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create staff account.' });
  }
};

// Forced Password Set via Token Link
const setStaffPassword = async (req, res) => {
  try {
    const parseResult = setPasswordSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: parseResult.error.errors.map((e) => e.message).join(', '),
        errors: parseResult.error.errors.map((e) => e.message),
      });
    }

    const { token, password } = parseResult.data;

    const admin = await AdminUser.findOne({ verification_token: token });
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'This link has expired or was already used — please ask your admin to resend an invite.',
      });
    }

    if (!admin.is_active) {
      return res.status(403).json({
        success: false,
        message: 'This staff account has been deactivated. Please contact your Super Admin.',
      });
    }

    const salt = await bcrypt.genSalt(10);
    admin.password_hash = await bcrypt.hash(password, salt);
    admin.is_verified = true;
    admin.verification_token = null;
    admin.last_login_at = new Date();
    await admin.save();

    let jwtToken;
    try {
      jwtToken = generateAdminToken(admin);
    } catch (tokenErr) {
      console.error('Token generation error after password reset:', tokenErr);
      return res.status(200).json({
        success: true,
        requires_login: true,
        message: 'Password set successfully — please sign in.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Password set successfully! Redirecting to Admin Panel...',
      token: jwtToken,
      admin: {
        id: admin._id,
        username: admin.username,
        email: admin.email,
        role: admin.role,
        last_login_at: admin.last_login_at,
      },
    });
  } catch (error) {
    console.error('Set staff password error:', error);
    return res.status(500).json({ success: false, message: 'Failed to set password.' });
  }
};

// List all admin staff accounts (Super Admin only)
const listAdminAccounts = async (req, res) => {
  try {
    const accounts = await AdminUser.find()
      .populate('created_by', 'username email')
      .select('-password_hash -verification_token')
      .sort({ created_at: -1 });

    return res.status(200).json({
      success: true,
      accounts,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to retrieve admin accounts.' });
  }
};

// Toggle staff active/inactive status (Super Admin only)
const toggleStaffStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const admin = await AdminUser.findById(id);

    if (!admin) {
      return res.status(404).json({ success: false, message: 'Account not found.' });
    }

    if (admin._id.toString() === req.admin._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot deactivate your own account.' });
    }

    admin.is_active = !admin.is_active;
    await admin.save();

    return res.status(200).json({
      success: true,
      message: `Account ${admin.username} is now ${admin.is_active ? 'Active' : 'Deactivated'}.`,
      is_active: admin.is_active,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to toggle account status.' });
  }
};

// Get current admin profile
const getAdminProfile = async (req, res) => {
  return res.status(200).json({
    success: true,
    admin: req.admin,
  });
};

module.exports = {
  loginAdmin,
  createStaffAccount,
  setStaffPassword,
  listAdminAccounts,
  toggleStaffStatus,
  getAdminProfile,
};
