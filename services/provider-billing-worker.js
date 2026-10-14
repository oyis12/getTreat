// Keep each scheduled run small to bound Paystack requests and runtime.
export const PROVIDER_BILLING_BATCH_SIZE = 1;

export const runProviderBillingWorkerCycle = async ({
  processPendingPaystackWebhooks,
  runDueProviderRenewals,
}) => {
  const webhookEvents = await processPendingPaystackWebhooks(PROVIDER_BILLING_BATCH_SIZE);
  const renewalAttempts = await runDueProviderRenewals(PROVIDER_BILLING_BATCH_SIZE);
  return { webhookEvents, renewalAttempts };
};
