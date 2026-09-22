import User from "../models/user.model.js";
import PatientProfile from "../models/patient-profile.model.js";
import AppError from "../utils/AppError.js";
import { calculatePregnancyProgress } from "../utils/pregnancy.js";
import * as healthConditionService from "./health-condition.service.js";

const ensurePatient = async (userId) => {
  const user = await User.findById(userId);

  if (!user) throw new AppError("User account not found", 404);
  if (user.role !== "patient") {
    throw new AppError("This endpoint is only available to patients", 403);
  }
  if (["suspended", "deactivated"].includes(user.accountStatus)) {
    throw new AppError("Your account cannot be accessed", 403);
  }

  return user;
};

const getProfile = async (userId) => {
  await ensurePatient(userId);

  const profile = await PatientProfile.findOne({ user: userId })
    .populate({
      path: "pregnancies.health_conditions.condition",
      select: "name slug active",
    });

  if (!profile) throw new AppError("Patient profile not found", 404);
  return profile;
};

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
    has_fibroid: pregnancy.has_fibroid,
    health_conditions: (pregnancy.health_conditions ?? []).map(serializeHealthCondition),
    health_assessments: (pregnancy.health_assessments ?? []).map(serializeHealthAssessment),
    created_at: pregnancy.createdAt,
    modified_at: pregnancy.modifiedAt,
  };
};

const refreshProgress = (pregnancy) => {
  if (!pregnancy.last_menstral_date) {
    pregnancy.expected_delivery_date = null;
    pregnancy.current_trimester = 0;
    pregnancy.weeks_gone = 0;
    pregnancy.weeks_left = 0;
    return;
  }

  const progress = calculatePregnancyProgress(pregnancy.last_menstral_date);
  pregnancy.expected_delivery_date = progress.expected_delivery_date;
  pregnancy.current_trimester = progress.current_trimester;
  pregnancy.weeks_gone = progress.weeks_gone;
  pregnancy.weeks_left = progress.weeks_left;
};

const getCurrentPregnancy = (profile) =>
  profile.pregnancies.find((pregnancy) => pregnancy.is_current) ?? null;

const ensureNoOtherCurrentPregnancy = (profile, pregnancyId = null) => {
  const current = getCurrentPregnancy(profile);
  if (current && (!pregnancyId || current._id.toString() !== pregnancyId.toString())) {
    throw new AppError(
      "This patient already has an active pregnancy. End the current pregnancy before starting another one.",
      409
    );
  }
};


export const getCurrentPregnancyForUser = async (userId) => {
  const profile = await getProfile(userId);
  return serializePregnancy(getCurrentPregnancy(profile));
};

export const getPregnancyHistoryForUser = async (userId) => {
  const profile = await getProfile(userId);
  return profile.pregnancies
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(serializePregnancy);
};

export const createPregnancy = async (userId, payload) => {
  const profile = await getProfile(userId);
  ensureNoOtherCurrentPregnancy(profile);


  const pregnancy = profile.pregnancies.create({
    status: "active",
    is_current: true,
    conception_method: payload.conception_method ?? null,
    last_menstral_date: payload.last_menstral_date ?? null,
    has_fibroid: payload.has_fibroid ?? false,
  });

  refreshProgress(pregnancy);
  profile.pregnancies.push(pregnancy);
  await profile.save();

  return serializePregnancy(pregnancy);
};

export const updateCurrentPregnancy = async (userId, payload) => {
  const profile = await getProfile(userId);
  const pregnancy = getCurrentPregnancy(profile);

  if (!pregnancy) throw new AppError("No active pregnancy found", 404);

  if (payload.conception_method !== undefined) {
    pregnancy.conception_method = payload.conception_method;
  }
  if (payload.last_menstral_date !== undefined) {
    pregnancy.last_menstral_date = payload.last_menstral_date;
  }
  if (payload.has_fibroid !== undefined) {
    pregnancy.has_fibroid = payload.has_fibroid;
  }
  if (payload.status !== undefined) {
    pregnancy.status = payload.status;
    if (payload.status !== "active") pregnancy.is_current = false;
  }

  refreshProgress(pregnancy);
  await profile.save();

  return serializePregnancy(pregnancy);
};
