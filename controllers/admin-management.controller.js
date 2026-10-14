import * as adminService from '../services/admin-management.service.js';
import { sendSuccess } from '../utils/response.js';

const actorId = (req) => req.user?._id?.toString?.() ?? req.user?.id;

export const createAdmin = async (req, res, next) => {
  try {
    const data = await adminService.createAdminAccount(req.body, actorId(req));
    return sendSuccess(res, { statusCode: 201, msg: 'Admin account created. The admin must verify their email before signing in.', data });
  } catch (error) { next(error); }
};

export const listAdmins = async (req, res, next) => {
  try {
    const data = await adminService.listAdminAccounts(req.adminListQuery);
    return sendSuccess(res, { statusCode: 200, msg: 'Admin accounts retrieved successfully', data });
  } catch (error) { next(error); }
};

export const updateAdmin = async (req, res, next) => {
  try {
    const data = await adminService.updateAdminAccount(req.params.adminProfileId, req.body, actorId(req));
    return sendSuccess(res, { statusCode: 200, msg: 'Admin account updated successfully', data });
  } catch (error) { next(error); }
};
