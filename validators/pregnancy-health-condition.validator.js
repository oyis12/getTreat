import AppError from "../utils/AppError.js";

const validateObjectId = (value) => /^[a-fA-F0-9]{24}$/.test(value);

export const validateAddHealthCondition = (req, _res, next) => {
  try {
    const allowedFields = ["condition_id", "notes"];
    const unknown = Object.keys(req.body).filter((key) => !allowedFields.includes(key));
    if (unknown.length) throw new AppError(`Unknown field(s): ${unknown.join(", ")}`, 400);
    if (!req.body.condition_id || !validateObjectId(req.body.condition_id)) {
      throw new AppError("A valid condition_id is required", 400);
    }
    if (req.body.notes !== undefined && req.body.notes !== null && typeof req.body.notes !== "string") {
      throw new AppError("notes must be a string", 400);
    }
    next();
  } catch (error) {
    next(error);
  }
};

export const validateUpdateHealthCondition = (req, _res, next) => {
  try {
    const allowedFields = ["status", "notes"];
    const unknown = Object.keys(req.body).filter((key) => !allowedFields.includes(key));
    if (unknown.length) throw new AppError(`Unknown field(s): ${unknown.join(", ")}`, 400);
    if (req.body.status !== undefined && req.body.status !== "reported") {
      throw new AppError("Patient health condition status must be reported", 400);
    }
    if (req.body.notes !== undefined && req.body.notes !== null && typeof req.body.notes !== "string") {
      throw new AppError("notes must be a string", 400);
    }
    next();
  } catch (error) {
    next(error);
  }
};
