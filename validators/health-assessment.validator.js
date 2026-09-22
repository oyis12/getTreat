import AppError from "../utils/AppError.js";

const isValidAnswer = (answer) =>
  answer &&
  typeof answer === "object" &&
  typeof answer.question_key === "string" &&
  answer.question_key.trim().length > 0 &&
  Object.prototype.hasOwnProperty.call(answer, "value");

export const validateHealthAssessmentPayload = (req, _res, next) => {
  try {
    const unknownFields = Object.keys(req.body).filter((field) => field !== "answers");
    if (unknownFields.length) {
      throw new AppError(`Unknown assessment field(s): ${unknownFields.join(", ")}`, 400);
    }
    if (!Array.isArray(req.body.answers)) {
      throw new AppError("answers must be an array", 400);
    }
    if (req.body.answers.some((answer) => !isValidAnswer(answer))) {
      throw new AppError("Each answer must contain question_key and value", 400);
    }
    next();
  } catch (error) {
    next(error);
  }
};

export default validateHealthAssessmentPayload;
