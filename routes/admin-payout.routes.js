import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { adminOnly } from "../middlewares/role.middleware.js";
import { requireAdminPermission } from "../middlewares/admin-permission.middleware.js";
import {
  approvePayout, finalizePayoutTransfer, getAdminPayout, listAdminPayouts,
  reconcilePayout, rejectPayout, retryPayout,
} from "../controllers/provider-payout.controller.js";
import { validatePayoutDecision, validatePayoutFinalize, validatePayoutId, validatePayoutListQuery } from "../validators/financial.validator.js";

const router = express.Router();
router.use(protect, adminOnly, requireAdminPermission("manage_transactions"));
router.get("/", validatePayoutListQuery, listAdminPayouts);
router.get("/:payoutId", validatePayoutId, getAdminPayout);
router.post("/:payoutId/approve", validatePayoutId, validatePayoutDecision, approvePayout);
router.post("/:payoutId/reject", validatePayoutId, validatePayoutDecision, rejectPayout);
router.post("/:payoutId/retry", validatePayoutId, retryPayout);
router.post("/:payoutId/finalize-transfer", validatePayoutId, validatePayoutFinalize, finalizePayoutTransfer);
router.post("/:payoutId/reconcile-transfer", validatePayoutId, reconcilePayout);

export default router;
