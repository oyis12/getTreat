import User from "../models/user.model.js";
import AppError from "../utils/AppError.js";
import { verifyAccessToken } from "../utils/jwt.js";


const extractBearerToken = (req) => {
  const authorization = req.headers.authorization;

  if (!authorization) {
    return null;
  }

  const [scheme, token] =
    authorization.split(" ");

  if (
    !scheme ||
    scheme.toLowerCase() !== "bearer" ||
    !token
  ) {
    return null;
  }

  return token;
};

export const protect = async (
  req,
  _res,
  next
) => {
  try {
    const token = extractBearerToken(req);

    if (!token) {
      throw new AppError(
        "Authentication required",
        401
      );
    }

    let decoded;

    try {
      decoded = verifyAccessToken(token);
    } catch (error) {
      throw error;
    }

    if (
      !decoded ||
      decoded.type !== "access" ||
      !decoded.sub
    ) {
      throw new AppError(
        "Invalid authentication token",
        401
      );
    }

    const user = await User.findById(decoded.sub);

    if (!user) {
      throw new AppError(
        "User account not found",
        401
      );
    }

    if (user.accountStatus === "suspended") {
      throw new AppError(
        "Your account has been suspended",
        403
      );
    }

    if (user.accountStatus === "deactivated") {
      throw new AppError(
        "Your account has been deactivated",
        403
      );
    }

    req.user = user;

    next();
  } catch (error) {
    next(error);
  }
};

export default protect;