const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// 1. ลงทะเบียนผู้ใช้ใหม่ (ใช้เฉพาะรหัสนักศึกษา/บุคลากร)
exports.register = async (req, res) => {
  try {
    const {
      identifier_code,
      full_name,
      department = 'เทคโนโลยีสารสนเทศ (DIT)',
      phone,
      email,
      password,
      role = 'student',
      admin_secret
    } = req.body || {};
    const normalizedIdentifier = typeof identifier_code === 'string' ? identifier_code.trim() : '';
    const normalizedName = typeof full_name === 'string' ? full_name.trim() : '';
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!normalizedIdentifier || !password || !normalizedName) {
      return res.status(400).json({ message: 'กรุณากรอกรหัสประจำตัว ชื่อ-นามสกุล และรหัสผ่าน' });
    }
    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });
    }

    const existingUser = await User.findOne({
      $or: [
        { identifier_code: normalizedIdentifier },
        ...(normalizedEmail ? [{ email: normalizedEmail }] : [])
      ]
    });
    if (existingUser) {
      return res.status(409).json({ message: 'รหัสประจำตัวหรืออีเมลนี้ถูกลงทะเบียนไว้แล้ว' });
    }

    let assignedRole = 'student';
    if (role === 'admin') {
      if (!process.env.ADMIN_SECRET_KEY || admin_secret !== process.env.ADMIN_SECRET_KEY) {
        return res.status(403).json({ message: 'รหัสลับ Admin ไม่ถูกต้อง' });
      }
      assignedRole = 'admin';
    } else if (role === 'teacher') {
      if (!process.env.ADMIN_SECRET_KEY || admin_secret !== process.env.ADMIN_SECRET_KEY) {
        return res.status(403).json({ message: 'รหัสลับ Teacher ไม่ถูกต้อง' });
      }
      assignedRole = 'teacher';
    } else if (role !== 'student') {
      return res.status(400).json({ message: 'บทบาทผู้ใช้งานไม่ถูกต้อง' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      identifier_code: normalizedIdentifier,
      full_name: normalizedName,
      department,
      phone,
      email: normalizedEmail,
      password_hash,
      role: assignedRole
    });

    res.status(201).json({
      message: `ลงทะเบียนสำเร็จในบทบาท ${assignedRole}`,
      userId: newUser._id
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'รหัสประจำตัวนี้ถูกลงทะเบียนไว้แล้ว' });
    }
    res.status(500).json({ error: error.message });
  }
};

// 2. เข้าสู่ระบบ (ตรวจสอบจากรหัสนักศึกษา/บุคลากรเป็นหลัก)
exports.login = async (req, res) => {
  try {
    const { identifier_code, identifier_code_or_email, password } = req.body || {};
    const loginIdentifier = typeof (identifier_code || identifier_code_or_email) === 'string'
      ? (identifier_code || identifier_code_or_email).trim()
      : '';

    if (!loginIdentifier || typeof password !== 'string' || !password) {
      return res.status(400).json({ message: 'กรุณากรอกรหัสประจำตัวและรหัสผ่าน' });
    }
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: 'ระบบยังไม่ได้ตั้งค่า JWT_SECRET' });
    }

    const user = await User.findOne({
      $or: [
        { identifier_code: loginIdentifier },
        { email: loginIdentifier.toLowerCase() }
      ]
    });

    if (!user) {
      return res.status(400).json({ message: 'รหัสประจำตัวหรือรหัสผ่านไม่ถูกต้อง' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: 'รหัสประจำตัวหรือรหัสผ่านไม่ถูกต้อง' });
    }

    const token = jwt.sign(
      { 
        id: user._id, 
        identifier_code: user.identifier_code, 
        role: user.role, 
        department: user.department 
      },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        identifier_code: user.identifier_code,
        full_name: user.full_name,
        role: user.role,
        department: user.department
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};