import HealthCondition from "../models/health-condition.model.js";
import AppError from "../utils/AppError.js";

const serializeQuestion = (question) => ({
  key: question.key,
  prompt: question.prompt,
  type: question.type,
  required: question.required,
  options: question.options ?? [],
  sort_order: question.sort_order,
});

const serializeCondition = (condition) => ({
  id: condition._id.toString(),
  name: condition.name,
  slug: condition.slug,
  description: condition.description,
  category: condition.category,
  active: condition.active,
  sort_order: condition.sort_order,
  recommendation_keys: condition.recommendation_keys ?? [],
  assessment: condition.assessment?.enabled
    ? {
        enabled: true,
        title: condition.assessment.title,
        description: condition.assessment.description,
        questions: (condition.assessment.questions ?? [])
          .filter((question) => question.active)
          .sort((a, b) => a.sort_order - b.sort_order)
          .map(serializeQuestion),
      }
    : { enabled: false, title: null, description: null, questions: [] },
});



export const getAllHealthConditions = async () => {
  const conditions = await HealthCondition.find({ category: "pregnancy_health" })
    .sort({ sort_order: 1, name: 1 });
  return conditions.map(serializeCondition);
};

export const createHealthCondition = async (payload) => {
  try {
    const condition = await HealthCondition.create({
      ...payload,
      category: "pregnancy_health",
    });
    return serializeCondition(condition);
  } catch (error) {
    if (error?.code === 11000) {
      throw new AppError("A health condition with this slug already exists", 409);
    }
    throw error;
  }
};

export const updateHealthCondition = async (conditionId, payload) => {
  const condition = await HealthCondition.findOne({
    _id: conditionId,
    category: "pregnancy_health",
  });

  if (!condition) throw new AppError("Health condition not found", 404);

  Object.assign(condition, payload);
  condition.category = "pregnancy_health";

  try {
    await condition.save();
  } catch (error) {
    if (error?.code === 11000) {
      throw new AppError("A health condition with this slug already exists", 409);
    }
    throw error;
  }

  return serializeCondition(condition);
};

export const getActiveHealthConditions = async () => {
  const conditions = await HealthCondition.find({
    category: "pregnancy_health",
    active: true,
  }).sort({ sort_order: 1, name: 1 });

  return conditions.map(serializeCondition);
};

export const getActiveHealthConditionBySlug = async (slug) => {
  const condition = await HealthCondition.findOne({
    slug: slug.toLowerCase(),
    category: "pregnancy_health",
    active: true,
  });

  if (!condition) {
    throw new AppError("Health condition not found", 404);
  }

  return condition;
};

export const getHealthConditionDocument = async (conditionId) => {
  const condition = await HealthCondition.findOne({
    _id: conditionId,
    category: "pregnancy_health",
    active: true,
  });

  if (!condition) {
    throw new AppError("Health condition not found or inactive", 404);
  }

  return condition;
};

export const getHealthConditionById = async (conditionId) => {
  const condition = await HealthCondition.findOne({
    _id: conditionId,
    category: "pregnancy_health",
  });

  if (!condition) {
    throw new AppError("Health condition not found", 404);
  }

  return condition;
};

export { serializeCondition };
