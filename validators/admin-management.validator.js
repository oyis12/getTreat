import mongoose from 'mongoose';
import AppError from '../utils/AppError.js';
import { adminPermissionKeys } from '../models/admin-profile.model.js';

const rejectUnknown = (value, allowed, label) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AppError(`${label} must be a JSON object`, 400);
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length) throw new AppError(`Unknown ${label} field(s): ${unknown.join(', ')}`, 400);
};

const validatePermissions = (permissions, { required = false } = {}) => {
  if (permissions === undefined && !required) return;
  rejectUnknown(permissions, adminPermissionKeys, 'permissions');
  if (required && !Object.keys(permissions).length) throw new AppError('At least one permission must be specified', 400);
  for (const [key, value] of Object.entries(permissions)) {
    if (typeof value !== 'boolean') throw new AppError(`permissions.${key} must be a boolean`, 400);
  }
};

export const validateCreateAdmin = (req, _res, next) => {
  try {
    rejectUnknown(req.body, ['fullname', 'email', 'password', 'permissions'], 'admin account');
    const { fullname, email, password, permissions } = req.body;
    if (typeof fullname !== 'string' || fullname.trim().length < 2 || fullname.trim().length > 100) throw new AppError('fullname must be between 2 and 100 characters', 400);
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new AppError('A valid email is required', 400);
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) throw new AppError('password must be between 8 and 128 characters', 400);
    validatePermissions(permissions, { required: true });
    req.body.fullname = fullname.trim();
    req.body.email = email.trim().toLowerCase();
    next();
  } catch (error) { next(error); }
};

export const validateAdminListQuery = (req, _res, next) => {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const search = req.query.search ?? '';
    if (!Number.isInteger(page) || page < 1) throw new AppError('page must be a positive integer', 400);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new AppError('limit must be an integer from 1 to 100', 400);
    if (typeof search !== 'string' || search.length > 100) throw new AppError('search must be a string no longer than 100 characters', 400);
    const unknown = Object.keys(req.query).filter((key) => !['page', 'limit', 'search'].includes(key));
    if (unknown.length) throw new AppError(`Unknown query parameter(s): ${unknown.join(', ')}`, 400);
    req.adminListQuery = { page, limit, search };
    next();
  } catch (error) { next(error); }
};

export const validateUpdateAdmin = (req, _res, next) => {
  try {
    rejectUnknown(req.body, ['permissions', 'account_status'], 'admin update');
    if (!mongoose.isValidObjectId(req.params.adminProfileId)) throw new AppError('Invalid admin profile ID', 400);
    if (req.body.permissions !== undefined) validatePermissions(req.body.permissions, { required: true });
    if (req.body.account_status !== undefined && !['active', 'suspended', 'deactivated'].includes(req.body.account_status)) {
      throw new AppError('account_status must be active, suspended, or deactivated', 400);
    }
    if (req.body.permissions === undefined && req.body.account_status === undefined) throw new AppError('Provide permissions or account_status to update', 400);
    next();
  } catch (error) { next(error); }
};
