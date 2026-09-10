import AppError from "../utils/AppError.js";

export const authorize = (...allowedRoles) => {
  return (req, _res, next) => {
    try {
      if (!req.user) {
        throw new AppError(
          "Authentication required",
          401
        );
      }

      if (!allowedRoles.includes(req.user.role)) {
        throw new AppError(
          "You do not have permission to access this resource",
          403
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};


export const patientOnly = authorize("patient");

export const providerOnly = authorize("provider");

export const adminOnly = authorize("admin", "super_admin");

export const superAdminOnly = authorize("super_admin");

export default authorize;