import { connectDB, closeDB } from "../config/db.js";
import ProviderSubscription from "../models/provider-subscription.model.js";
import ProviderPaymentAttempt from "../models/provider-payment-attempt.model.js";
import PaymentAuthorization from "../models/payment-authorization.model.js";
import PaystackWebhookEvent from "../models/paystack-webhook-event.model.js";

if (process.env.CREATE_PROVIDER_BILLING_INDEXES !== "true") {
  console.error("Set CREATE_PROVIDER_BILLING_INDEXES=true after confirming MONGO_URI points to the intended database.");
  process.exit(1);
}

try {
  await connectDB();
  for (const model of [ProviderSubscription, ProviderPaymentAttempt, PaymentAuthorization, PaystackWebhookEvent]) {
    await model.createIndexes();
    console.log(`Indexes ensured for ${model.collection.collectionName}`);
  }
} catch (error) {
  console.error("Provider billing index migration failed:", error.message);
  process.exitCode = 1;
} finally {
  await closeDB();
}
