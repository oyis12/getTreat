import express from "express";
import { getPatientProviderServices } from "../controllers/provider-service.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { patientOnly } from "../middlewares/role.middleware.js";
import { validatePatientProviderServiceQuery } from "../validators/provider.validator.js";
import { requireActivePlatformSubscription } from "../middlewares/platform-subscription.middleware.js";

const router = express.Router();
router.use(protect, patientOnly, requireActivePlatformSubscription);
router.get("/services", validatePatientProviderServiceQuery, getPatientProviderServices);
router.get("/:providerProfileId/services", validatePatientProviderServiceQuery, getPatientProviderServices);

export default router;
