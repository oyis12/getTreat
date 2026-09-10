import mongoose from "mongoose";
import { sendError } from "../utils/response.js";

const handleValidationError = (error) => {
  const messages = Object.values(error.errors).map(
    (item) => item.message
  );

  return {
    statusCode: 400,
    msg: messages.join(", "),
  };
};

const handleDuplicateKeyError = (error) => {
  const field = Object.keys(error.keyPattern || {})[0];

  return {
    statusCode: 409,
    msg: field
      ? `${field} already exists`
      : "A record with the provided information already exists",
  };
};

const handleJwtError = (error) => {
  if (error.name === "TokenExpiredError") {
    return {
      statusCode: 401,
      msg: "Authentication token has expired",
    };
  }

  return {
    statusCode: 401,
    msg: "Invalid authentication token",
  };
};

export const errorMiddleware = (
  error,
  req,
  res,
  _next
) => {
  console.error("❌ GetTreat API Error:", {
    name: error.name,
    message: error.message,
    path: req.originalUrl,
    method: req.method,
    stack:
      process.env.NODE_ENV !== "production"
        ? error.stack
        : undefined,
  });


  if (error.isOperational) {
    return sendError(res, {
      statusCode: error.statusCode || 500,
      msg: error.message,
      data: error.data || null,
    });
  }


  if (error instanceof mongoose.Error.ValidationError) {
    const result = handleValidationError(error);

    return sendError(res, {
      statusCode: result.statusCode,
      msg: result.msg,
    });
  }


  if (error.code === 11000) {
    const result = handleDuplicateKeyError(error);

    return sendError(res, {
      statusCode: result.statusCode,
      msg: result.msg,
    });
  }


  if (error instanceof mongoose.Error.CastError) {
    return sendError(res, {
      statusCode: 400,
      msg: `Invalid ${error.path}`,
    });
  }


  if (
    error.name === "JsonWebTokenError" ||
    error.name === "TokenExpiredError"
  ) {
    const result = handleJwtError(error);

    return sendError(res, {
      statusCode: result.statusCode,
      msg: result.msg,
    });
  }

  return sendError(res, {
    statusCode: 500,
    msg:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : error.message || "Internal server error",
  });
};

export default errorMiddleware;