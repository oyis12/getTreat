import AppError from "../utils/AppError.js";

export const isProviderSubscriptionActive = (subscription, now = new Date()) => {
  if (!subscription || subscription.status !== "active") return false;

  const startsAt = new Date(subscription.starts_at);
  const endsAt = new Date(subscription.ends_at);

  return (
    !Number.isNaN(startsAt.getTime()) &&
    !Number.isNaN(endsAt.getTime()) &&
    startsAt <= now &&
    endsAt > now
  );
};

export const getProviderSubscriptionDisplayStatus = (
  subscription,
  now = new Date()
) => (isProviderSubscriptionActive(subscription, now) ? "active" : "expired");

export const assertApprovedProvider = (profile) => {
  if (profile?.approval_status !== "approved") {
    throw new AppError("Provider account must be approved to use this feature", 403);
  }
};

export const assertActiveProviderSubscription = (subscription, now = new Date()) => {
  if (!isProviderSubscriptionActive(subscription, now)) {
    throw new AppError(
      "An active provider subscription is required for this action",
      403
    );
  }
};
