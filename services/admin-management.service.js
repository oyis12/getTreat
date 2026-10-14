import mongoose from 'mongoose';
import AdminProfile, { adminPermissionKeys } from '../models/admin-profile.model.js';
import User from '../models/user.model.js';
import Verification from '../models/verification.model.js';
import AppError from '../utils/AppError.js';
import { hashPassword } from '../utils/password.js';
import { generateOtp, hashOtp, getOtpExpiration } from '../utils/otp.js';
import { sendVerificationEmail } from '../utils/email.js';
import { env } from '../config/env.js';

const serializeAdmin = (profile) => ({
  id: profile._id.toString(),
  admin_type: profile.admin_type,
  permissions: Object.fromEntries(adminPermissionKeys.map((key) => [key, Boolean(profile.permissions?.[key])])),
  created_by: profile.created_by?.toString?.() ?? profile.created_by,
  modified_by: profile.modified_by?.toString?.() ?? profile.modified_by ?? null,
  created_at: profile.createdAt,
  modified_at: profile.modifiedAt,
  user: profile.user && typeof profile.user === 'object' && profile.user._id
    ? {
        id: profile.user._id.toString(),
        fullname: profile.user.fullname,
        email: profile.user.email,
        role: profile.user.role,
        email_verified: profile.user.emailVerified,
        account_status: profile.user.accountStatus,
        last_login_at: profile.user.lastLoginAt,
      }
    : profile.user?.toString?.() ?? profile.user,
});

const cleanPermissions = (permissions, { partial = false } = {}) => {
  if (!permissions || typeof permissions !== 'object' || Array.isArray(permissions)) {
    throw new AppError('permissions must be an object', 400);
  }
  const keys = Object.keys(permissions);
  const unknown = keys.filter((key) => !adminPermissionKeys.includes(key));
  if (unknown.length) throw new AppError(`Unknown permission(s): ${unknown.join(', ')}`, 400);
  if (!partial && !keys.length) throw new AppError('At least one permission value is required', 400);
  for (const [key, value] of Object.entries(permissions)) {
    if (typeof value !== 'boolean') throw new AppError(`permissions.${key} must be a boolean`, 400);
  }
  return permissions;
};

export const createAdminAccount = async ({ fullname, email, password, permissions }, creatorId) => {
  const normalizedEmail = email.trim().toLowerCase();
  if (await User.exists({ email: normalizedEmail })) {
    throw new AppError('An account with this email already exists', 409);
  }

  const user = new User({
    fullname: fullname.trim(),
    email: normalizedEmail,
    password: await hashPassword(password),
    role: 'admin',
    emailVerified: false,
    accountStatus: 'pending',
    page: 'verify',
    auth: { providers: { local: { enabled: true }, google: { enabled: false } } },
  });
  const profile = new AdminProfile({
    user: user._id,
    admin_type: 'control_admin',
    permissions: cleanPermissions(permissions),
    created_by: creatorId,
  });

  let verification;
  try {
    await user.save();
    await profile.save();
    const code = generateOtp();
    verification = await Verification.create({
      user: user._id,
      email: user.email,
      codeHash: hashOtp(code),
      type: 'email_verification',
      expiresAt: getOtpExpiration(env.verificationCodeExpiresMinutes),
      attempts: 0,
      maxAttempts: env.maxOtpAttempts,
    });
    await sendVerificationEmail({ email: user.email, fullname: user.fullname, code });
  } catch (error) {
    await Promise.allSettled([
      AdminProfile.deleteOne({ _id: profile._id }),
      Verification.deleteMany({ user: user._id }),
      User.deleteOne({ _id: user._id }),
    ]);
    if (error instanceof AppError) throw error;
    if (error?.code === 11000) throw new AppError('An account with this email already exists', 409);
    throw new AppError('Unable to create admin account. Please try again.', 503);
  }

  return serializeAdmin({ ...profile.toObject(), user });
};

export const listAdminAccounts = async ({ page, limit, search = '' }) => {
  const filter = {};
  const escapedSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const profileQuery = AdminProfile.find(filter)
    .populate({
      path: 'user',
      select: 'fullname email role emailVerified accountStatus lastLoginAt',
      match: escapedSearch ? { $or: [
        { fullname: { $regex: escapedSearch, $options: 'i' } },
        { email: { $regex: escapedSearch, $options: 'i' } },
      ] } : undefined,
    })
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
  const [profiles, total] = await Promise.all([
    profileQuery,
    search.trim()
      ? AdminProfile.aggregate([
          { $lookup: { from: User.collection.name, localField: 'user', foreignField: '_id', as: 'account' } },
          { $unwind: '$account' },
          { $match: { $or: [
            { 'account.fullname': { $regex: escapedSearch, $options: 'i' } },
            { 'account.email': { $regex: escapedSearch, $options: 'i' } },
          ] } },
          { $count: 'total' },
        ]).then((result) => result[0]?.total ?? 0)
      : AdminProfile.countDocuments(filter),
  ]);
  const items = profiles.filter((profile) => profile.user).map(serializeAdmin);
  return { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
};

export const updateAdminAccount = async (profileId, payload, actorId) => {
  if (!mongoose.isValidObjectId(profileId)) throw new AppError('Invalid admin profile ID', 400);
  const profile = await AdminProfile.findById(profileId);
  if (!profile) throw new AppError('Admin account not found', 404);
  const user = await User.findById(profile.user);
  if (!user || user.role !== 'admin') throw new AppError('Admin account not found', 404);

  if (payload.permissions) {
    const updates = cleanPermissions(payload.permissions, { partial: true });
    for (const [key, value] of Object.entries(updates)) profile.permissions.set(key, value);
  }
  if (payload.account_status !== undefined) {
    if (!['active', 'suspended', 'deactivated'].includes(payload.account_status)) {
      throw new AppError('account_status must be active, suspended, or deactivated', 400);
    }
    user.accountStatus = payload.account_status;
    await user.save();
  }
  if (!payload.permissions && payload.account_status === undefined) {
    throw new AppError('Provide permissions or account_status to update', 400);
  }
  profile.modified_by = actorId;
  await profile.save();
  profile.user = user;
  return serializeAdmin(profile);
};

export const hasAdminPermission = async (userId, permission) => {
  if (!adminPermissionKeys.includes(permission)) return false;
  const profile = await AdminProfile.findOne({ user: userId }).select(`permissions.${permission}`);
  return Boolean(profile?.permissions?.[permission]);
};
