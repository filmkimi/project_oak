const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  identifier_code: { type: String, required: true, unique: true }, // รหัสนักศึกษา/บุคลากร
  full_name: { type: String, required: true },
  department: { type: String, required: true },
  phone: { type: String, default: '' },
  email: { type: String, required: true, unique: true },
  password_hash: { type: String, required: true },
  role: { type: String, enum: ['admin', 'teacher', 'student'], default: 'student' }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);