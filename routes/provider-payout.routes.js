import express from "express";
import {
  createPayoutMethod, deletePayoutMethod, getEarnings, getProviderPayout, listBanks,
  listPayoutMethods, listProviderPayouts, requestPayout, resolveBankAccount, setDefaultPayoutMethod,
} from "../controllers/provider-payout.controller.js";
import {
  validatePayoutId, validatePayoutListQuery, validatePayoutMethodBody,
  validatePayoutMethodId, validatePayoutMethodResolution, validatePayoutRequest,
} from "../validators/financial.validator.js";

const router = express.Router();
router.get("/earnings", getEarnings);
router.get("/payout-methods/banks", listBanks);
router.post("/payout-methods/resolve", validatePayoutMethodResolution, resolveBankAccount);
router.get("/payout-methods", listPayoutMethods);
router.post("/payout-methods", validatePayoutMethodBody, createPayoutMethod);
router.patch("/payout-methods/:methodId/default", validatePayoutMethodId, setDefaultPayoutMethod);
router.delete("/payout-methods/:methodId", validatePayoutMethodId, deletePayoutMethod);
router.get("/payouts", validatePayoutListQuery, listProviderPayouts);
router.post("/payouts", validatePayoutRequest, requestPayout);
router.get("/payouts/:payoutId", validatePayoutId, getProviderPayout);

export default router;
