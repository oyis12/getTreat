import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { patientOnly } from "../middlewares/role.middleware.js";
import { getPatientTransaction, listPatientTransactions } from "../controllers/transaction.controller.js";
import { validateTransactionId, validateTransactionListQuery } from "../validators/transaction.validator.js";

const router = express.Router();
router.use(protect, patientOnly);
router.get("/", validateTransactionListQuery, listPatientTransactions);
router.get("/:transactionId", validateTransactionId, getPatientTransaction);

export default router;
