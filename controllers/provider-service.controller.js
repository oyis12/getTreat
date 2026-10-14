import * as service from "../services/provider-service.service.js";
import { sendSuccess } from "../utils/response.js";

const userId = (req) => req.user?._id?.toString?.() ?? req.user?.id;

export const getMyProviderServices = async (req, res, next) => {
  try {
    return sendSuccess(res, { statusCode: 200, msg: "Provider services retrieved successfully", data: await service.listMyProviderServices(userId(req)) });
  } catch (error) { next(error); }
};

export const createMyProviderService = async (req, res, next) => {
  try {
    return sendSuccess(res, { statusCode: 201, msg: "Provider service created successfully", data: await service.createProviderService(userId(req), req.body) });
  } catch (error) { next(error); }
};

export const updateMyProviderService = async (req, res, next) => {
  try {
    return sendSuccess(res, { statusCode: 200, msg: "Provider service updated successfully", data: await service.updateProviderService(userId(req), req.params.serviceId, req.body) });
  } catch (error) { next(error); }
};

export const archiveMyProviderService = async (req, res, next) => {
  try {
    return sendSuccess(res, { statusCode: 200, msg: "Provider service archived successfully", data: await service.archiveProviderService(userId(req), req.params.serviceId) });
  } catch (error) { next(error); }
};

export const getPatientProviderServices = async (req, res, next) => {
  try {
    return sendSuccess(res, { statusCode: 200, msg: "Provider services retrieved successfully", data: await service.listPatientProviderServices(req.providerServiceQuery) });
  } catch (error) { next(error); }
};
