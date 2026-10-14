import { connectDB, closeDB } from '../config/db.js';
import User from '../models/user.model.js';
import { hashPassword } from '../utils/password.js';

const required = (name) => {
  const value = process.env[name];
  if (!value?.trim()) throw new Error(`${name} is required`);
  return value.trim();
};

try {
  if (process.env.ALLOW_SUPER_ADMIN_BOOTSTRAP !== 'true') {
    throw new Error('Set ALLOW_SUPER_ADMIN_BOOTSTRAP=true to explicitly authorize this one-time operation');
  }
  const fullname = required('SUPER_ADMIN_FULLNAME');
  const email = required('SUPER_ADMIN_EMAIL').toLowerCase();
  const password = required('SUPER_ADMIN_PASSWORD');
  if (password.length < 12) throw new Error('SUPER_ADMIN_PASSWORD must be at least 12 characters');

  await connectDB();
  if (await User.exists({ role: 'super_admin' })) {
    console.log('A super admin already exists; no account was changed.');
  } else if (await User.exists({ email })) {
    throw new Error('The configured email already belongs to an account. No role was changed.');
  } else {
    const user = await User.create({
      fullname,
      email,
      password: await hashPassword(password),
      role: 'super_admin',
      emailVerified: true,
      accountStatus: 'active',
      page: 'dashboard',
      auth: { providers: { local: { enabled: true }, google: { enabled: false } } },
    });
    console.log(`Initial super admin created: ${user.email}`);
  }
} catch (error) {
  console.error(`Super admin bootstrap failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await closeDB();
}
