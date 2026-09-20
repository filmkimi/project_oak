const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// ลงทะเบียนผู้ใช้ใหม่
exports.register = async (req, res) => {
  try {
    const { 
      identifier_code, 
      full_name, 
      department, 
      phone, 
      email, 
      password, 
      role = 'student', 
      admin_secret 
    } = req.body;

    // ตรวจสอบว่ามีอีเมลหรือรหัสประจำตัวนี้ในระบบแล้วหรือไม่
    const existingUser = await User.findOne({ 
      $or: [{ email }, { identifier_code }] 
    });
    if (existingUser) {
      return res.status(400).json({ message: 'Email or Student/Staff ID already registered' });
    }

    // จุดตรวจสอบสิทธิ์ Admin / อาจารย์
    let assignedRole = 'student';

    if (role === 'admin') {
      // ต้องใส่รหัสลับถูกต้องเท่านั้นถึงจะได้สิทธิ์ admin
      if (!admin_secret || admin_secret !== process.env.ADMIN_SECRET_KEY) {
        return res.status(403).json({ 
          message: 'Access Denied: Invalid or missing Admin Secret Key' 
        });
      }
      assignedRole = 'admin';
    } else if (role === 'teacher') {
      // หากอาจารย์ต้องใช้รหัสเดียวกับ admin หรือกำหนดแยกในอนาคต
      if (!admin_secret || admin_secret !== process.env.ADMIN_SECRET_KEY) {
        return res.status(403).json({ 
          message: 'Access Denied: Invalid Secret Key for Teacher role' 
        });
      }
      assignedRole = 'teacher';
    }

    // เข้ารหัสผ่านก่อนบันทึกลง MongoDB Atlas
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      identifier_code,
      full_name,
      department,
      phone,
      email,
      password_hash,
      role: assignedRole
    });

    res.status(201).json({
      message: `User created successfully as ${assignedRole}`,
      userId: newUser._id
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// เข้าสู่ระบบ (Login)
exports.login = async (req, res) => {
  try {
    const { identifier_code_or_email, password } = req.body;

    // ค้นหาผู้ใช้จาก Email หรือ รหัสนักศึกษา/บุคลากร
    const user = await User.findOne({
      $or: [
        { email: identifier_code_or_email },
        { identifier_code: identifier_code_or_email }
      ]
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // ตรวจสอบรหัสผ่าน
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // ฝัง role ลงใน Token เพื่อใช้ตรวจสอบสิทธิ์ในแต่ละ Endpoint
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