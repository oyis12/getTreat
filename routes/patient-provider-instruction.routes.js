import express from "express";
import {
  getMyProviderInstruction,
  listMyProviderInstructions,
} from "../controllers/provider-instruction.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { patientOnly } from "../middlewares/role.middleware.js";
import {
  validatePaginationQuery,
  validateProviderInstructionId,
} from "../validators/provider.validator.js";
import { requireActivePlatformSubscription } from "../middlewares/platform-subscription.middleware.js";

const router = express.Router();

router.use(protect, patientOnly, requireActivePlatformSubscription);
router.get("/me/provider-instructions", validatePaginationQuery, listMyProviderInstructions);
router.get(
  "/me/provider-instructions/:instructionId",
  validateProviderInstructionId,
  getMyProviderInstruction
);

export default router;
