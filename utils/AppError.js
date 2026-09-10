class AppError extends Error {
  constructor(message, statusCode = 500, data = null) {
    super(message);

    this.name = "AppError";
    this.statusCode = statusCode;
    this.data = data;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;