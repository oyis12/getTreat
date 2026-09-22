import User from "../models/user.model.js";
import PatientProfile from "../models/patient-profile.model.js";
import AppError from "../utils/AppError.js";
import * as healthConditionService from "./health-condition.service.js";

const getCurrentPregnancy = async (userId) => {
  const user = await User.findById(userId).select("role accountStatus");
  if (!user) throw new AppError("User account not found", 404);
  if (user.role !== "patient") throw new AppError("This endpoint is only available to patients", 403);
  if (["suspended", "deactivated"].includes(user.accountStatus)) {
    throw new AppError("Your account cannot be accessed", 403);
  }

  const profile = await PatientProfile.findOne({ user: userId });
  if (!profile) throw new AppError("Patient profile not found", 404);

  const pregnancy = profile.pregnancies.find((item) => item.is_current);
  if (!pregnancy) throw new AppError("No active pregnancy found", 404);

  return { profile, pregnancy };
};

const serialize = (item) => ({
  id: item._id.toString(),
  condition: item.condition?.name
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

export const addHealthCondition = async (userId, payload) => {
  const { profile, pregnancy } = await getCurrentPregnancy(userId);
  const condition = await healthConditionService.getHealthConditionDocument(payload.condition_id);

  const existing = pregnancy.health_conditions.find(
    (item) => item.condition.toString() === condition._id.toString()
  );

  if (existing) throw new AppError("This health condition is already recorded for the pregnancy", 409);

  pregnancy.health_conditions.push({
    condition: condition._id,
    status: "reported",
    source: "patient",
    identified_at: new Date(),
    notes: payload.notes?.trim() || null,
  });

  await profile.save();
  const saved = pregnancy.health_conditions[pregnancy.health_conditions.length - 1];
  saved.condition = condition;
  return serialize(saved);
};

export const updateHealthCondition = async (userId, conditionId, payload) => {
  const { profile, pregnancy } = await getCurrentPregnancy(userId);
  const condition = await healthConditionService.getHealthConditionById(conditionId);
  const item = pregnancy.health_conditions.find(
    (entry) => entry.condition.toString() === condition._id.toString()
  );

  if (!item) throw new AppError("Health condition is not recorded for the current pregnancy", 404);

  if (payload.notes !== undefined) item.notes = payload.notes?.trim() || null;
  if (payload.status !== undefined && payload.status !== "reported") {
    throw new AppError("Patients can only maintain a self-reported condition as reported", 403);
  }

  item.status = "reported";
  item.source = "patient";
  await profile.save();

  item.condition = condition;
  return serialize(item);
};

export const removeHealthCondition = async (userId, conditionId) => {
  const { profile, pregnancy } = await getCurrentPregnancy(userId);
  const condition = await healthConditionService.getHealthConditionById(conditionId);
  const index = pregnancy.health_conditions.findIndex(
    (entry) => entry.condition.toString() === condition._id.toString()
  );

  if (index === -1) throw new AppError("Health condition is not recorded for the current pregnancy", 404);

  pregnancy.health_conditions.splice(index, 1);
  await profile.save();

  return null;
};
