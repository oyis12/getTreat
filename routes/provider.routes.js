import express from "express";
import {
  createProviderInstruction,
  listProviderPatientInstructions,
  listProviderPatients,
} from "../controllers/provider-instruction.controller.js";
import {
  archiveMyProviderService,
  createMyProviderService,
  getMyProviderServices,
  updateMyProviderService,
} from "../controllers/provider-service.controller.js";
import {
  getMyProviderProfile,
  submitMyProviderProfile,
} from "../controllers/provider-profile.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { providerOnly } from "../middlewares/role.middleware.js";
import { uploadProviderRegistrationFiles } from "../middlewares/provider-upload.middleware.js";
import {
  validateCreateProviderInstruction,
  validatePaginationQuery,
  validateProviderPatientListQuery,
  validateProviderPatientParams,
  validateProviderProfilePayload,
  validateProviderServiceId,
  validateProviderServicePayload,
} from "../validators/provider.validator.js";
import providerTransactionRoutes from "./provider-transaction.routes.js";
import providerPayoutRoutes from "./provider-payout.routes.js";

const router = express.Router();

router.use(protect, providerOnly);

router.get("/me/profile", getMyProviderProfile);
router.use("/me/transactions", providerTransactionRoutes);
router.use("/me", providerPayoutRoutes);
router.put("/me/profile", uploadProviderRegistrationFiles, validateProviderProfilePayload, submitMyProviderProfile);
router.get("/me/services", getMyProviderServices);
router.post("/me/services", validateProviderServicePayload, createMyProviderService);
router.patch("/me/services/:serviceId", validateProviderServiceId, validateProviderServicePayload, updateMyProviderService);
router.delete("/me/services/:serviceId", validateProviderServiceId, archiveMyProviderService);
router.get("/me/patients", validateProviderPatientListQuery, listProviderPatients);
router.get(
  "/patients/:patientId/instructions",
  validateProviderPatientParams,
  validatePaginationQuery,
  listProviderPatientInstructions
);
router.post(
  "/patients/:patientId/instructions",
  validateCreateProviderInstruction,
  createProviderInstruction
);

export default router;
