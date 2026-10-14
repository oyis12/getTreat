import { connectDB, closeDB } from "../config/db.js";
import {
  processPendingPaystackWebhooks,
  runDueProviderRenewals,
} from "../services/provider-subscription.service.js";

try {
  await connectDB();
  const webhookEvents = await processPendingPaystackWebhooks(100);
  const renewalAttempts = await runDueProviderRenewals(100);
  console.log(`Provider billing worker completed: ${webhookEvents} webhook events, ${renewalAttempts} renewal attempts`);
  await closeDB();
} catch (error) {
  console.error("Provider billing worker failed:", error.message);
  await closeDB();
  process.exitCode = 1;
}
