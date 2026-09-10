export const sendSuccess = (
  res,
  {
    statusCode = 200,
    msg = "Success",
    data = null,
  } = {}
) => {
  return res.status(statusCode).json({
    success: true,
    msg,
    data,
  });
};

export const sendError = (
  res,
  {
    statusCode = 500,
    msg = "Internal server error",
    data = null,
  } = {}
) => {
  return res.status(statusCode).json({
    success: false,
    msg,
    data,
  });
};

export default {
  sendSuccess,
  sendError,
};