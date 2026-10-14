import mongoose from "mongoose";
import AppError from "../utils/AppError.js";
import { providerProfessionalFields } from "../models/provider-profile.model.js";

const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);

const rejectUnknownFields = (body, allowed, label) => {
  if (!isObject(body)) throw new AppError(`${label} must be a JSON object`, 400);
  const unknownFields = Object.keys(body).filter((field) => !allowed.includes(field));
  if (unknownFields.length) {
    throw new AppError(`Unknown ${label} field(s): ${unknownFields.join(", ")}`, 400);
  }
};

export const validateProviderProfilePayload = (req, _res, next) => {
  try {
    const allowed = ["professional_field", "professional_field_other", "years_experience", "bio", "country", "state", "address", "credentials_valid", "regulations_agreed", "professional_data_consent"];
    rejectUnknownFields(req.body, allowed, "provider profile");
    if (!providerProfessionalFields.includes(req.body.professional_field)) {
      throw new AppError("Select a valid professional field", 400);
    }
    const years = Number(req.body.years_experience);
    if (!Number.isInteger(years) || years < 0 || years > 80) throw new AppError("years_experience must be an integer from 0 to 80", 400);
    for (const field of ["bio", "country", "state", "address"]) {
      if (typeof req.body[field] !== "string" || !req.body[field].trim()) throw new AppError(`${field} is required`, 400);
    }
    if (req.body.bio.trim().length > 300) throw new AppError("bio must not exceed 300 characters", 400);
    if (req.body.country.trim().length > 100 || req.body.state.trim().length > 100 || req.body.address.trim().length > 250) throw new AppError("Provider location fields exceed their maximum length", 400);
    if (req.body.professional_field === "others" && (typeof req.body.professional_field_other !== "string" || !req.body.professional_field_other.trim() || req.body.professional_field_other.trim().length > 120)) {
      throw new AppError("professional_field_other is required for the Others field", 400);
    }
    for (const field of ["credentials_valid", "regulations_agreed", "professional_data_consent"]) {
      const value = req.body[field];
      if (![true, "true", "on", "1"].includes(value)) throw new AppError(`${field} consent is required`, 400);
      req.body[field] = true;
    }
    req.body.years_experience = years;
    next();
  } catch (error) {
    next(error);
  }
};

export const validateProviderApprovalPayload = (req, _res, next) => {
  try {
    rejectUnknownFields(req.body, ["approval_status"], "provider approval");
    if (!["approved", "rejected"].includes(req.body.approval_status)) {
      throw new AppError("approval_status must be approved or rejected", 400);
    }
    if (!mongoose.isValidObjectId(req.params.providerProfileId)) {
      throw new AppError("Invalid provider profile ID", 400);
    }
    next();
  } catch (error) {
    next(error);
  }
};

export const validateProviderPatientParams = (req, _res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.patientId)) {
      throw new AppError("Invalid patient ID", 400);
    }
    next();
  } catch (error) {
    next(error);
  }
};

export const validateCreateProviderInstruction = (req, _res, next) => {
  try {
    rejectUnknownFields(req.body, ["instruction", "prescription"], "instruction");

    if (typeof req.body.instruction !== "string" || !req.body.instruction.trim()) {
      throw new AppError("instruction is required", 400);
    }
    if (req.body.instruction.trim().length > 10000) {
      throw new AppError("instruction must not exceed 10000 characters", 400);
    }
    if (
      req.body.prescription !== undefined &&
      req.body.prescription !== null &&
      typeof req.body.prescription !== "string"
    ) {
      throw new AppError("prescription must be a string or null", 400);
    }
    if (typeof req.body.prescription === "string" && req.body.prescription.length > 10000) {
      throw new AppError("prescription must not exceed 10000 characters", 400);
    }
    if (!mongoose.isValidObjectId(req.params.patientId)) {
      throw new AppError("Invalid patient ID", 400);
    }
    next();
  } catch (error) {
    next(error);
  }
};

export const validateProviderPatientListQuery = (req, _res, next) => {
  try {
    const { page = "1", limit = "20", status = "all" } = req.query;
    if (!/^\d+$/.test(String(page)) || Number(page) < 1) {
      throw new AppError("page must be a positive integer", 400);
    }
    if (!/^\d+$/.test(String(limit)) || Number(limit) < 1 || Number(limit) > 100) {
      throw new AppError("limit must be an integer from 1 to 100", 400);
    }
    if (!["all", "active", "expired"].includes(status)) {
      throw new AppError("status must be all, active, or expired", 400);
    }
    req.pagination = { page: Number(page), limit: Number(limit), status };
    next();
  } catch (error) {
    next(error);
  }
};

export const validateProviderProfileListQuery = (req, _res, next) => {
  try {
    const { page = "1", limit = "20", approval_status = "pending" } = req.query;
    if (!/^\d+$/.test(String(page)) || Number(page) < 1) {
      throw new AppError("page must be a positive integer", 400);
    }
    if (!/^\d+$/.test(String(limit)) || Number(limit) < 1 || Number(limit) > 100) {
      throw new AppError("limit must be an integer from 1 to 100", 400);
    }
    if (!["all", "pending", "approved", "rejected"].includes(approval_status)) {
      throw new AppError("approval_status must be all, pending, approved, or rejected", 400);
    }
    req.pagination = { page: Number(page), limit: Number(limit) };
    req.approvalStatus = approval_status === "all" ? null : approval_status;
    next();
  } catch (error) {
    next(error);
  }
};

export const validatePaginationQuery = (req, _res, next) => {
  try {
    const { page = "1", limit = "20" } = req.query;
    if (!/^\d+$/.test(String(page)) || Number(page) < 1) {
      throw new AppError("page must be a positive integer", 400);
    }
    if (!/^\d+$/.test(String(limit)) || Number(limit) < 1 || Number(limit) > 100) {
      throw new AppError("limit must be an integer from 1 to 100", 400);
    }
    req.pagination = { page: Number(page), limit: Number(limit) };
    next();
  } catch (error) {
    next(error);
  }
};

export const validateProviderInstructionId = (req, _res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.instructionId)) {
      throw new AppError("Invalid instruction ID", 400);
    }
    next();
  } catch (error) {
    next(error);
  }
};

const providerServiceFields = ["title", "original_price", "discount_percent", "billing_cycle"];

export const validateProviderServicePayload = (req, _res, next) => {
  try {
    rejectUnknownFields(req.body, providerServiceFields, "provider service");
    const partial = req.method === "PATCH";
    if (!partial && (!req.body.title || req.body.original_price === undefined || !req.body.billing_cycle)) {
      throw new AppError("title, original_price, and billing_cycle are required", 400);
    }
    if (partial && Object.keys(req.body).length === 0) throw new AppError("At least one provider service field is required", 400);
    if (req.body.title !== undefined && (typeof req.body.title !== "string" || !req.body.title.trim() || req.body.title.trim().length > 150)) {
      throw new AppError("title must contain 1 to 150 characters", 400);
    }
    if (req.body.original_price !== undefined) {
      const amount = Number(req.body.original_price);
      if (!Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) !== amount * 100) throw new AppError("original_price must be a positive amount with at most two decimal places", 400);
      req.body.original_price = amount;
    }
    if (req.body.discount_percent !== undefined) {
      const discount = Number(req.body.discount_percent);
      if (!Number.isFinite(discount) || discount < 0 || discount >= 100 || Math.round(discount * 100) !== discount * 100) throw new AppError("discount_percent must be from 0 up to, but not including, 100", 400);
      req.body.discount_percent = discount;
    }
    if (req.body.billing_cycle !== undefined && !["monthly", "quarterly", "yearly"].includes(req.body.billing_cycle)) {
      throw new AppError("billing_cycle must be monthly, quarterly, or yearly", 400);
    }
    if (req.body.title !== undefined) req.body.title = req.body.title.trim();
    next();
  } catch (error) { next(error); }
};

export const validateProviderServiceId = (req, _res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.serviceId)) throw new AppError("Invalid provider service ID", 400);
    next();
  } catch (error) { next(error); }
};

export const validatePatientProviderServiceQuery = (req, _res, next) => {
  try {
    const { page = "1", limit = "20", search = "", professional_field, discount_only = "false" } = req.query;
    if (!/^\d+$/.test(String(page)) || Number(page) < 1) throw new AppError("page must be a positive integer", 400);
    if (!/^\d+$/.test(String(limit)) || Number(limit) < 1 || Number(limit) > 100) throw new AppError("limit must be an integer from 1 to 100", 400);
    if (typeof search !== "string" || search.length > 100) throw new AppError("search must not exceed 100 characters", 400);
    if (professional_field && !providerProfessionalFields.includes(professional_field)) throw new AppError("Select a valid professional_field", 400);
    if (!["true", "false"].includes(String(discount_only))) throw new AppError("discount_only must be true or false", 400);
    req.providerServiceQuery = { page: Number(page), limit: Number(limit), search: search.trim(), professionalField: professional_field || null, discountOnly: String(discount_only) === "true", providerProfileId: req.params.providerProfileId || null };
    next();
  } catch (error) { next(error); }
};
