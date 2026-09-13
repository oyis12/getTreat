import User from "../models/user.model.js";
import PatientProfile from "../models/patient-profile.model.js";
import AppError from "../utils/AppError.js";
import { sanitizeUser } from "../utils/sanitize.js";
import { deleteCloudinaryImage } from "../utils/cloudinary.js";

const buildAddress = (currentAddress = {}, incomingAddress = {}) => ({
  country:
    incomingAddress.country !== undefined
      ? incomingAddress.country?.trim() || null
      : currentAddress.country ?? null,

  city:
    incomingAddress.city !== undefined
      ? incomingAddress.city?.trim() || null
      : currentAddress.city ?? null,

  state:
    incomingAddress.state !== undefined
      ? incomingAddress.state?.trim() || null
      : currentAddress.state ?? null,

  zip:
    incomingAddress.zip !== undefined
      ? incomingAddress.zip?.trim() || null
      : currentAddress.zip ?? null,

  house_no:
    incomingAddress.house_no !== undefined
      ? incomingAddress.house_no?.trim() || null
      : currentAddress.house_no ?? null,
});

const calculateProfileCompleted = (profile) =>
  Boolean(profile.phone_no?.trim()) &&
  Boolean(profile.birth_date) &&
  Boolean(profile.gender?.trim()) &&
  Boolean(profile.address?.country?.trim()) &&
  Boolean(profile.address?.state?.trim()) &&
  Boolean(profile.address?.city?.trim());

const sanitizePatientProfile = (user, profile) => ({
  id: profile._id.toString(),
  user_id: user._id.toString(),
  fullname: user.fullname,
  email: user.email,
  phone_no: profile.phone_no,
  birth_date: profile.birth_date,
  gender: profile.gender,
  address: {
    country: profile.address?.country ?? null,
    city: profile.address?.city ?? null,
    state: profile.address?.state ?? null,
    zip: profile.address?.zip ?? null,
    house_no: profile.address?.house_no ?? null,
  },
  role: user.role,
  emailVerified: user.emailVerified,
  accountStatus: user.accountStatus,
  profileCompleted: profile.profileCompleted,
  profileImage: profile.profileImage,
  lastLoginAt: user.lastLoginAt,
  created_at: profile.createdAt,
  modified_at: profile.modifiedAt,
});

const ensurePatientUser = async (userId) => {
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
    throw new AppError("Your account cannot be accessed", 403);
  }

  return user;
};

export const createPatientProfile = async (
  userId,
  initialData = {}
) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  if (user.role !== "patient") {
    throw new AppError(
      "Only patient accounts can have a patient profile",
      403
    );
  }

  const existingProfile = await PatientProfile.findOne({
    user: user._id,
  });

  if (existingProfile) {
    return existingProfile;
  }

  const profile = await PatientProfile.create({
    user: user._id,
    phone_no: initialData.phone_no?.trim() || null,
    birth_date: initialData.birth_date || null,
    gender: initialData.gender?.trim() || null,
    address: initialData.address
      ? buildAddress({}, initialData.address)
      : {},
    profileCompleted: false,
  });

  return profile;
};

export const getPatientProfile = async (userId) => {
  const user = await ensurePatientUser(userId);

  const profile = await PatientProfile.findOne({
    user: user._id,
  });

  if (!profile) {
    throw new AppError(
      "Patient profile not found. Please complete your profile.",
      404
    );
  }

  return sanitizePatientProfile(user, profile);
};

export const updatePatientProfile = async (
  userId,
  payload
) => {
  const user = await ensurePatientUser(userId);

  let profile = await PatientProfile.findOne({
    user: user._id,
  });

  if (!profile) {
    profile = await createPatientProfile(user._id);
  }

  const {
    fullname,
    phone_no,
    birth_date,
    gender,
    address,
  } = payload;

  if (fullname !== undefined) {
    user.fullname = fullname.trim();
  }

  if (phone_no !== undefined) {
    profile.phone_no =
      phone_no === null
        ? null
        : phone_no.trim() || null;
  }

  if (birth_date !== undefined) {
    profile.birth_date = birth_date;
  }

  if (gender !== undefined) {
    profile.gender =
      gender === null
        ? null
        : gender.trim() || null;
  }

  if (address !== undefined) {
    profile.address = buildAddress(
      profile.address || {},
      address
    );
  }

  profile.profileCompleted =
    calculateProfileCompleted(profile);

  await user.save();
  await profile.save();

  return sanitizePatientProfile(user, profile);
};

export const completePatientProfile = async (
  userId,
  payload
) => {
  const user = await ensurePatientUser(userId);

  let profile = await PatientProfile.findOne({
    user: user._id,
  });

  if (!profile) {
    profile = await createPatientProfile(user._id);
  }

  const {
    phone_no,
    gender,
    birth_date,
    address,
  } = payload;

  if (phone_no !== undefined) {
    profile.phone_no =
      phone_no === null
        ? null
        : phone_no.trim() || null;
  }

  if (gender !== undefined) {
    profile.gender =
      gender === null
        ? null
        : gender.trim() || null;
  }

  if (birth_date !== undefined) {
    profile.birth_date = birth_date;
  }

  if (address !== undefined) {
    profile.address = buildAddress(
      profile.address || {},
      address
    );
  }

  profile.profileCompleted =
    calculateProfileCompleted(profile);

  await profile.save();

  return {
    user: sanitizeUser(user),
    profile: sanitizePatientProfile(user, profile),
  };
};

export const updatePatientProfileImage = async (userId, { secure_url, public_id }) => {
  const user = await ensurePatientUser(userId);

  const profile = await PatientProfile.findOne({
    user: user._id,
  });

  if (!profile) {
    throw new AppError(
      "Patient profile not found. Please complete your profile.",
      404
    );
  }

  if (!secure_url || !public_id) {
    throw new AppError("Uploaded profile image is invalid", 400);
  }

  const previousPublicId = profile.profileImagePublicId;

  profile.profileImage = secure_url;
  profile.profileImagePublicId = public_id;

  await profile.save();

  if (previousPublicId && previousPublicId !== public_id) {
    try {
      await deleteCloudinaryImage(previousPublicId);
    } catch (error) {
      console.error("❌ Failed to delete previous profile image:", {
        userId: user._id.toString(),
        message: error.message,
      });
    }
  }

  return sanitizePatientProfile(user, profile);
};

export default {
  createPatientProfile,
  getPatientProfile,
  updatePatientProfile,
  completePatientProfile,
  updatePatientProfileImage,
};
