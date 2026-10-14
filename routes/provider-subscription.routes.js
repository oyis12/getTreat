import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { requireActivePlatformSubscription } from "../middlewares/platform-subscription.middleware.js";
import { patientOnly } from "../middlewares/role.middleware.js";
import {
  getMyProviderSubscription,
  listMyProviderSubscriptions,
  receivePaystackWebhook,
  setMyProviderSubscriptionAutoRenew,
  startProviderSubscription,
  verifyMyProviderSubscriptionPayment,
} from "../controllers/provider-subscription.controller.js";
import {
  validateAutoRenew,
  validatePaymentVerification,
  validateProviderSubscriptionId,
  validateStartProviderSubscription,
  validateSubscriptionListQuery,
} from "../validators/provider-subscription.validator.js";

const router = express.Router();
const webhookRouter = express.Router();

router.use(protect, patientOnly, requireActivePlatformSubscription);
router.get("/", validateSubscriptionListQuery, listMyProviderSubscriptions);
router.post("/", validateStartProviderSubscription, startProviderSubscription);
router.get("/:subscriptionId", validateProviderSubscriptionId, getMyProviderSubscription);
router.patch("/:subscriptionId/auto-renew", validateProviderSubscriptionId, validateAutoRenew, setMyProviderSubscriptionAutoRenew);
router.post("/:subscriptionId/verify-payment", validateProviderSubscriptionId, validatePaymentVerification, verifyMyProviderSubscriptionPayment);

webhookRouter.post("/paystack/webhook", receivePaystackWebhook);

export { webhookRouter as paystackWebhookRouter };
export default router;
