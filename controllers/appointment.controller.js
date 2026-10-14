import * as appointments from "../services/appointment.service.js";
import { sendSuccess } from "../utils/response.js";

const userId = (req) => req.user?._id?.toString?.() ?? req.user?.id;
export const listAppointmentTypes = async (_req, res, next) => {
  try { return sendSuccess(res, { msg: "Appointment types retrieved successfully", data: await appointments.listAppointmentTypes() }); } catch (error) { next(error); }
};
export const getProviderAvailability = async (req, res, next) => {
  try { return sendSuccess(res, { msg: "Provider availability retrieved successfully", data: await appointments.getProviderAvailability(req.params.providerProfileId) }); } catch (error) { next(error); }
};
export const setMyProviderAvailability = async (req, res, next) => {
  try { return sendSuccess(res, { msg: "Provider availability saved successfully", data: await appointments.setMyProviderAvailability(userId(req), req.body) }); } catch (error) { next(error); }
};
export const startPatientAppointment = async (req, res, next) => {
  try {
    const result = await appointments.startPatientAppointment(userId(req), req.body, req.idempotencyKey);
    return sendSuccess(res, { statusCode: result.reused ? 200 : 201, msg: result.reused ? "Appointment checkout retrieved successfully" : "Appointment checkout initialized successfully", data: result.appointment });
  } catch (error) { next(error); }
};
export const verifyMyAppointmentPayment = async (req, res, next) => {
  try { return sendSuccess(res, { msg: "Appointment payment status retrieved successfully", data: await appointments.verifyMyAppointmentPayment(userId(req), req.params.appointmentId, req.body.reference) }); } catch (error) { next(error); }
};
export const listMyPatientAppointments = async (req, res, next) => {
  try { return sendSuccess(res, { msg: "Appointments retrieved successfully", data: await appointments.listMyAppointments(userId(req), "patient", req.appointmentList) }); } catch (error) { next(error); }
};
export const listMyProviderAppointments = async (req, res, next) => {
  try { return sendSuccess(res, { msg: "Appointments retrieved successfully", data: await appointments.listMyAppointments(userId(req), "provider", req.appointmentList) }); } catch (error) { next(error); }
};
export const decideProviderAppointment = async (req, res, next) => {
  try {
    const data = await appointments.decideProviderAppointment(userId(req), req.params.appointmentId, req.body.decision, req.body.reason);
    return sendSuccess(res, { msg: `Appointment ${req.body.decision === "accept" ? "accepted" : "declined"} successfully`, data });
  } catch (error) { next(error); }
};
export const cancelMyAppointment = async (req, res, next) => {
  try { return sendSuccess(res, { msg: "Appointment cancellation processed", data: await appointments.cancelMyAppointment(userId(req), req.params.appointmentId, req.body.reason) }); } catch (error) { next(error); }
};
