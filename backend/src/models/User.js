const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  identifier_code: { type: String, required: true, unique: true }, // รหัสนักศึกษา/บุคลากร
  full_name: { type: String, required: true },
  department: { type: String, default: 'เทคโนโลยีสารสนเทศ (DIT)' },  phone: { type: String, default: '' },
  email: { type: String, default: '' }, // ปลดล็อก required และ unique ออกแล้ว
  password_hash: { type: String, required: true },
  role: { type: String, enum: ['admin', 'teacher', 'student'], default: 'student' },
  password_reset_otp_hash: { type: String, default: null },
  password_reset_expires_at: { type: Date, default: null },
  password_reset_last_sent_at: { type: Date, default: null },
  password_reset_attempts: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);