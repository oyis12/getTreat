import * as healthAssessmentService from "../services/health-assessment.service.js";
import AppError from "../utils/AppError.js";
import { sendSuccess } from "../utils/response.js";

const userId = (req) => {
  if (!req.user?.id) throw new AppError("Authentication required", 401);
  return req.user.id;
};

export const getHealthAssessments = async (req, res, next) => {
  try {
    const data = await healthAssessmentService.getPregnancyHealthAssessments(userId(req));
    return sendSuccess(res, {
      statusCode: 200,
      msg: "Pregnancy health assessments retrieved successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getHealthAssessment = async (req, res, next) => {
  try {
    const data = await healthAssessmentService.getPregnancyHealthAssessment(
      userId(req),
      req.params.conditionSlug
    );
    return sendSuccess(res, {
      statusCode: 200,
      msg: "Pregnancy health assessment retrieved successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const saveHealthAssessment = async (req, res, next) => {
  try {
    const data = await healthAssessmentService.savePregnancyHealthAssessment(
      userId(req),
      req.params.conditionSlug,
      req.body.answers
    );
    return sendSuccess(res, {
      statusCode: 200,
      msg: "Pregnancy health assessment saved successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};
