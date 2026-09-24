const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// 1. ลงทะเบียนผู้ใช้ใหม่ (ใช้เฉพาะรหัสนักศึกษา/บุคลากร)
exports.register = async (req, res) => {
  try {
    const { 
  identifier_code, 
  full_name, 
  department = 'เทคโนโลยีสารสนเทศ (DIT)', // กำหนดค่าเริ่มต้นไว้ตรงนี้ถ้าหน้าบ้านไม่ส่งมา
  phone, 
  email, 
  password, 
  role = 'student', 
  admin_secret 
} = req.body;
    if (!identifier_code || !password || !full_name) {
      return res.status(400).json({ message: 'กรุณากรอกรหัสประจำตัว ชื่อ-นามสกุล และรหัสผ่าน' });
    }

    // ตรวจสอบเฉพาะรหัสประจำตัวว่าซ้ำหรือไม่ (ปลดล็อกเงื่อนไขอีเมลออก)
    const existingUser = await User.findOne({ identifier_code });
    if (existingUser) {
      return res.status(400).json({ message: 'รหัสนักศึกษา/บุคลากรนี้ถูกลงทะเบียนไว้แล้ว' });
    }

    // ตรวจสอบสิทธิ์สำหรับ Admin / Teacher
    let assignedRole = 'student';
    if (role === 'admin') {
      if (!admin_secret || admin_secret !== process.env.ADMIN_SECRET_KEY) {
        return res.status(403).json({ message: 'รหัสลับ Admin ไม่ถูกต้อง' });
      }
      assignedRole = 'admin';
    } else if (role === 'teacher') {
      if (!admin_secret || admin_secret !== process.env.ADMIN_SECRET_KEY) {
        return res.status(403).json({ message: 'รหัสลับ Teacher ไม่ถูกต้อง' });
      }
      assignedRole = 'teacher';
    }

    // เข้ารหัสผ่าน
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      identifier_code,
      full_name,
      department,
      phone,
      email: email || undefined, // บันทึกเฉพาะเมื่อมีส่งมา
      password_hash,
      role: assignedRole
    });

    res.status(201).json({
      message: `ลงทะเบียนสำเร็จในบทบาท ${assignedRole}`,
      userId: newUser._id
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 2. เข้าสู่ระบบ (ตรวจสอบจากรหัสนักศึกษา/บุคลากรเป็นหลัก)
exports.login = async (req, res) => {
  try {
    const { identifier_code, identifier_code_or_email, password } = req.body;
    const loginIdentifier = identifier_code || identifier_code_or_email;

    if (!loginIdentifier || !password) {
      return res.status(400).json({ message: 'กรุณากรอกรหัสประจำตัวและรหัสผ่าน' });
    }

    // ค้นหาผู้ใช้จาก identifier_code (รองรับ email สำรองสำหรับ seed data)
    const user = await User.findOne({
      $or: [
        { identifier_code: loginIdentifier },
        { email: loginIdentifier }
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
      process.env.JWT_SECRET || 'fallback_secret_key',
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