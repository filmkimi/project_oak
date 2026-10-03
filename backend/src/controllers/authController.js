const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const passwordResetResponse = {
  message: 'หากข้อมูลตรงกับบัญชีที่ลงทะเบียนไว้ ระบบจะส่ง OTP ไปยังอีเมลของคุณ'
};

function hashResetOtp(otp) {
  return crypto
    .createHmac('sha256', process.env.JWT_SECRET || 'fallback_secret_key')
    .update(otp)
    .digest('hex');
}

function isValidOtp(otp, hashedOtp) {
  const actualHash = Buffer.from(hashResetOtp(otp), 'hex');
  const expectedHash = Buffer.from(hashedOtp, 'hex');
  return actualHash.length === expectedHash.length &&
    crypto.timingSafeEqual(actualHash, expectedHash);
}

function getMailerConfig() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !(SMTP_FROM || SMTP_USER)) {
    return null;
  }

  const isGmail = SMTP_HOST.trim().toLowerCase() === 'smtp.gmail.com';
  const password = isGmail ? SMTP_PASS.replace(/\s/g, '') : SMTP_PASS;

  return {
    from: (SMTP_FROM || SMTP_USER).trim(),
    transporter: nodemailer.createTransport({
      host: SMTP_HOST.trim(),
      port: Number(SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: SMTP_USER.trim(), pass: password }
    })
  };
}

function getSmtpErrorMessage(error) {
  const responseCode = Number(error.responseCode);
  if (error.code === 'EAUTH' || responseCode === 535 || /5\.7\.[0-9]+/.test(error.response || '')) {
    return process.env.SMTP_HOST?.trim().toLowerCase() === 'smtp.gmail.com'
      ? 'Gmail ปฏิเสธการเข้าสู่ระบบ SMTP กรุณาตรวจสอบ SMTP_USER และใช้ Google App Password 16 ตัวอักษรใน SMTP_PASS (ไม่ใช่รหัสผ่านบัญชี)'
      : 'เซิร์ฟเวอร์อีเมลปฏิเสธการเข้าสู่ระบบ SMTP กรุณาตรวจสอบ SMTP_USER และ SMTP_PASS';
  }

  if (error.code === 'ETIMEDOUT' || error.code === 'ECONNECTION' || error.code === 'ESOCKET') {
    return 'เชื่อมต่อเซิร์ฟเวอร์อีเมลไม่ได้ กรุณาตรวจสอบ SMTP_HOST, SMTP_PORT, SMTP_SECURE และการเชื่อมต่อเครือข่าย';
  }

  if (error.code === 'EENVELOPE' || responseCode >= 550) {
    return 'เซิร์ฟเวอร์อีเมลปฏิเสธผู้ส่งหรือผู้รับ กรุณาตรวจสอบ SMTP_FROM และอีเมลผู้ใช้';
  }

  return 'ส่งอีเมล OTP ไม่สำเร็จ กรุณาตรวจสอบการตั้งค่า SMTP ใน backend/.env';
}

exports.requestPasswordResetOtp = async (req, res) => {
  try {
    const { identifier_code, email } = req.body;
    if (!identifier_code || !email) {
      return res.status(400).json({ message: 'กรุณากรอกรหัสประจำตัวและอีเมลที่ลงทะเบียนไว้' });
    }

    const mailer = getMailerConfig();
    if (!mailer) {
      return res.status(503).json({ message: 'ระบบส่งอีเมลยังไม่ได้ตั้งค่า กรุณาติดต่อผู้ดูแลระบบ' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({
      identifier_code: identifier_code.trim(),
      email: new RegExp(`^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
    });
    if (!user) {
      return res.json(passwordResetResponse);
    }

    const now = Date.now();
    const resendDelayMs = 60 * 1000;
    if (user.password_reset_last_sent_at &&
      now - user.password_reset_last_sent_at.getTime() < resendDelayMs) {
      return res.json(passwordResetResponse);
    }

    const otp = crypto.randomInt(0, 1000000).toString().padStart(6, '0');
    user.password_reset_otp_hash = hashResetOtp(otp);
    user.password_reset_expires_at = new Date(now + 10 * 60 * 1000);
    user.password_reset_last_sent_at = new Date(now);
    user.password_reset_attempts = 0;
    await user.save();

    try {
      await mailer.transporter.sendMail({
        from: mailer.from,
        to: user.email,
        subject: 'รหัส OTP สำหรับรีเซ็ตรหัสผ่าน',
        text: `รหัส OTP ของคุณคือ ${otp} รหัสนี้ใช้ได้ภายใน 10 นาที หากคุณไม่ได้ร้องขอ สามารถละเว้นอีเมลนี้ได้`,
        html: `<p>รหัส OTP สำหรับรีเซ็ตรหัสผ่านของคุณคือ</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${otp}</p><p>รหัสนี้ใช้ได้ภายใน 10 นาที หากคุณไม่ได้ร้องขอ สามารถละเว้นอีเมลนี้ได้</p>`
      });
    } catch (error) {
      user.password_reset_otp_hash = null;
      user.password_reset_expires_at = null;
      user.password_reset_last_sent_at = null;
      user.password_reset_attempts = 0;
      await user.save();
      throw error;
    }

    return res.json(passwordResetResponse);
  } catch (error) {
    console.error('Password reset OTP email error:', {
      code: error.code,
      responseCode: error.responseCode,
      command: error.command
    });
    return res.status(502).json({ message: getSmtpErrorMessage(error) });
  }
};

exports.resetPasswordWithOtp = async (req, res) => {
  try {
    const { identifier_code, email, otp, new_password } = req.body;
    if (!identifier_code || !email || !otp || !new_password) {
      return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
    }
    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({ message: 'OTP ไม่ถูกต้องหรือหมดอายุแล้ว' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ message: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({
      identifier_code: identifier_code.trim(),
      email: new RegExp(`^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
    });
    const invalidOtpResponse = { message: 'OTP ไม่ถูกต้องหรือหมดอายุแล้ว' };
    if (!user || !user.password_reset_otp_hash ||
      !user.password_reset_expires_at ||
      user.password_reset_expires_at.getTime() <= Date.now() ||
      user.password_reset_attempts >= 5) {
      return res.status(400).json(invalidOtpResponse);
    }

    if (!isValidOtp(otp, user.password_reset_otp_hash)) {
      user.password_reset_attempts += 1;
      if (user.password_reset_attempts >= 5) {
        user.password_reset_otp_hash = null;
        user.password_reset_expires_at = null;
      }
      await user.save();
      return res.status(400).json(invalidOtpResponse);
    }

    user.password_hash = await bcrypt.hash(new_password, 10);
    user.password_reset_otp_hash = null;
    user.password_reset_expires_at = null;
    user.password_reset_attempts = 0;
    await user.save();

    return res.json({ message: 'รีเซ็ตรหัสผ่านสำเร็จ สามารถเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้เลย' });
  } catch (error) {
    console.error('Password reset error:', error.message);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการรีเซ็ตรหัสผ่าน' });
  }
};

// 1. ลงทะเบียนผู้ใช้ใหม่ (ใช้เฉพาะรหัสนักศึกษา/บุคลากร)
exports.register = async (req, res) => {
  try {
    const {
      identifier_code,
      full_name,
      department = 'เทคโนโลยีสารสนเทศ (DIT)',
      phone,
      email,
      password
    } = req.body;
    if (!identifier_code || !password || !full_name || !email) {
      return res.status(400).json({ message: 'กรุณากรอกรหัสประจำตัว ชื่อ-นามสกุล อีเมล และรหัสผ่าน' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'รูปแบบอีเมลไม่ถูกต้อง' });
    }

    // ตรวจสอบเฉพาะรหัสประจำตัวว่าซ้ำหรือไม่ (ปลดล็อกเงื่อนไขอีเมลออก)
    const existingUser = await User.findOne({ identifier_code });
    if (existingUser) {
      return res.status(400).json({ message: 'รหัสนักศึกษา/บุคลากรนี้ถูกลงทะเบียนไว้แล้ว' });
    }

    // เข้ารหัสผ่าน
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      identifier_code,
      full_name,
      department,
      phone,
      email: email.trim().toLowerCase(),
      password_hash,
      role: 'student'
    });

    res.status(201).json({
      message: 'ลงทะเบียนสำเร็จในบทบาท student',
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