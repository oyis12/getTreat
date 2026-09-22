import mongoose from "mongoose";
import AppError from "../utils/AppError.js";

const questionTypes = new Set(["boolean", "single_select", "multi_select", "number", "text"]);

const validateQuestions = (questions) => {
  if (!Array.isArray(questions)) throw new AppError("Assessment questions must be an array", 400);

  const keys = new Set();
  for (const question of questions) {
    if (!question || typeof question !== "object") throw new AppError("Each assessment question must be an object", 400);
    if (typeof question.key !== "string" || !question.key.trim()) throw new AppError("Each assessment question requires a key", 400);
    if (keys.has(question.key.trim().toLowerCase())) throw new AppError(`Duplicate assessment question key: ${question.key}`, 400);
    keys.add(question.key.trim().toLowerCase());
    if (typeof question.prompt !== "string" || !question.prompt.trim()) throw new AppError(`Question ${question.key} requires a prompt`, 400);
    if (!questionTypes.has(question.type)) throw new AppError(`Invalid question type for ${question.key}`, 400);
    if (question.required !== undefined && typeof question.required !== "boolean") throw new AppError(`required must be boolean for ${question.key}`, 400);
    if (question.active !== undefined && typeof question.active !== "boolean") throw new AppError(`active must be boolean for ${question.key}`, 400);
    if (question.sort_order !== undefined && (!Number.isInteger(question.sort_order) || question.sort_order < 0)) throw new AppError(`sort_order must be a non-negative integer for ${question.key}`, 400);

    if (["single_select", "multi_select"].includes(question.type)) {
      if (!Array.isArray(question.options) || question.options.length === 0) {
        throw new AppError(`Options are required for ${question.key}`, 400);
      }
      const optionValues = new Set();
      for (const option of question.options) {
        if (!option || typeof option.value !== "string" || typeof option.label !== "string") {
          throw new AppError(`Each option for ${question.key} requires value and label`, 400);
        }
        if (optionValues.has(option.value)) throw new AppError(`Duplicate option value for ${question.key}`, 400);
        optionValues.add(option.value);
      }
    }
  }
};

const validatePayload = (payload, { partial = false } = {}) => {
  const allowed = ["name", "slug", "description", "category", "active", "sort_order", "assessment", "recommendation_keys"];
  const unknown = Object.keys(payload).filter((key) => !allowed.includes(key));
  if (unknown.length) throw new AppError(`Unknown health condition field(s): ${unknown.join(", ")}`, 400);

  if (!partial || payload.name !== undefined) {
    if (typeof payload.name !== "string" || !payload.name.trim()) throw new AppError("Health condition name is required", 400);
  }
  if (payload.slug !== undefined && (typeof payload.slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(payload.slug))) {
    throw new AppError("Health condition slug must use lowercase letters, numbers and hyphens", 400);
  }
  if (payload.description !== undefined && payload.description !== null && typeof payload.description !== "string") throw new AppError("description must be a string", 400);
  if (payload.category !== undefined && payload.category !== "pregnancy_health") throw new AppError("Invalid health condition category", 400);
  if (payload.active !== undefined && typeof payload.active !== "boolean") throw new AppError("active must be a boolean", 400);
  if (payload.sort_order !== undefined && (!Number.isInteger(payload.sort_order) || payload.sort_order < 0)) throw new AppError("sort_order must be a non-negative integer", 400);
  if (payload.recommendation_keys !== undefined) {
    if (!Array.isArray(payload.recommendation_keys) || payload.recommendation_keys.some((key) => typeof key !== "string" || !key.trim())) {
      throw new AppError("recommendation_keys must be an array of non-empty strings", 400);
    }
    if (new Set(payload.recommendation_keys).size !== payload.recommendation_keys.length) throw new AppError("recommendation_keys must be unique", 400);
  }
  if (payload.assessment !== undefined) {
    if (!payload.assessment || typeof payload.assessment !== "object" || Array.isArray(payload.assessment)) throw new AppError("assessment must be an object", 400);
    const allowedAssessment = ["enabled", "title", "description", "questions"];
    const unknownAssessment = Object.keys(payload.assessment).filter((key) => !allowedAssessment.includes(key));
    if (unknownAssessment.length) throw new AppError(`Unknown assessment field(s): ${unknownAssessment.join(", ")}`, 400);
    if (payload.assessment.enabled !== undefined && typeof payload.assessment.enabled !== "boolean") throw new AppError("assessment.enabled must be boolean", 400);
    if (payload.assessment.title !== undefined && payload.assessment.title !== null && typeof payload.assessment.title !== "string") throw new AppError("assessment.title must be a string", 400);
    if (payload.assessment.description !== undefined && payload.assessment.description !== null && typeof payload.assessment.description !== "string") throw new AppError("assessment.description must be a string", 400);
    if (payload.assessment.questions !== undefined) validateQuestions(payload.assessment.questions);
  }
};

export const validateCreateHealthCondition = (req, _res, next) => {
  try {
    validatePayload(req.body);
    next();
  } catch (error) { next(error); }
};

export const validateUpdateHealthCondition = (req, _res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) throw new AppError("Invalid health condition ID", 400);
    validatePayload(req.body, { partial: true });
    next();
  } catch (error) { next(error); }
};
