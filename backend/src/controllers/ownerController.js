const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { z } = require('zod');
const prisma = require('../database/prisma');
const { sendOTP, sendStudentPasswordReset, sendAdminInvitation } = require('../services/otpService');

// Zod validation schemas
const studentCreateSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  roll_no: z.string().min(3, 'Roll number must be at least 3 characters'),
  is_verified: z.boolean().optional().default(false),
});

const studentUpdateSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  email: z.string().email('Invalid email address').optional(),
  roll_no: z.string().min(3, 'Roll number must be at least 3 characters').optional(),
  is_verified: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

const adminCreateSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Invalid email address'),
  role: z.enum(['owner', 'super_admin', 'staff']).default('staff'),
  is_verified: z.boolean().optional().default(false),
});

const adminUpdateSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').optional(),
  email: z.string().email('Invalid email address').optional(),
  role: z.enum(['owner', 'super_admin', 'staff']).optional(),
  is_verified: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

// Helper function to log audit actions
const logOwnerAction = async (ownerId, actionType, targetTable, targetId, changesSummary) => {
  try {
    await prisma.ownerActionLog.create({
      data: {
        owner_id: ownerId,
        action_type: actionType,
        target_table: targetTable,
        target_id: targetId,
        changes_summary: changesSummary,
      },
    });
  } catch (error) {
    console.error('[Owner Audit Log Failure]', error);
  }
};

// ==========================================
// STUDENT CRUD ENDPOINTS
// ==========================================

const listStudents = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const search = req.query.search ? req.query.search.toLowerCase().trim() : '';
    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            { name: { contains: search } },
            { email: { contains: search } },
            { roll_no: { contains: search } },
          ],
        }
      : {};

    const [total, students] = await Promise.all([
      prisma.student.count({ where }),
      prisma.student.findMany({
        where,
        skip,
        take: limit,
        orderBy: { id: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          roll_no: true,
          is_verified: true,
          is_active: true,
          created_at: true,
        },
      }),
    ]);

    return res.status(200).json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      students,
    });
  } catch (error) {
    console.error('List students error:', error);
    return res.status(500).json({ success: false, message: 'Server error listing students.' });
  }
};

const getStudent = async (req, res) => {
  try {
    const studentId = parseInt(req.params.id, 10);
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        name: true,
        email: true,
        roll_no: true,
        is_verified: true,
        is_active: true,
        created_at: true,
      },
    });

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    return res.status(200).json({ success: true, student });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error retrieving student.' });
  }
};

const createStudent = async (req, res) => {
  try {
    const parseResult = studentCreateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parseResult.error.errors.map((e) => e.message),
      });
    }

    const { name, email, roll_no, is_verified } = parseResult.data;
    const cleanEmail = email.toLowerCase().trim();
    const cleanRollNo = roll_no.trim();

    const existingByEmail = await prisma.student.findUnique({ where: { email: cleanEmail } });
    if (existingByEmail) {
      return res.status(400).json({ success: false, message: 'Email address already in use.' });
    }

    const existingByRoll = await prisma.student.findUnique({ where: { roll_no: cleanRollNo } });
    if (existingByRoll) {
      return res.status(400).json({ success: false, message: 'Roll number already in use.' });
    }

    const tempPassword = crypto.randomBytes(8).toString('hex');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(tempPassword, salt);

    const student = await prisma.student.create({
      data: {
        name: name.trim(),
        email: cleanEmail,
        roll_no: cleanRollNo,
        password_hash: hashedPassword,
        is_verified,
        is_active: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        roll_no: true,
        is_verified: true,
        is_active: true,
        created_at: true,
      },
    });

    await logOwnerAction(
      req.owner.id,
      'CREATE',
      'Student',
      student.id,
      `Created student ${student.email}. Temp password generated.`
    );

    return res.status(201).json({
      success: true,
      message: 'Student account created successfully.',
      student,
      temporaryPassword: tempPassword,
    });
  } catch (error) {
    console.error('Create student error:', error);
    return res.status(500).json({ success: false, message: 'Server error creating student.' });
  }
};

const updateStudent = async (req, res) => {
  try {
    const studentId = parseInt(req.params.id, 10);
    const parseResult = studentUpdateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parseResult.error.errors.map((e) => e.message),
      });
    }

    const existing = await prisma.student.findUnique({ where: { id: studentId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    // Direct password hash overwrite attempts should be blocked
    if (req.body.password || req.body.password_hash) {
      return res.status(400).json({
        success: false,
        message: 'Direct password modifications are forbidden on this endpoint. Use the password reset endpoint.',
      });
    }

    const { name, email, roll_no, is_verified, is_active } = parseResult.data;
    const updateData = {};
    const changes = [];

    if (name !== undefined && name !== existing.name) {
      updateData.name = name.trim();
      changes.push(`name: '${existing.name}' -> '${name}'`);
    }

    if (email !== undefined && email.toLowerCase().trim() !== existing.email) {
      const cleanEmail = email.toLowerCase().trim();
      const duplicate = await prisma.student.findUnique({ where: { email: cleanEmail } });
      if (duplicate) return res.status(400).json({ success: false, message: 'Email address already in use.' });
      updateData.email = cleanEmail;
      changes.push(`email: '${existing.email}' -> '${cleanEmail}'`);
    }

    if (roll_no !== undefined && roll_no.trim() !== existing.roll_no) {
      const cleanRoll = roll_no.trim();
      const duplicate = await prisma.student.findUnique({ where: { roll_no: cleanRoll } });
      if (duplicate) return res.status(400).json({ success: false, message: 'Roll number already in use.' });
      updateData.roll_no = cleanRoll;
      changes.push(`roll_no: '${existing.roll_no}' -> '${cleanRoll}'`);
    }

    if (is_verified !== undefined && is_verified !== existing.is_verified) {
      updateData.is_verified = is_verified;
      changes.push(`is_verified: ${existing.is_verified} -> ${is_verified}`);
    }

    if (is_active !== undefined && is_active !== existing.is_active) {
      updateData.is_active = is_active;
      changes.push(`is_active: ${existing.is_active} -> ${is_active}`);
    }

    const updated = await prisma.student.update({
      where: { id: studentId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        roll_no: true,
        is_verified: true,
        is_active: true,
        created_at: true,
      },
    });

    if (changes.length > 0) {
      await logOwnerAction(req.owner.id, 'UPDATE', 'Student', studentId, changes.join(', '));
    }

    return res.status(200).json({
      success: true,
      message: 'Student account updated successfully.',
      student: updated,
    });
  } catch (error) {
    console.error('Update student error:', error);
    return res.status(500).json({ success: false, message: 'Server error updating student.' });
  }
};

const deleteStudent = async (req, res) => {
  try {
    const studentId = parseInt(req.params.id, 10);
    const existing = await prisma.student.findUnique({ where: { id: studentId } });
    if (!existing) return res.status(404).json({ success: false, message: 'Student account not found.' });

    // Soft delete: toggle active status
    const student = await prisma.student.update({
      where: { id: studentId },
      data: { is_active: false },
    });

    await logOwnerAction(req.owner.id, 'SOFT_DELETE', 'Student', studentId, `Soft-deleted student account ${existing.email}.`);

    return res.status(200).json({
      success: true,
      message: `Student account ${existing.email} soft-deleted. Account is now deactivated.`,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to soft delete student.' });
  }
};

const permanentDeleteStudent = async (req, res) => {
  try {
    const studentId = parseInt(req.params.id, 10);
    const existing = await prisma.student.findUnique({ where: { id: studentId } });
    if (!existing) return res.status(404).json({ success: false, message: 'Student account not found.' });

    // 1. Delete associated order items & orders to satisfy FK constraint cascading
    const orders = await prisma.order.findMany({ where: { student_id: studentId } });
    const orderIds = orders.map((o) => o.id);

    if (orderIds.length > 0) {
      await prisma.orderItem.deleteMany({
        where: { order_id: { in: orderIds } },
      });
      await prisma.order.deleteMany({
        where: { student_id: studentId },
      });
    }

    // 2. Hard delete student record
    await prisma.student.delete({ where: { id: studentId } });

    await logOwnerAction(
      req.owner.id,
      'HARD_DELETE',
      'Student',
      studentId,
      `Permanently deleted student account ${existing.email} and all associated orders (GDPR erasure).`
    );

    return res.status(200).json({
      success: true,
      message: `Student account ${existing.email} and all associated order history have been permanently deleted from the database.`,
    });
  } catch (error) {
    console.error('Permanent delete student error:', error);
    return res.status(500).json({ success: false, message: 'Failed to permanently delete student.' });
  }
};

const resetStudentPassword = async (req, res) => {
  try {
    const studentId = parseInt(req.params.id, 10);
    const existing = await prisma.student.findUnique({ where: { id: studentId } });
    if (!existing) return res.status(404).json({ success: false, message: 'Student account not found.' });

    const tempPassword = crypto.randomBytes(8).toString('hex');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(tempPassword, salt);

    await prisma.student.update({
      where: { id: studentId },
      data: {
        password_hash: hashedPassword,
        failed_login_attempts: 0,
        locked_until: null,
      },
    });

    await logOwnerAction(req.owner.id, 'RESET_PASSWORD', 'Student', studentId, `Generated new password for student ${existing.email}.`);

    return res.status(200).json({
      success: true,
      message: `Password reset successfully for ${existing.email}.`,
      temporaryPassword: tempPassword,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to reset student password.' });
  }
};

// ==========================================
// ADMIN USER CRUD ENDPOINTS
// ==========================================

const listAdmins = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const search = req.query.search ? req.query.search.toLowerCase().trim() : '';
    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            { username: { contains: search } },
            { email: { contains: search } },
          ],
        }
      : {};

    const [total, admins] = await Promise.all([
      prisma.adminUser.count({ where }),
      prisma.adminUser.findMany({
        where,
        skip,
        take: limit,
        orderBy: { id: 'desc' },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          is_verified: true,
          is_active: true,
          created_at: true,
          last_login_at: true,
        },
      }),
    ]);

    return res.status(200).json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      admins,
    });
  } catch (error) {
    console.error('List admins error:', error);
    return res.status(500).json({ success: false, message: 'Server error listing admin accounts.' });
  }
};

const getAdmin = async (req, res) => {
  try {
    const adminId = parseInt(req.params.id, 10);
    const admin = await prisma.adminUser.findUnique({
      where: { id: adminId },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        is_verified: true,
        is_active: true,
        created_at: true,
        last_login_at: true,
      },
    });

    if (!admin) return res.status(404).json({ success: false, message: 'Admin account not found.' });

    return res.status(200).json({ success: true, admin });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error retrieving admin account.' });
  }
};

const createAdmin = async (req, res) => {
  try {
    const parseResult = adminCreateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parseResult.error.errors.map((e) => e.message),
      });
    }

    const { username, email, role, is_verified } = parseResult.data;
    const cleanUsername = username.toLowerCase().trim();
    const cleanEmail = email.toLowerCase().trim();

    const existingByEmail = await prisma.adminUser.findUnique({ where: { email: cleanEmail } });
    if (existingByEmail) {
      return res.status(400).json({ success: false, message: 'Email address already in use.' });
    }

    const existingByUsername = await prisma.adminUser.findUnique({ where: { username: cleanUsername } });
    if (existingByUsername) {
      return res.status(400).json({ success: false, message: 'Username already in use.' });
    }

    const tempPassword = crypto.randomBytes(8).toString('hex');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(tempPassword, salt);

    const admin = await prisma.adminUser.create({
      data: {
        username: cleanUsername,
        email: cleanEmail,
        role,
        password_hash: hashedPassword,
        is_verified,
        is_active: true,
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        is_verified: true,
        is_active: true,
        created_at: true,
      },
    });

    await logOwnerAction(
      req.owner.id,
      'CREATE',
      'AdminUser',
      admin.id,
      `Created admin ${admin.username} (Role: ${admin.role}). Temp password generated.`
    );

    return res.status(201).json({
      success: true,
      message: 'Admin account created successfully.',
      admin,
      temporaryPassword: tempPassword,
    });
  } catch (error) {
    console.error('Create admin error:', error);
    return res.status(500).json({ success: false, message: 'Server error creating admin account.' });
  }
};

const updateAdmin = async (req, res) => {
  try {
    const adminId = parseInt(req.params.id, 10);
    const parseResult = adminUpdateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parseResult.error.errors.map((e) => e.message),
      });
    }

    const existing = await prisma.adminUser.findUnique({ where: { id: adminId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Admin account not found.' });
    }

    if (req.body.password || req.body.password_hash) {
      return res.status(400).json({
        success: false,
        message: 'Direct password modifications are forbidden on this endpoint. Use the password reset endpoint.',
      });
    }

    const { username, email, role, is_verified, is_active } = parseResult.data;
    const updateData = {};
    const changes = [];

    if (username !== undefined && username.toLowerCase().trim() !== existing.username) {
      const cleanUsername = username.toLowerCase().trim();
      const duplicate = await prisma.adminUser.findUnique({ where: { username: cleanUsername } });
      if (duplicate) return res.status(400).json({ success: false, message: 'Username already in use.' });
      updateData.username = cleanUsername;
      changes.push(`username: '${existing.username}' -> '${cleanUsername}'`);
    }

    if (email !== undefined && email.toLowerCase().trim() !== existing.email) {
      const cleanEmail = email.toLowerCase().trim();
      const duplicate = await prisma.adminUser.findUnique({ where: { email: cleanEmail } });
      if (duplicate) return res.status(400).json({ success: false, message: 'Email address already in use.' });
      updateData.email = cleanEmail;
      changes.push(`email: '${existing.email}' -> '${cleanEmail}'`);
    }

    if (role !== undefined && role !== existing.role) {
      updateData.role = role;
      changes.push(`role: '${existing.role}' -> '${role}'`);
    }

    if (is_verified !== undefined && is_verified !== existing.is_verified) {
      updateData.is_verified = is_verified;
      changes.push(`is_verified: ${existing.is_verified} -> ${is_verified}`);
    }

    if (is_active !== undefined && is_active !== existing.is_active) {
      // Owners cannot self-deactivate
      if (adminId === req.owner.id && !is_active) {
        return res.status(400).json({ success: false, message: 'You cannot deactivate your own owner account.' });
      }
      updateData.is_active = is_active;
      changes.push(`is_active: ${existing.is_active} -> ${is_active}`);
    }

    const updated = await prisma.adminUser.update({
      where: { id: adminId },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        is_verified: true,
        is_active: true,
        created_at: true,
      },
    });

    if (changes.length > 0) {
      await logOwnerAction(req.owner.id, 'UPDATE', 'AdminUser', adminId, changes.join(', '));
    }

    return res.status(200).json({
      success: true,
      message: 'Admin account updated successfully.',
      admin: updated,
    });
  } catch (error) {
    console.error('Update admin error:', error);
    return res.status(500).json({ success: false, message: 'Server error updating admin account.' });
  }
};

const deleteAdmin = async (req, res) => {
  try {
    const adminId = parseInt(req.params.id, 10);
    const existing = await prisma.adminUser.findUnique({ where: { id: adminId } });
    if (!existing) return res.status(404).json({ success: false, message: 'Admin account not found.' });

    if (adminId === req.owner.id) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own owner account.' });
    }

    // Soft delete: toggle active status
    await prisma.adminUser.update({
      where: { id: adminId },
      data: { is_active: false },
    });

    await logOwnerAction(req.owner.id, 'SOFT_DELETE', 'AdminUser', adminId, `Soft-deleted admin account ${existing.username}.`);

    return res.status(200).json({
      success: true,
      message: `Admin account ${existing.username} soft-deleted. Account is now deactivated.`,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to soft delete admin account.' });
  }
};

const permanentDeleteAdmin = async (req, res) => {
  try {
    const adminId = parseInt(req.params.id, 10);
    const existing = await prisma.adminUser.findUnique({ where: { id: adminId } });
    if (!existing) return res.status(404).json({ success: false, message: 'Admin account not found.' });

    if (adminId === req.owner.id) {
      return res.status(400).json({ success: false, message: 'You cannot permanently delete your own owner account.' });
    }

    // 1. Unlink child accounts created by this admin first to satisfy FK constraints
    await prisma.adminUser.updateMany({
      where: { created_by_id: adminId },
      data: { created_by_id: null },
    });

    // 2. Hard delete AdminUser record
    await prisma.adminUser.delete({ where: { id: adminId } });

    await logOwnerAction(
      req.owner.id,
      'HARD_DELETE',
      'AdminUser',
      adminId,
      `Permanently deleted admin account ${existing.username} from database.`
    );

    return res.status(200).json({
      success: true,
      message: `Admin account ${existing.username} has been permanently deleted from the database.`,
    });
  } catch (error) {
    console.error('Permanent delete admin error:', error);
    return res.status(500).json({ success: false, message: 'Failed to permanently delete admin account.' });
  }
};

const resetAdminPassword = async (req, res) => {
  try {
    const adminId = parseInt(req.params.id, 10);
    const existing = await prisma.adminUser.findUnique({ where: { id: adminId } });
    if (!existing) return res.status(404).json({ success: false, message: 'Admin account not found.' });

    const tempPassword = crypto.randomBytes(8).toString('hex');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(tempPassword, salt);

    await prisma.adminUser.update({
      where: { id: adminId },
      data: {
        password_hash: hashedPassword,
      },
    });

    await logOwnerAction(req.owner.id, 'RESET_PASSWORD', 'AdminUser', adminId, `Generated new password for admin ${existing.username}.`);

    return res.status(200).json({
      success: true,
      message: `Password reset successfully for ${existing.username}.`,
      temporaryPassword: tempPassword,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to reset admin password.' });
  }
};

// ==========================================
// AUDIT LOG VIEWER
// ==========================================

const listAuditLogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 15;
    const skip = (page - 1) * limit;

    const [total, logs] = await Promise.all([
      prisma.ownerActionLog.count(),
      prisma.ownerActionLog.findMany({
        skip,
        take: limit,
        orderBy: { id: 'desc' },
      }),
    ]);

    return res.status(200).json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      logs,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error listing audit logs.' });
  }
};

module.exports = {
  listStudents,
  getStudent,
  createStudent,
  updateStudent,
  deleteStudent,
  permanentDeleteStudent,
  resetStudentPassword,
  listAdmins,
  getAdmin,
  createAdmin,
  updateAdmin,
  deleteAdmin,
  permanentDeleteAdmin,
  resetAdminPassword,
  listAuditLogs,
};
