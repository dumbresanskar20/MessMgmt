const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../../database/prisma');

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const developer = await prisma.developer.findUnique({
      where: { email },
    });

    if (!developer) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, developer.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { id: developer.id, email: developer.email, role: 'developer' },
      process.env.JWT_SECRET || 'super_secret_jwt_access_key_change_in_production',
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // Create Audit Log entry
    await prisma.auditLog.create({
      data: {
        user_email: developer.email,
        action: 'LOGIN',
        module: 'AUTH',
        ip_address: req.ip || req.headers['x-forwarded-for'] || null,
        browser: req.headers['user-agent'] || null,
      },
    });

    res.status(200).json({
      success: true,
      token,
      developer: {
        id: developer.id,
        name: developer.name,
        email: developer.email,
      },
    });
  } catch (error) {
    console.error('[Developer Login Error]', error);
    res.status(500).json({ success: false, message: 'Internal server error during developer login.' });
  }
};

const getMe = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      developer: req.developer,
    });
  } catch (error) {
    console.error('[Get Developer Profile Error]', error);
    res.status(500).json({ success: false, message: 'Internal server error fetching developer details.' });
  }
};

module.exports = {
  login,
  getMe,
};
