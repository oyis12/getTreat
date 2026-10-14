import * as providerInstructionService from "../services/provider-instruction.service.js";
import AppError from "../utils/AppError.js";
import { sendSuccess } from "../utils/response.js";

const getUser = (req) => req.user;
const getUserId = (req) => req.user?._id?.toString?.() ?? req.user?.id;

export const listProviderPatients = async (req, res, next) => {
  try {
    const data = await providerInstructionService.listProviderPatients(
      getUserId(req),
      req.pagination
    );
    return sendSuccess(res, {
      statusCode: 200,
      msg: "Provider patients retrieved successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const listProviderPatientInstructions = async (req, res, next) => {
  try {
    const data = await providerInstructionService.listProviderPatientInstructions(
      getUser(req),
      req.params.patientId,
      req.pagination
    );
    return sendSuccess(res, {
      statusCode: 200,
      msg: "Patient provider instructions retrieved successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const createProviderInstruction = async (req, res, next) => {
  try {
    const data = await providerInstructionService.createProviderInstruction(
      getUser(req),
      req.params.patientId,
      req.body
    );
    return sendSuccess(res, {
      statusCode: 201,
      msg: "Provider instruction sent successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const listMyProviderInstructions = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) throw new AppError("Authentication required", 401);
    const data = await providerInstructionService.listCurrentPatientInstructions(
      userId,
      req.pagination
    );
    return sendSuccess(res, {
      statusCode: 200,
      msg: "Provider instructions retrieved successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getMyProviderInstruction = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) throw new AppError("Authentication required", 401);
    const data = await providerInstructionService.getCurrentPatientInstruction(
      userId,
      req.params.instructionId
    );
    return sendSuccess(res, {
      statusCode: 200,
      msg: "Provider instruction retrieved successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};
