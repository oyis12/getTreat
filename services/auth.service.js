import crypto from "node:crypto";
import User from "../models/user.model.js";
import Verification from "../models/verification.model.js";
import RefreshToken from "../models/refresh-token.model.js";

import { AppError } from "../utils/AppError.js";
import {
  hashPassword,
  comparePassword,
} from "../utils/password.js";

import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  getTokenExpirationDate,
  hashToken,
} from "../utils/jwt.js";

import {
  generateOtp,
  hashOtp,
  compareOtp,
  getOtpExpiration,
} from "../utils/otp.js";

import { sanitizeUser } from "../utils/sanitize.js";

import {
  sendVerificationEmail,
  sendPasswordResetEmail,
} from "../utils/email.js";

import { env } from "../config/env.js";

const deleteVerificationRecords = async (userId, type) => {
  await Verification.deleteMany({
    user: userId,
    type,
  });
};


const createVerificationCode = async (user, type) => {
  await deleteVerificationRecords(user._id, type);

  const code = generateOtp();
  const codeHash = hashOtp(code);

  const verification = await Verification.create({
    user: user._id,
    email: user.email,
    codeHash,
    type,
    expiresAt: getOtpExpiration(),
    attempts: 0,
    maxAttempts: env.maxOtpAttempts,
  });

  return {
    verification,
    code,
  };
};


const issueTokens = async (user, req) => {
  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });

  const refreshToken = generateRefreshToken({
    userId: user._id.toString(),
    role: user.role,
  });

  const refreshTokenHash = hashToken(refreshToken);

  await RefreshToken.create({
    user: user._id,
    tokenHash: refreshTokenHash,
    expiresAt: getTokenExpirationDate(refreshToken),
    userAgent: req?.get("user-agent") || null,
    ipAddress: req?.ip || null,
  });

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
  };
};


export const signup = async (payload, req) => {
  const {
    fullname,
    email,
    phone_no,
    birth_date,
    addr,
    role,
    password,
  } = payload;

  const normalizedEmail = email.trim().toLowerCase();

  const existingUser = await User.findOne({
    email: normalizedEmail,
  });

  if (existingUser) {
    throw new AppError(
      "An account with this email already exists",
      409
    );
  }

  const hashedPassword = await hashPassword(password);

  const user = await User.create({
    fullname: fullname.trim(),
    email: normalizedEmail,
    phone_no: phone_no?.trim() || undefined,
    birth_date: birth_date || undefined,
    password: hashedPassword,

    role: role || "patient",

    addr: {
      country: addr?.country?.trim() || undefined,
      city: addr?.city?.trim() || undefined,
      state: addr?.state?.trim() || undefined,
      zip: addr?.zip?.trim() || undefined,
      house_no: addr?.house_no?.trim() || undefined,
    },

    emailVerified: false,
    accountStatus: "pending",
    profileCompleted: false,

    auth: {
      providers: {
        local: {
          enabled: true,
        },
        google: {
          enabled: false,
        },
      },
    },
  });

  const { code } = await createVerificationCode(
    user,
    "email_verification"
  );

  try {
    await sendVerificationEmail({
      email: user.email,
      fullname: user.fullname,
      code,
    });
  } catch (error) {
    // Do not leave an unusable pending account if email delivery fails.
    await User.findByIdAndDelete(user._id);
    await Verification.deleteMany({
      user: user._id,
    });

    throw new AppError(
      "Unable to send verification email. Please try again.",
      503
    );
  }

  return {
    id: user.id,
    fullname: user.fullname,
    email: user.email,
    phone_no: user.phone_no,
    birth_date: user.birth_date,
    addr: user.addr,
    role: user.role,
  };
};


export const signin = async (email, password, req) => {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await User.findOne({
    email: normalizedEmail,
  }).select("+password");

  if (!user) {
    throw new AppError(
      "Invalid email or password",
      401
    );
  }

  if (user.accountStatus === "suspended") {
    throw new AppError(
      "Your account has been suspended",
      403
    );
  }

  if (user.accountStatus === "deactivated") {
    throw new AppError(
      "Your account has been deactivated",
      403
    );
  }

  if (!user.auth?.providers?.local?.enabled) {
    throw new AppError(
      "Password authentication is not enabled for this account",
      401
    );
  }

  const passwordMatches = await comparePassword(
    password,
    user.password
  );

  if (!passwordMatches) {
    throw new AppError(
      "Invalid email or password",
      401
    );
  }

  if (!user.emailVerified) {
    throw new AppError(
      "Please verify your email before signing in",
      403
    );
  }

  user.lastLoginAt = new Date();

  if (user.accountStatus === "pending") {
    user.accountStatus = "active";
  }

  await user.save();

  const tokens = await issueTokens(user, req);

  return {
    user: sanitizeUser(user),
    ...tokens,
  };
};


export const verifyEmail = async (email, code) => {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await User.findOne({
    email: normalizedEmail,
  });

  if (!user) {
    throw new AppError(
      "Invalid verification request",
      400
    );
  }

  if (user.emailVerified) {
    throw new AppError(
      "Email is already verified",
      400
    );
  }

  const verification = await Verification.findOne({
    user: user._id,
    type: "email_verification",
    verifiedAt: null,
  })
    .sort({ createdAt: -1 })
    .select("+codeHash");

  if (!verification) {
    throw new AppError(
      "Verification code is invalid or expired",
      400
    );
  }

  if (verification.expiresAt < new Date()) {
    await verification.deleteOne();

    throw new AppError(
      "Verification code has expired",
      400
    );
  }

  if (
    verification.attempts >=
    verification.maxAttempts
  ) {
    await verification.deleteOne();

    throw new AppError(
      "Too many verification attempts. Please request a new code.",
      429
    );
  }

  verification.attempts += 1;

  const validCode = compareOtp(
    code,
    verification.codeHash
  );

  if (!validCode) {
    await verification.save();

    throw new AppError(
      "Invalid verification code",
      400
    );
  }

  verification.verifiedAt = new Date();

  await verification.save();

  user.emailVerified = true;
  user.accountStatus = "active";

  await user.save();

  return null;
};

export const resendVerification = async (email) => {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await User.findOne({
    email: normalizedEmail,
  });


  if (!user || user.emailVerified) {
    return null;
  }

  if (
    user.accountStatus === "suspended" ||
    user.accountStatus === "deactivated"
  ) {
    return null;
  }

  const { code } = await createVerificationCode(
    user,
    "email_verification"
  );

  await sendVerificationEmail({
    email: user.email,
    fullname: user.fullname,
    code,
  });

  return null;
};

export const forgotPassword = async (email) => {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await User.findOne({
    email: normalizedEmail,
  });


  if (!user) {
    return null;
  }

  if (
    user.accountStatus === "suspended" ||
    user.accountStatus === "deactivated"
  ) {
    return null;
  }

  const { code } = await createVerificationCode(
    user,
    "password_reset"
  );

  await sendPasswordResetEmail({
    email: user.email,
    fullname: user.fullname,
    code,
  });

  return null;
};

export const newPassword = async (
  email,
  code,
  password
) => {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await User.findOne({
    email: normalizedEmail,
  });

  if (!user) {
    throw new AppError(
      "Invalid password reset request",
      400
    );
  }

  const verification = await Verification.findOne({
    user: user._id,
    type: "password_reset",
    verifiedAt: null,
  })
    .sort({ createdAt: -1 })
    .select("+codeHash");

  if (!verification) {
    throw new AppError(
      "Reset code is invalid or expired",
      400
    );
  }

  if (verification.expiresAt < new Date()) {
    await verification.deleteOne();

    throw new AppError(
      "Reset code has expired",
      400
    );
  }

  if (
    verification.attempts >=
    verification.maxAttempts
  ) {
    await verification.deleteOne();

    throw new AppError(
      "Too many attempts. Please request a new code.",
      429
    );
  }

  verification.attempts += 1;

  const validCode = compareOtp(
    code,
    verification.codeHash
  );

  if (!validCode) {
    await verification.save();

    throw new AppError(
      "Invalid reset code",
      400
    );
  }

  const hashedPassword = await hashPassword(password);

  user.password = hashedPassword;

  if (!user.auth?.providers?.local) {
    user.auth = {
      providers: {
        local: {
          enabled: true,
        },
      },
    };
  } else {
    user.auth.providers.local.enabled = true;
  }

  await user.save();

  verification.verifiedAt = new Date();

  await verification.save();

  await RefreshToken.updateMany(
    {
      user: user._id,
      revokedAt: null,
    },
    {
      $set: {
        revokedAt: new Date(),
      },
    }
  );

  return null;
};

export const completeProfile = async (
  userId,
  payload
) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError(
      "User not found",
      404
    );
  }

  if (
    user.accountStatus === "suspended" ||
    user.accountStatus === "deactivated"
  ) {
    throw new AppError(
      "Your account cannot be updated",
      403
    );
  }

  const {
    phone_no,
    gender,
    birth_date,
    addr,
  } = payload;

  if (phone_no !== undefined) {
    user.phone_no = phone_no?.trim() || undefined;
  }

  if (gender !== undefined) {
    user.gender = gender?.trim() || undefined;
  }

  if (birth_date !== undefined) {
    user.birth_date = birth_date;
  }

  if (addr !== undefined) {
    user.addr = {
      country:
        addr.country?.trim() ||
        user.addr?.country,

      city:
        addr.city?.trim() ||
        user.addr?.city,

      state:
        addr.state?.trim() ||
        user.addr?.state,

      zip:
        addr.zip?.trim() ||
        user.addr?.zip,

      house_no:
        addr.house_no?.trim() ||
        user.addr?.house_no,
    };
  }

  user.profileCompleted = true;

  await user.save();

  return null;
};

export const refreshAccessToken = async (
  refreshToken,
  req
) => {
  let payload;

  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError(
      "Invalid or expired refresh token",
      401
    );
  }

  if (payload.type !== "refresh") {
    throw new AppError(
      "Invalid refresh token",
      401
    );
  }

  const tokenHash = hashToken(refreshToken);

  const storedToken = await RefreshToken.findOne({
    tokenHash,
  }).select("+tokenHash");

  if (!storedToken) {
    throw new AppError(
      "Invalid refresh token",
      401
    );
  }

  if (storedToken.revokedAt) {

    await RefreshToken.updateMany(
      {
        user: storedToken.user,
        revokedAt: null,
      },
      {
        $set: {
          revokedAt: new Date(),
        },
      }
    );

    throw new AppError(
      "Refresh token has already been revoked",
      401
    );
  }

  if (storedToken.expiresAt < new Date()) {
    throw new AppError(
      "Refresh token has expired",
      401
    );
  }

  const user = await User.findById(
    storedToken.user
  );

  if (!user) {
    throw new AppError(
      "User not found",
      404
    );
  }

  if (
    user.accountStatus === "suspended" ||
    user.accountStatus === "deactivated"
  ) {
    throw new AppError(
      "Your account is not active",
      403
    );
  }


  const newAccessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });

  const newRefreshToken = generateRefreshToken({
    userId: user._id.toString(),
    role: user.role,
  });

  const newRefreshTokenHash =
    hashToken(newRefreshToken);

  const newStoredToken =
    await RefreshToken.create({
      user: user._id,
      tokenHash: newRefreshTokenHash,
      expiresAt:
        getTokenExpirationDate(newRefreshToken),
      userAgent:
        req?.get("user-agent") || null,
      ipAddress:
        req?.ip || null,
    });

  storedToken.revokedAt = new Date();
  storedToken.replacedByTokenHash =
    newRefreshTokenHash;

  await storedToken.save();

  return {
    access_token: newAccessToken,
    refresh_token: newRefreshToken,
  };
};


export const logout = async (refreshToken) => {
  if (!refreshToken) {
    return null;
  }

  const tokenHash = hashToken(refreshToken);

  await RefreshToken.findOneAndUpdate(
    {
      tokenHash,
      revokedAt: null,
    },
    {
      $set: {
        revokedAt: new Date(),
      },
    }
  );

  return null;
};

export default {
  signup,
  signin,
  verifyEmail,
  resendVerification,
  forgotPassword,
  newPassword,
  completeProfile,
  refreshAccessToken,
  logout,
};