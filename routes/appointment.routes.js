import express from "express";
import { startPatientAppointment, verifyMyAppointmentPayment, listMyPatientAppointments, cancelMyAppointment } from "../controllers/appointment.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { patientOnly } from "../middlewares/role.middleware.js";
import { validateStartAppointment, validateAppointmentPayment, validateAppointmentId, validateAppointmentCancellation, validateAppointmentListQuery } from "../validators/appointment.validator.js";

const router = express.Router();
router.use(protect, patientOnly);
router.get("/", validateAppointmentListQuery, listMyPatientAppointments);
router.post("/", validateStartAppointment, startPatientAppointment);
router.post("/:appointmentId/verify-payment", validateAppointmentPayment, verifyMyAppointmentPayment);
router.post("/:appointmentId/cancel", validateAppointmentId, validateAppointmentCancellation, cancelMyAppointment);
export default router;
