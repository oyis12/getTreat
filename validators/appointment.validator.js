import mongoose from "mongoose";
import AppError from "../utils/AppError.js";

const rejectUnknown = (body, allowed, label) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new AppError(`${label} must be a JSON object`, 400);
  const unknown = Object.keys(body).filter((key) => !allowed.includes(key));
  if (unknown.length) throw new AppError(`Unknown ${label} field(s): ${unknown.join(", ")}`, 400);
};
const validWindow = (item) => {
  if (!item || typeof item !== "object" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(item.start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(item.end)) return false;
  const minute = (value) => { const [h, m] = value.split(":").map(Number); return h * 60 + m; };
  return minute(item.end) > minute(item.start);
};
const validateWindows = (windows, label) => {
  if (!Array.isArray(windows) || windows.length > 12 || windows.some((item) => !item || Object.keys(item).some((key) => !["start", "end"].includes(key)) || !validWindow(item))) throw new AppError(`${label} must contain valid start/end times`, 400);
  const sorted = [...windows].sort((a, b) => a.start.localeCompare(b.start));
  for (let i = 1; i < sorted.length; i += 1) if (sorted[i].start < sorted[i - 1].end) throw new AppError(`${label} windows cannot overlap`, 400);
};

export const validateAvailabilityPayload = (req, _res, next) => {
  try {
    const body = req.body;
    rejectUnknown(body, ["timezone", "duration_minutes", "fee_amount", "weekly_schedule", "exceptions"], "availability");
    if (typeof body.timezone !== "string" || body.timezone.length > 100) throw new AppError("A valid IANA timezone is required", 400);
    try { new Intl.DateTimeFormat("en", { timeZone: body.timezone }); } catch { throw new AppError("A valid IANA timezone is required", 400); }
    if (![15, 30, 60, 120].includes(body.duration_minutes)) throw new AppError("duration_minutes must be 15, 30, 60 or 120", 400);
    if (typeof body.fee_amount !== "number" || !Number.isFinite(body.fee_amount) || body.fee_amount <= 0 || Math.abs(body.fee_amount * 100 - Math.round(body.fee_amount * 100)) > 1e-7) throw new AppError("fee_amount must be positive NGN with at most two decimal places", 400);
    if (!Array.isArray(body.weekly_schedule) || body.weekly_schedule.length > 7) throw new AppError("weekly_schedule must contain up to seven weekdays", 400);
    const days = new Set();
    for (const day of body.weekly_schedule) {
      if (!day || Object.keys(day).some((key) => !["weekday", "windows"].includes(key)) || !Number.isInteger(day.weekday) || day.weekday < 0 || day.weekday > 6 || days.has(day.weekday)) throw new AppError("Each weekday must be unique and between 0 and 6", 400);
      days.add(day.weekday); validateWindows(day.windows, "weekday windows");
    }
    if (!Array.isArray(body.exceptions) || body.exceptions.length > 100) throw new AppError("exceptions must contain up to 100 dates", 400);
    const dates = new Set();
    for (const exception of body.exceptions) {
      if (!exception || Object.keys(exception).some((key) => !["date", "unavailable", "windows"].includes(key)) || !/^\d{4}-\d{2}-\d{2}$/.test(exception.date) || dates.has(exception.date) || typeof exception.unavailable !== "boolean") throw new AppError("Each exception requires a unique YYYY-MM-DD date and unavailable boolean", 400);
      dates.add(exception.date); validateWindows(exception.windows, "exception windows");
      if (exception.unavailable && exception.windows.length) throw new AppError("Unavailable dates cannot include time windows", 400);
    }
    next();
  } catch (error) { next(error); }
};

export const validateProviderProfileId = (req, _res, next) => {
  try { if (!mongoose.isValidObjectId(req.params.providerProfileId)) throw new AppError("Invalid provider profile ID", 400); next(); } catch (error) { next(error); }
};

export const validateStartAppointment = (req, _res, next) => {
  try {
    rejectUnknown(req.body, ["provider_profile_id", "appointment_type_id", "starts_at", "digital_option", "reason"], "appointment");
    if (!mongoose.isValidObjectId(req.body.provider_profile_id) || !mongoose.isValidObjectId(req.body.appointment_type_id)) throw new AppError("Valid provider_profile_id and appointment_type_id are required", 400);
    if (typeof req.body.starts_at !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.test(req.body.starts_at) || !Number.isFinite(Date.parse(req.body.starts_at))) throw new AppError("starts_at must be an ISO date-time with timezone", 400);
    if (!["video_call", "audio_call", "message"].includes(req.body.digital_option)) throw new AppError("digital_option must be video_call, audio_call or message", 400);
    if (req.body.reason !== undefined && (typeof req.body.reason !== "string" || req.body.reason.trim().length > 1000)) throw new AppError("reason must be a string no longer than 1000 characters", 400);
    const key = req.get("Idempotency-Key");
    if (typeof key !== "string" || !/^[A-Za-z0-9._:-]{8,128}$/.test(key)) throw new AppError("Idempotency-Key header must contain 8 to 128 safe characters", 400);
    req.idempotencyKey = key; next();
  } catch (error) { next(error); }
};

export const validateAppointmentPayment = (req, _res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.appointmentId)) throw new AppError("Invalid appointment ID", 400);
    rejectUnknown(req.body, ["reference"], "payment verification");
    if (typeof req.body.reference !== "string" || req.body.reference.length < 8 || req.body.reference.length > 100) throw new AppError("A valid payment reference is required", 400);
    next();
  } catch (error) { next(error); }
};

export const validateAppointmentId = (req, _res, next) => {
  try { if (!mongoose.isValidObjectId(req.params.appointmentId)) throw new AppError("Invalid appointment ID", 400); next(); } catch (error) { next(error); }
};

export const validateAppointmentDecision = (req, _res, next) => {
  try {
    rejectUnknown(req.body, ["decision", "reason"], "appointment decision");
    if (!["accept", "decline"].includes(req.body.decision)) throw new AppError("decision must be accept or decline", 400);
    if (req.body.reason !== undefined && (typeof req.body.reason !== "string" || req.body.reason.trim().length > 300)) throw new AppError("reason must be a string no longer than 300 characters", 400);
    next();
  } catch (error) { next(error); }
};

export const validateAppointmentCancellation = (req, _res, next) => {
  try {
    rejectUnknown(req.body, ["reason"], "appointment cancellation");
    if (req.body.reason !== undefined && !["patient_cancelled", "rescheduled"].includes(req.body.reason)) throw new AppError("reason must be patient_cancelled or rescheduled", 400);
    next();
  } catch (error) { next(error); }
};

export const validateAppointmentListQuery = (req, _res, next) => {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const filter = req.query.filter ?? "all";
    const allowed = ["all", "upcoming", "recently_booked", "completed", "missed"];
    const unknown = Object.keys(req.query).filter((key) => !["page", "limit", "filter"].includes(key));
    if (unknown.length) throw new AppError(`Unknown appointment query parameter(s): ${unknown.join(", ")}`, 400);
    if (!Number.isInteger(page) || page < 1) throw new AppError("page must be a positive integer", 400);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new AppError("limit must be from 1 to 100", 400);
    if (!allowed.includes(filter)) throw new AppError("filter must be all, upcoming, recently_booked, completed or missed", 400);
    req.appointmentList = { page, limit, filter };
    next();
  } catch (error) { next(error); }
};

export const validateAdminAppointmentListQuery = (req, _res, next) => {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const status = req.query.status;
    const from = req.query.from;
    const to = req.query.to;
    const statuses = ["pending_payment", "pending", "accepted", "declined", "cancelled", "reschedule_pending", "completed", "missed"];
    const unknown = Object.keys(req.query).filter((key) => !["page", "limit", "status", "from", "to"].includes(key));
    if (unknown.length) throw new AppError(`Unknown appointment query parameter(s): ${unknown.join(", ")}`, 400);
    if (!Number.isInteger(page) || page < 1) throw new AppError("page must be a positive integer", 400);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new AppError("limit must be from 1 to 100", 400);
    if (status !== undefined && !statuses.includes(status)) throw new AppError("status is not a supported appointment status", 400);
    for (const [name, value] of [["from", from], ["to", to]]) if (value !== undefined && (!/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value)))) throw new AppError(`${name} must be an ISO date-time`, 400);
    if (from && to && Date.parse(from) > Date.parse(to)) throw new AppError("from must be earlier than or equal to to", 400);
    req.adminAppointmentList = { page, limit, ...(status ? { status } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}) };
    next();
  } catch (error) { next(error); }
};

export const validateAdminAppointmentTypeListQuery = (req, _res, next) => {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const active = req.query.active;
    const unknown = Object.keys(req.query).filter((key) => !["page", "limit", "active"].includes(key));
    if (unknown.length) throw new AppError(`Unknown appointment type query parameter(s): ${unknown.join(", ")}`, 400);
    if (!Number.isInteger(page) || page < 1) throw new AppError("page must be a positive integer", 400);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new AppError("limit must be from 1 to 100", 400);
    if (active !== undefined && !["true", "false"].includes(active)) throw new AppError("active must be true or false", 400);
    req.adminAppointmentTypeList = { page, limit, ...(active === undefined ? {} : { active: active === "true" }) };
    next();
  } catch (error) { next(error); }
};

export const validateAppointmentTypeCreate = (req, _res, next) => {
  try {
    rejectUnknown(req.body, ["name"], "appointment type");
    if (typeof req.body.name !== "string" || req.body.name.trim().length < 2 || req.body.name.trim().length > 100) throw new AppError("name must contain 2 to 100 characters", 400);
    req.body.name = req.body.name.trim();
    next();
  } catch (error) { next(error); }
};

export const validateAppointmentTypeUpdate = (req, _res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.typeId)) throw new AppError("Invalid appointment type ID", 400);
    rejectUnknown(req.body, ["name", "active"], "appointment type");
    if (!Object.keys(req.body).length) throw new AppError("At least one appointment type field is required", 400);
    if (req.body.name !== undefined && (typeof req.body.name !== "string" || req.body.name.trim().length < 2 || req.body.name.trim().length > 100)) throw new AppError("name must contain 2 to 100 characters", 400);
    if (req.body.name !== undefined) req.body.name = req.body.name.trim();
    if (req.body.active !== undefined && typeof req.body.active !== "boolean") throw new AppError("active must be a boolean", 400);
    next();
  } catch (error) { next(error); }
};

export const validateAdminAppointmentCancellation = (req, _res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.appointmentId)) throw new AppError("Invalid appointment ID", 400);
    rejectUnknown(req.body, ["reason"], "appointment cancellation");
    if (typeof req.body.reason !== "string" || req.body.reason.trim().length < 3 || req.body.reason.trim().length > 300) throw new AppError("reason must contain 3 to 300 characters", 400);
    req.body.reason = req.body.reason.trim();
    next();
  } catch (error) { next(error); }
};
