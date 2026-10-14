import AppError from '../utils/AppError.js';
import { hasAdminPermission } from '../services/admin-management.service.js';

export const requireAdminPermission = (permission) => async (req, _res, next) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    if (req.user.role === 'super_admin') return next();
    if (req.user.role !== 'admin') throw new AppError('You do not have permission to access this resource', 403);
    if (!(await hasAdminPermission(req.user._id, permission))) {
      throw new AppError('Your admin account does not have permission for this action', 403);
    }
    next();
  } catch (error) {
    next(error);
  }
};
