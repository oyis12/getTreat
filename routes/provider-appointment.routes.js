import express from "express";
import { getProviderAvailability, setMyProviderAvailability, listMyProviderAppointments, decideProviderAppointment } from "../controllers/appointment.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { providerOnly } from "../middlewares/role.middleware.js";
import { validateAvailabilityPayload, validateAppointmentId, validateAppointmentDecision, validateAppointmentListQuery } from "../validators/appointment.validator.js";
import ProviderProfile from "../models/provider-profile.model.js";
import AppError from "../utils/AppError.js";

const router = express.Router();
router.use(protect, providerOnly);
router.get("/availability", async (req, res, next) => {
  try {
    const profile = await ProviderProfile.findOne({ user: req.user._id }).select("_id");
    if (!profile) throw new AppError("Provider profile not found", 404);
    req.params.providerProfileId = profile._id.toString();
    return getProviderAvailability(req, res, next);
  } catch (error) { next(error); }
});
router.put("/availability", validateAvailabilityPayload, setMyProviderAvailability);
router.get("/appointments", validateAppointmentListQuery, listMyProviderAppointments);
router.patch("/appointments/:appointmentId/decision", validateAppointmentId, validateAppointmentDecision, decideProviderAppointment);
export default router;
