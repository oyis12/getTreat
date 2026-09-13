import User from "../models/user.model.js";
import  AppError  from "../utils/AppError.js";

const sanitizePatientProfile = (user) => {
  if (!user) return null;

  return {
    id: user._id.toString(),
    fullname: user.fullname,
    email: user.email,
    phone_no: user.phone_no,
    birth_date: user.birth_date,
    gender: user.gender,
    address: {
      country: user.address?.country ?? null,
      city: user.address?.city ?? null,
      state: user.address?.state ?? null,
      zip: user.address?.zip ?? null,
      house_no: user.address?.house_no ?? null,
    },
    role: user.role,
    emailVerified: user.emailVerified,
    accountStatus: user.accountStatus,
    profileCompleted: user.profileCompleted,
    profileImage: user.profileImage,
    lastLoginAt: user.lastLoginAt,
    created_at: user.createdAt,
    modified_at: user.modifiedAt,
  };
};

/**
 * Get authenticated patient's profile
 */
export const getPatientProfile = async (userId) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError("Patient account not found", 404);
  }

  if (user.role !== "patient") {
    throw new AppError(
      "This profile endpoint is only available to patients",
      403
    );
  }

  if (
    user.accountStatus === "suspended" ||
    user.accountStatus === "deactivated"
  ) {
    throw new AppError(
      "Your account cannot be accessed",
      403
    );
  }

  return sanitizePatientProfile(user);
};

/**
 * Update authenticated patient's profile
 */
export const updatePatientProfile = async (
  userId,
  payload
) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError("Patient account not found", 404);
  }

  if (user.role !== "patient") {
    throw new AppError(
      "This profile endpoint is only available to patients",
      403
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
    fullname,
    phone_no,
    birth_date,
    gender,
    address,
  } = payload;

  // Fullname
  if (fullname !== undefined) {
    user.fullname = fullname.trim();
  }

  // Phone
  if (phone_no !== undefined) {
    user.phone_no =
      phone_no === null
        ? null
        : phone_no.trim() || null;
  }

  // Birth date
  if (birth_date !== undefined) {
    user.birth_date = birth_date;
  }

  // Gender
  if (gender !== undefined) {
    user.gender =
      gender === null
        ? null
        : gender.trim() || null;
  }

  // Address
  if (address !== undefined) {
    const currentAddress = user.address || {};

    user.address = {
      country:
        address.country !== undefined
          ? address.country?.trim() || null
          : currentAddress.country ?? null,

      city:
        address.city !== undefined
          ? address.city?.trim() || null
          : currentAddress.city ?? null,

      state:
        address.state !== undefined
          ? address.state?.trim() || null
          : currentAddress.state ?? null,

      zip:
        address.zip !== undefined
          ? address.zip?.trim() || null
          : currentAddress.zip ?? null,

      house_no:
        address.house_no !== undefined
          ? address.house_no?.trim() || null
          : currentAddress.house_no ?? null,
    };
  }

  // Determine whether profile is actually complete
  const hasRequiredProfileInformation =
    Boolean(user.fullname?.trim()) &&
    Boolean(user.phone_no?.trim()) &&
    Boolean(user.birth_date) &&
    Boolean(user.gender?.trim()) &&
    Boolean(user.address?.country?.trim()) &&
    Boolean(user.address?.state?.trim()) &&
    Boolean(user.address?.city?.trim());

  user.profileCompleted = hasRequiredProfileInformation;

  await user.save();

  return sanitizePatientProfile(user);
};

export default {
  getPatientProfile,
  updatePatientProfile,
};