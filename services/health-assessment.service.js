import User from "../models/user.model.js";
import PatientProfile from "../models/patient-profile.model.js";
import AppError from "../utils/AppError.js";
import * as healthConditionService from "./health-condition.service.js";

const ensurePatientProfile = async (userId) => {
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

const serializeAssessment = (assessment) => ({
  id: assessment._id.toString(),
  condition:
    assessment.condition?.name
      ? {
          id: assessment.condition._id.toString(),
          name: assessment.condition.name,
          slug: assessment.condition.slug,
        }
      : {
          id: assessment.condition?.toString?.() ?? assessment.condition,
          name: assessment.condition_name,
          slug: assessment.condition_slug,
        },
  condition_name: assessment.condition_name,
  condition_slug: assessment.condition_slug,
  status: assessment.status,
  result_status: assessment.result_status,
  score: assessment.score,
  answers: assessment.answers ?? [],
  started_at: assessment.started_at,
  completed_at: assessment.completed_at,
});

const validateAnswers = (condition, answers) => {
  if (!Array.isArray(answers)) throw new AppError("answers must be an array", 400);

  const activeQuestions = (condition.assessment?.questions ?? []).filter((question) => question.active);
  const questionMap = new Map(activeQuestions.map((question) => [question.key, question]));
  const seen = new Set();

  for (const answer of answers) {
    if (!answer || typeof answer !== "object" || typeof answer.question_key !== "string") {
      throw new AppError("Each answer must contain a valid question_key", 400);
    }
    if (seen.has(answer.question_key)) {
      throw new AppError(`Duplicate answer for question: ${answer.question_key}`, 400);
    }
    seen.add(answer.question_key);

    const question = questionMap.get(answer.question_key);
    if (!question) throw new AppError(`Unknown assessment question: ${answer.question_key}`, 400);

    const value = answer.value;
    if (question.type === "boolean" && typeof value !== "boolean") {
      throw new AppError(`Answer for ${question.key} must be boolean`, 400);
    }
    if (question.type === "single_select") {
      const allowed = new Set((question.options ?? []).map((option) => option.value));
      if (typeof value !== "string" || !allowed.has(value)) {
        throw new AppError(`Invalid option for: ${question.prompt}`, 400);
      }
    }
    if (question.type === "multi_select") {
      const allowed = new Set((question.options ?? []).map((option) => option.value));
      if (!Array.isArray(value) || value.some((entry) => !allowed.has(entry))) {
        throw new AppError(`Invalid option for: ${question.prompt}`, 400);
      }
    }
    if (question.type === "number" && (typeof value !== "number" || !Number.isFinite(value))) {
      throw new AppError(`Answer for ${question.key} must be a number`, 400);
    }
    if (question.type === "text" && typeof value !== "string") {
      throw new AppError(`Answer for ${question.key} must be text`, 400);
    }
  }

  const missingRequired = activeQuestions.filter(
    (question) => question.required && !seen.has(question.key)
  );

  return {
    isComplete: missingRequired.length === 0,
  };
};

export const getPregnancyHealthAssessments = async (userId) => {
  const { pregnancy } = await ensurePatientProfile(userId);

  const conditions = await healthConditionService.getActiveHealthConditions();

  const assessmentConditions = conditions.filter(
    (condition) => condition.assessment?.enabled
  );

  return assessmentConditions.map((condition) => {
    const existingAssessment = pregnancy.health_assessments.find(
      (item) => item.condition.toString() === condition.id.toString()
    );

    if (existingAssessment) {
      return {
        ...serializeAssessment(existingAssessment),
        questions: condition.assessment.questions ?? [],
      };
    }

    return {
      id: null,
      condition: {
        id: condition.id,
        name: condition.name,
        slug: condition.slug,
      },
      condition_name: condition.name,
      condition_slug: condition.slug,
      status: "not_started",
      result_status: "pending",
      score: null,
      answers: [],
      questions: condition.assessment.questions ?? [],
      started_at: null,
      completed_at: null,
    };
  });
};

export const getPregnancyHealthAssessment = async (userId, conditionSlug) => {
  const { pregnancy } = await ensurePatientProfile(userId);

  const condition =
    await healthConditionService.getActiveHealthConditionBySlug(conditionSlug);

  if (!condition.assessment?.enabled) {
    throw new AppError(
      "This health condition does not have an active assessment",
      422
    );
  }

  const assessment = pregnancy.health_assessments.find(
    (item) => item.condition.toString() === condition._id.toString()
  );

  if (!assessment) {
    return {
      id: null,
      condition: {
        id: condition._id.toString(),
        name: condition.name,
        slug: condition.slug,
      },
      condition_name: condition.name,
      condition_slug: condition.slug,
      status: "not_started",
      result_status: "pending",
      score: null,
      answers: [],
      questions: condition.assessment.questions ?? [],
      started_at: null,
      completed_at: null,
    };
  }

  return {
    ...serializeAssessment(assessment),
    questions: condition.assessment.questions ?? [],
  };
};

export const savePregnancyHealthAssessment = async (userId, conditionSlug, answers) => {
  const { profile, pregnancy } = await ensurePatientProfile(userId);
  const condition = await healthConditionService.getActiveHealthConditionBySlug(conditionSlug);

  if (!condition.assessment?.enabled) {
    throw new AppError("This health condition does not have an active assessment", 422);
  }

  const { isComplete } = validateAnswers(condition, answers);

  let assessment = pregnancy.health_assessments.find(
    (item) => item.condition.toString() === condition._id.toString()
  );

  if (!assessment) {
    assessment = pregnancy.health_assessments.create({
      condition: condition._id,
      condition_slug: condition.slug,
      condition_name: condition.name,
    });
    pregnancy.health_assessments.push(assessment);
    assessment = pregnancy.health_assessments[pregnancy.health_assessments.length - 1];
  }

  const now = new Date();
  assessment.status = isComplete ? "completed" : "in_progress";
  assessment.result_status = "pending";
  assessment.score = null;
  assessment.answers = answers.map((answer) => ({
    question_key: answer.question_key,
    value: answer.value,
  }));
  assessment.started_at = assessment.started_at ?? now;
  assessment.completed_at = isComplete ? now : null;

  await profile.save();
  return serializeAssessment(assessment);
};
