import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { adminOnly } from "../middlewares/role.middleware.js";
import { requireAdminPermission } from "../middlewares/admin-permission.middleware.js";
import { getAdminTransaction, listAdminTransactions } from "../controllers/transaction.controller.js";
import { validateTransactionId, validateTransactionListQuery } from "../validators/transaction.validator.js";

const router = express.Router();
router.use(protect, adminOnly, requireAdminPermission("manage_transactions"));
router.get("/", validateTransactionListQuery, listAdminTransactions);
router.get("/:transactionId", validateTransactionId, getAdminTransaction);

export default router;
