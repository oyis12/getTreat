import { validationResult } from "express-validator";
import { sendError } from "../utils/response.js";

export const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((error) => ({
      field: error.path,
      message: error.msg,
    }));

    return sendError(res, {
      statusCode: 400,
      msg: "Validation failed",
      data: formattedErrors,
    });
  }

  next();
};