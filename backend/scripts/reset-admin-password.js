require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../src/models/User');

async function resetAdminPassword() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set.');
  if (!process.env.SEED_PASSWORD) throw new Error('SEED_PASSWORD is not set.');

  const identifierCode = process.env.ADMIN_IDENTIFIER_CODE || 'ADMIN001';
  await mongoose.connect(process.env.MONGODB_URI);
  try {
    const passwordHash = await bcrypt.hash(process.env.SEED_PASSWORD, 10);
    const result = await User.updateOne(
      { identifier_code: identifierCode, role: 'admin' },
      { $set: { password_hash: passwordHash } }
    );
    if (result.matchedCount !== 1) {
      throw new Error(`No admin account found for ${identifierCode}. No password was changed.`);
    }
    console.log(`Admin password reset successfully for ${identifierCode}.`);
  } finally {
    await mongoose.disconnect();
  }
}

resetAdminPassword().catch(error => {
  console.error('Admin password reset failed:', error.message);
  process.exitCode = 1;
});
