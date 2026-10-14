import express from "express";
import {
  listProvidersForReview,
  reviewProvider,
} from "../controllers/admin-provider.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { adminOnly } from "../middlewares/role.middleware.js";
import { requireAdminPermission } from "../middlewares/admin-permission.middleware.js";
import {
  validateProviderApprovalPayload,
  validateProviderProfileListQuery,
} from "../validators/provider.validator.js";

const router = express.Router();

router.use(protect, adminOnly, requireAdminPermission("manage_providers"));
router.get("/", validateProviderProfileListQuery, listProvidersForReview);
router.patch(
  "/:providerProfileId/approval",
  validateProviderApprovalPayload,
  reviewProvider
);

export default router;
