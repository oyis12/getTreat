import crypto from "node:crypto";
import User from "../models/user.model.js";
import Verification from "../models/verification.model.js";
import RefreshToken from "../models/refresh-token.model.js";

import  AppError  from "../utils/AppError.js";
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
const accessToken = generateAccessToken(user);

const refreshToken = generateRefreshToken(user);

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
    address,
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

    address: {
      country: address?.country?.trim() || undefined,
      city: address?.city?.trim() || undefined,
      state: address?.state?.trim() || undefined,
      zip: address?.zip?.trim() || undefined,
      house_no: address?.house_no?.trim() || undefined,
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
    address: user.address,
    role: user.role,
  };
};

export const signin = async (email, password, req) => {
  console.log("🔵 SIGNIN SERVICE: started");

  try {
    console.log("🔵 SIGNIN SERVICE: normalizing email");

    const normalizedEmail = email.trim().toLowerCase();

    console.log(
      "🔵 SIGNIN SERVICE: normalized email:",
      normalizedEmail
    );

    console.log(
      "🔵 SIGNIN SERVICE: looking up user..."
    );

    const user = await User.findOne({
      email: normalizedEmail,
    }).select("+password");

    console.log(
      "🔵 SIGNIN SERVICE: user found:",
      !!user
    );

    if (!user) {
      throw new AppError(
        "Invalid email or password",
        401
      );
    }

    console.log(
      "🔵 SIGNIN SERVICE: user id:",
      user._id.toString()
    );

    console.log(
      "🔵 SIGNIN SERVICE: account status:",
      user.accountStatus
    );

    console.log(
      "🔵 SIGNIN SERVICE: email verified:",
      user.emailVerified
    );

    console.log(
      "🔵 SIGNIN SERVICE: local auth enabled:",
      user.auth?.providers?.local?.enabled
    );

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

    console.log(
      "🔵 SIGNIN SERVICE: comparing password..."
    );

    const passwordMatches = await comparePassword(
      password,
      user.password
    );

    console.log(
      "🔵 SIGNIN SERVICE: password matches:",
      passwordMatches
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

    console.log(
      "🔵 SIGNIN SERVICE: updating last login..."
    );

    user.lastLoginAt = new Date();

    if (user.accountStatus === "pending") {
      user.accountStatus = "active";
    }

    await user.save();

    console.log(
      "🔵 SIGNIN SERVICE: user saved successfully"
    );

    console.log(
      "🔵 SIGNIN SERVICE: issuing tokens..."
    );

    const tokens = await issueTokens(user, req);

    console.log(
      "🔵 SIGNIN SERVICE: tokens created successfully"
    );

    console.log(
      "🔵 SIGNIN SERVICE: sanitizing user..."
    );

    const sanitized = sanitizeUser(user);

    console.log(
      "🔵 SIGNIN SERVICE: sanitize successful"
    );

    return {
      user: sanitized,
      ...tokens,
    };

  } catch (error) {
    console.error(
      "🔴 SIGNIN SERVICE ERROR:"
    );

    console.error("Name:", error.name);
    console.error("Message:", error.message);
    console.error("Stack:", error.stack);

    throw error;
  }
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

export const completeProfile = async (userId, payload) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  if (
    user.accountStatus === "suspended" ||
    user.accountStatus === "deactivated"
  ) {
    throw new AppError("Your account cannot be updated", 403);
  }

  const {
    phone_no,
    gender,
    birth_date,
    address,
  } = payload;

  // Phone number
  if (phone_no !== undefined) {
    user.phone_no = phone_no?.trim() || null;
  }

  // Gender
  if (gender !== undefined) {
    user.gender = gender?.trim() || null;
  }

  // Birth date
  if (birth_date !== undefined) {
    user.birth_date = birth_date;
  }

  // Address
  if (address !== undefined) {
    user.address = {
      country:
        address.country?.trim() ||
        user.address?.country ||
        null,

      city:
        address.city?.trim() ||
        user.address?.city ||
        null,

      state:
        address.state?.trim() ||
        user.address?.state ||
        null,

      zip:
        address.zip?.trim() ||
        user.address?.zip ||
        null,

      house_no:
        address.house_no?.trim() ||
        user.address?.house_no ||
        null,
    };
  }

  user.profileCompleted = true;

  await user.save();

  return {
    user: {
      id: user._id.toString(),
      fullname: user.fullname,
      email: user.email,
      phone_no: user.phone_no,
      birth_date: user.birth_date,
      gender: user.gender,
      address: user.address,
      role: user.role,
      emailVerified: user.emailVerified,
      accountStatus: user.accountStatus,
      profileCompleted: user.profileCompleted,
      profileImage: user.profileImage,
      lastLoginAt: user.lastLoginAt,
      created_at: user.createdAt,
      modified_at: user.modifiedAt,
    },
  };
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


 const newAccessToken = generateAccessToken(user);

const newRefreshToken = generateRefreshToken(user);

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