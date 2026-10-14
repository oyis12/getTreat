import System from "../models/system.model.js";
import AppError from "../utils/AppError.js";
import { writeAuditEvent } from "./financial-ledger.service.js";

const getGlobalSystem = async () => {
  const system = await System.findOne({ key: "global" }).lean();
  if (!system) throw new AppError("System configuration not found", 404);
  return system;
};

export const getPlatformSubscription = async () => {
  const system = await getGlobalSystem();
  const plans = system.platform_subscription?.plans?.length ? system.platform_subscription.plans : [
    { billing_cycle: "monthly", amount: system.platform_subscription?.amount ?? 555, currency: "NGN", active: true },
    { billing_cycle: "quarterly", amount: 1500, currency: "NGN", active: true },
    { billing_cycle: "yearly", amount: 5500, currency: "NGN", active: true },
  ];
  return {
    enabled: system.platform_subscription?.enabled ?? false,
    // Keep the original monthly fields for existing frontend clients.
    billing_cycle: "monthly",
    amount: plans.find((plan) => plan.billing_cycle === "monthly")?.amount ?? null,
    currency: system.platform_subscription?.currency ?? "NGN",
    plans: plans.map((plan) => ({ billing_cycle: plan.billing_cycle, amount: plan.amount, currency: plan.currency ?? "NGN", active: plan.active ?? true })),
  };
};

export const updatePlatformSubscriptionSettings = async ({ enabled, plans }, actorId) => {
  const session = await System.startSession(); let result;
  try { await session.withTransaction(async () => {
    const system = await System.findOne({ key: "global" }).session(session);
    if (!system) throw new AppError("System configuration not found", 404);
    const prior = system.platform_subscription?.toObject?.() ?? system.platform_subscription ?? {};
    system.platform_subscription.enabled = enabled;
    system.platform_subscription.plans = plans.map((plan) => ({ ...plan, currency: "NGN" }));
    system.platform_subscription.billing_cycle = "monthly";
    system.platform_subscription.amount = plans.find((plan) => plan.billing_cycle === "monthly")?.amount ?? null;
    system.platform_subscription.currency = "NGN";
    await system.save({ session });
    await writeAuditEvent({ actor: actorId, actorRole: "super_admin", action: "platform_subscription_settings_updated", resourceType: "system_configuration", resourceId: system._id, priorState: "configured", newState: "configured", metadata: { setting: "platform_subscription", prior_enabled: prior.enabled ?? false, enabled, prior_plans: prior.plans ?? [], plans }, session });
    result = { enabled: system.platform_subscription.enabled, currency: "NGN", plans: system.platform_subscription.plans.map((plan) => ({ billing_cycle: plan.billing_cycle, amount: plan.amount, currency: plan.currency, active: plan.active })) };
  }); } finally { await session.endSession(); }
  return result;
};

export const getPlatformFinancialSettings = async () => {
  const system = await getGlobalSystem();
  return { platform_fee_percent: system.platform_fee_percent ?? 15, currency: "NGN" };
};

export const updatePlatformFee = async (platformFeePercent, actorId) => {
  const session = await System.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const system = await System.findOne({ key: "global" }).session(session);
      if (!system) throw new AppError("System configuration not found", 404);
      const previousRate = system.platform_fee_percent ?? 15;
      system.platform_fee_percent = platformFeePercent;
      await system.save({ session });
      await writeAuditEvent({
        actor: actorId,
        actorRole: "super_admin",
        action: "platform_commission_rate_updated",
        resourceType: "system_configuration",
        resourceId: system._id,
        priorState: String(previousRate),
        newState: String(platformFeePercent),
        metadata: { setting: "platform_fee_percent" },
        session,
      });
      result = { platform_fee_percent: system.platform_fee_percent, currency: "NGN" };
    });
  } finally { await session.endSession(); }
  return result;
};

export const getPreferredChoices = async () => {
  const system = await getGlobalSystem();
  return (system.service_categories ?? [])
    .filter((item) => item.active)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((item) => ({
      id: item.code,
      code: item.code,
      label: item.label,
      active: item.active,
      sort_order: item.sort_order,
    }));
};

export const getPreferredChoice = async (id) => {
  const choices = await getPreferredChoices();
  const choice = choices.find((item) => item.id === id || item.code === id);
  if (!choice) throw new AppError("Preferred choice not found", 404);
  return choice;
};
