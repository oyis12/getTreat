import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { providerOnly } from "../middlewares/role.middleware.js";
import { getProviderTransaction, listProviderTransactions } from "../controllers/transaction.controller.js";
import { validateTransactionId, validateTransactionListQuery } from "../validators/transaction.validator.js";

const router = express.Router();
router.use(protect, providerOnly);
router.get("/", validateTransactionListQuery, listProviderTransactions);
router.get("/:transactionId", validateTransactionId, getProviderTransaction);

export default router;
