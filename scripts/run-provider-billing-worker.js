// Set the process role before importing config/env.js so this service only needs
// database and billing credentials, not API authentication or Cloudinary secrets.
process.env.PROVIDER_BILLING_WORKER = "true";

const [{ connectDB, closeDB }, {
  processPendingPaystackWebhooks,
  runDueProviderRenewals,
}] = await Promise.all([
  import("../config/db.js"),
  import("../services/provider-subscription.service.js"),
]);
const { runDuePlatformRenewals } = await import("../services/platform-subscription.service.js");
const { runProviderBillingWorkerCycle } = await import("../services/provider-billing-worker.js");

try {
  await connectDB();
  const { webhookEvents, renewalAttempts, platformRenewalAttempts } = await runProviderBillingWorkerCycle({
    processPendingPaystackWebhooks,
    runDueProviderRenewals,
    runDuePlatformRenewals,
  });
  console.log(`Billing worker completed: ${webhookEvents} webhook events, ${renewalAttempts} provider renewal attempts, ${platformRenewalAttempts} platform renewal attempts`);
  await closeDB();
} catch (error) {
  console.error("Provider billing worker failed:", error.message);
  await closeDB();
  process.exitCode = 1;
}
