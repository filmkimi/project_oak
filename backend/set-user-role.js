const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const mongoose = require('mongoose');
const User = require('./src/models/User');

async function setUserRole() {
  const [identifierCode, role] = process.argv.slice(2);
  const allowedRoles = ['admin', 'teacher', 'student'];

  if (!identifierCode || !allowedRoles.includes(role)) {
    console.error('Usage: node set-user-role.js <identifier_code> <admin|teacher|student>');
    process.exitCode = 1;
    return;
  }

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not configured in backend/.env');
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const user = await User.findOneAndUpdate(
      { identifier_code: identifierCode },
      { role },
      { new: true, runValidators: true }
    ).select('identifier_code full_name role');

    if (!user) {
      console.error(`User not found: ${identifierCode}`);
      process.exitCode = 1;
      return;
    }

    console.log(`Updated ${user.identifier_code} (${user.full_name}) role to ${user.role}.`);
  } finally {
    await mongoose.disconnect();
  }
}

setUserRole().catch(error => {
  console.error(`Unable to update user role: ${error.message}`);
  process.exitCode = 1;
});
