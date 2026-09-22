import User from "../models/user.model.js";
import PatientProfile from "../models/patient-profile.model.js";
import Service from "../models/services.model.js";
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

const serializeHealthCondition = (item) => ({
  id: item._id.toString(),
  condition:
    typeof item.condition === "object" && item.condition?.name
      ? {
          id: item.condition._id.toString(),
          name: item.condition.name,
          slug: item.condition.slug,
        }
      : { id: item.condition.toString() },
  status: item.status,
  source: item.source,
  identified_at: item.identified_at,
  notes: item.notes,
});

const serializeHealthAssessment = (item) => ({
  id: item._id.toString(),
  condition:
    typeof item.condition === "object" && item.condition?.name
      ? {
          id: item.condition._id.toString(),
          name: item.condition.name,
          slug: item.condition.slug,
        }
      : {
          id: item.condition.toString(),
          name: item.condition_name,
          slug: item.condition_slug,
        },
  condition_name: item.condition_name,
  condition_slug: item.condition_slug,
  status: item.status,
  result_status: item.result_status,
  score: item.score,
  answers: item.answers ?? [],
  started_at: item.started_at,
  completed_at: item.completed_at,
});

const serializePregnancy = (pregnancy) => {
  if (!pregnancy) return null;

  const healthConditions = (pregnancy.health_conditions ?? []).map(
    serializeHealthCondition
  );

  return {
    id: pregnancy._id.toString(),
    status: pregnancy.status,
    is_current: pregnancy.is_current,
    conception_method: pregnancy.conception_method,
    last_menstral_date: pregnancy.last_menstral_date,
    expected_delivery_date: pregnancy.expected_delivery_date,
    current_trimester: pregnancy.current_trimester,
    weeks_gone: pregnancy.weeks_gone,
    weeks_left: pregnancy.weeks_left,
    has_health_condition: healthConditions.length > 0,
    health_condition: healthConditions
      .map((item) => item.condition?.name)
      .filter(Boolean)
      .join(", "),
    has_fibroid: pregnancy.has_fibroid,
    health_conditions: healthConditions,
    health_assessments: (pregnancy.health_assessments ?? []).map(
      serializeHealthAssessment
    ),
    created_at: pregnancy.createdAt,
    modified_at: pregnancy.modifiedAt,
  };
};

const sanitizePatientProfile = (user, profile) => {
  const currentPregnancy = profile.pregnancies?.find(
    (pregnancy) => pregnancy.is_current
  );

  return {
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
    preferred_service_categories: profile.preferred_service_categories ?? [],
    service_type: (profile.service_type ?? []).map((service) =>
      typeof service === "object" && service?.name
        ? service.name
        : service?.toString?.() || service
    ),
    pregnancy: serializePregnancy(currentPregnancy),
    pregnancy_history: (profile.pregnancies ?? [])
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(serializePregnancy),
    role: user.role,
    emailVerified: user.emailVerified,
    accountStatus: user.accountStatus,
    page: user.page ?? null,
    profileCompleted: profile.profileCompleted,
    profileImage: profile.profileImage,
    avatar: profile.profileImage,
    lastLoginAt: user.lastLoginAt,
    created_at: profile.createdAt,
    modified_at: profile.modifiedAt,
  };
};

const populateProfile = async (profile) => {
  await profile.populate([
    { path: "service_type", select: "name slug category access_type active" },
    {
      path: "pregnancies.health_conditions.condition",
      select: "name slug active recommendation_keys",
    },
    {
      path: "pregnancies.health_assessments.condition",
      select: "name slug active",
    },
  ]);
  return profile;
};

const ensurePatientUser = async (userId) => {
  const user = await User.findById(userId);

  if (!user) throw new AppError("Patient account not found", 404);
  if (user.role !== "patient") {
    throw new AppError("This profile endpoint is only available to patients", 403);
  }
  if (["suspended", "deactivated"].includes(user.accountStatus)) {
    throw new AppError("Your account cannot be accessed", 403);
  }

  return user;
};

export const createPatientProfile = async (userId, initialData = {}) => {
  const user = await User.findById(userId);
  if (!user) throw new AppError("User not found", 404);
  if (user.role !== "patient") {
    throw new AppError("Only patient accounts can have a patient profile", 403);
  }

  const existingProfile = await PatientProfile.findOne({ user: user._id });
  if (existingProfile) return existingProfile;

  return PatientProfile.create({
    user: user._id,
    phone_no: initialData.phone_no?.trim() || null,
    birth_date: initialData.birth_date || null,
    gender: initialData.gender?.trim() || null,
    address: initialData.address ? buildAddress({}, initialData.address) : {},
    profileCompleted: false,
  });
};

export const getPatientProfile = async (userId) => {
  const user = await ensurePatientUser(userId);
  const profile = await PatientProfile.findOne({ user: user._id });
  if (!profile) {
    throw new AppError("Patient profile not found. Please complete your profile.", 404);
  }
  await populateProfile(profile);
  return sanitizePatientProfile(user, profile);
};

const applyServiceSelections = async (profile, payload) => {
  if (payload.preferred_service_categories !== undefined) {
    profile.preferred_service_categories = payload.preferred_service_categories;
  }

  if (payload.service_type === undefined) return;

  const serviceIds = payload.service_type;
  const services = await Service.find({
    _id: { $in: serviceIds },
    active: true,
  }).select("_id category name slug access_type");

  if (services.length !== serviceIds.length) {
    throw new AppError("One or more selected services are invalid or inactive", 400);
  }

  const nonSelectableService = services.find(
    (service) => service.access_type !== "optional"
  );

  if (nonSelectableService) {
    throw new AppError(
      `Service "${nonSelectableService.name}" is included and cannot be selected as an additional service`,
      400
    );
  }

  profile.service_type = serviceIds;
};

const updateProfile = async (userId, payload) => {
  const user = await ensurePatientUser(userId);
  let profile = await PatientProfile.findOne({ user: user._id });
  if (!profile) profile = await createPatientProfile(user._id);

  if (payload.fullname !== undefined) user.fullname = payload.fullname.trim();
  if (payload.phone_no !== undefined) profile.phone_no = payload.phone_no === null ? null : payload.phone_no.trim() || null;
  if (payload.birth_date !== undefined) profile.birth_date = payload.birth_date;
  if (payload.gender !== undefined) profile.gender = payload.gender === null ? null : payload.gender.trim() || null;
  if (payload.address !== undefined) profile.address = buildAddress(profile.address || {}, payload.address);

  await applyServiceSelections(profile, payload);
  profile.profileCompleted = calculateProfileCompleted(profile);

  await user.save();
  await profile.save();
  await populateProfile(profile);
  return sanitizePatientProfile(user, profile);
};

export const updatePatientProfile = updateProfile;

export const completePatientProfile = async (userId, payload) => {
  const profile = await updateProfile(userId, payload);
  const user = await User.findById(userId);
  return { user: sanitizeUser(user), profile };
};

export const updatePatientProfileImage = async (userId, { secure_url, public_id }) => {
  const user = await ensurePatientUser(userId);
  const profile = await PatientProfile.findOne({ user: user._id });
  if (!profile) {
    throw new AppError("Patient profile not found. Please complete your profile.", 404);
  }
  if (!secure_url || !public_id) throw new AppError("Uploaded profile image is invalid", 400);

  const previousPublicId = profile.profileImagePublicId;
  profile.profileImage = secure_url;
  profile.profileImagePublicId = public_id;
  await profile.save();

  if (previousPublicId && previousPublicId !== public_id) {
    try {
      await deleteCloudinaryImage(previousPublicId);
    } catch (error) {
      console.error("Failed to delete previous profile image:", {
        userId: user._id.toString(),
        message: error.message,
      });
    }
  }

  await populateProfile(profile);
  return sanitizePatientProfile(user, profile);
};

export default {
  createPatientProfile,
  getPatientProfile,
  updatePatientProfile,
  completePatientProfile,
  updatePatientProfileImage,
};
