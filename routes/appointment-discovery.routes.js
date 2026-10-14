import express from "express";
import { listAppointmentTypes, getProviderAvailability } from "../controllers/appointment.controller.js";
import { validateProviderProfileId } from "../validators/appointment.validator.js";

const router = express.Router();
router.get("/types", listAppointmentTypes);
router.get("/providers/:providerProfileId/availability", validateProviderProfileId, getProviderAvailability);
export default router;
