const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { z } = require('zod');
const prisma = require('../config/prisma');
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
    { id: admin.id, role: admin.role, username: admin.username },
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

    const admin = await prisma.adminUser.findFirst({
      where: {
        OR: [{ email: searchParam }, { username: searchParam }],
      },
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
    const updatedAdmin = await prisma.adminUser.update({
      where: { id: admin.id },
      data: { last_login_at: new Date() },
    });

    const token = generateAdminToken(updatedAdmin);

    return res.status(200).json({
      success: true,
      message: 'Admin login successful!',
      token,
      admin: {
        id: updatedAdmin.id,
        _id: updatedAdmin.id,
        username: updatedAdmin.username,
        email: updatedAdmin.email,
        role: updatedAdmin.role,
        last_login_at: updatedAdmin.last_login_at,
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
    const cleanUsername = username.trim();

    const existingByEmail = await prisma.adminUser.findUnique({ where: { email: cleanEmail } });
    const existingByUsername = await prisma.adminUser.findUnique({ where: { username: cleanUsername } });

    if (existingByEmail || existingByUsername) {
      return res.status(400).json({ success: false, message: 'An admin user with this username or email already exists.' });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const dummyPasswordHash = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);

    const newAdmin = await prisma.adminUser.create({
      data: {
        username: cleanUsername,
        email: cleanEmail,
        password_hash: dummyPasswordHash,
        role,
        is_active: true,
        is_verified: false,
        verification_token: verificationToken,
        created_by_id: req.admin.id,
      },
    });

    const adminAppUrl = (process.env.FRONTEND_ADMIN_URL || 'http://localhost:5174').replace(/\/+$/, '');
    const inviteLink = `${adminAppUrl}/set-password?token=${verificationToken}`;

    await sendAdminInvitation(cleanEmail, cleanUsername, inviteLink);

    return res.status(201).json({
      success: true,
      message: `Staff account for ${cleanUsername} created! Invitation link dispatched.`,
      inviteLink,
      account: {
        id: newAdmin.id,
        _id: newAdmin.id,
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

    const admin = await prisma.adminUser.findFirst({ where: { verification_token: token } });
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
    const hashedPassword = await bcrypt.hash(password, salt);
    const now = new Date();

    const updatedAdmin = await prisma.adminUser.update({
      where: { id: admin.id },
      data: {
        password_hash: hashedPassword,
        is_verified: true,
        verification_token: null,
        last_login_at: now,
      },
    });

    let jwtToken;
    try {
      jwtToken = generateAdminToken(updatedAdmin);
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
        id: updatedAdmin.id,
        _id: updatedAdmin.id,
        username: updatedAdmin.username,
        email: updatedAdmin.email,
        role: updatedAdmin.role,
        last_login_at: updatedAdmin.last_login_at,
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
    const accounts = await prisma.adminUser.findMany({
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        is_active: true,
        is_verified: true,
        last_login_at: true,
        created_at: true,
        creator: {
          select: { id: true, username: true, email: true },
        },
      },
    });

    // Reshape to match Mongoose .populate() response shape (created_by nested object)
    const shaped = accounts.map((a) => ({
      ...a,
      _id: a.id,
      created_by: a.creator
        ? { _id: a.creator.id, id: a.creator.id, username: a.creator.username, email: a.creator.email }
        : null,
      creator: undefined,
    }));

    return res.status(200).json({
      success: true,
      accounts: shaped,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to retrieve admin accounts.' });
  }
};

// Toggle staff active/inactive status (Super Admin only)
const toggleStaffStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const targetId = parseInt(id, 10);

    const admin = await prisma.adminUser.findUnique({ where: { id: targetId } });

    if (!admin) {
      return res.status(404).json({ success: false, message: 'Account not found.' });
    }

    if (admin.id === req.admin.id) {
      return res.status(400).json({ success: false, message: 'You cannot deactivate your own account.' });
    }

    const updated = await prisma.adminUser.update({
      where: { id: targetId },
      data: { is_active: !admin.is_active },
    });

    return res.status(200).json({
      success: true,
      message: `Account ${updated.username} is now ${updated.is_active ? 'Active' : 'Deactivated'}.`,
      is_active: updated.is_active,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to toggle account status.' });
  }
};

// Delete staff account (Super Admin only - Hard Delete from Database)
const deleteStaffAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const targetId = parseInt(id, 10);

    const targetAccount = await prisma.adminUser.findUnique({ where: { id: targetId } });

    if (!targetAccount) {
      return res.status(404).json({ success: false, message: 'Staff account not found.' });
    }

    if (targetAccount.id === req.admin.id) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own super admin account.' });
    }

    if (targetAccount.role === 'super_admin') {
      return res.status(400).json({ success: false, message: 'Super Admin accounts cannot be deleted.' });
    }

    // Unlink child accounts created by this admin before deletion to satisfy FK constraints
    await prisma.adminUser.updateMany({
      where: { created_by_id: targetId },
      data: { created_by_id: null },
    });

    // Hard Delete: permanently remove record from database
    await prisma.adminUser.delete({
      where: { id: targetId },
    });

    return res.status(200).json({
      success: true,
      message: `Staff account ${targetAccount.username} permanently deleted from database.`,
      account_id: targetId,
    });
  } catch (error) {
    console.error('Delete staff account error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete staff account from database.' });
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
  deleteStaffAccount,
  getAdminProfile,
};
