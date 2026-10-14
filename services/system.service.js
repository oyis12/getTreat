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
  return {
    enabled: system.platform_subscription?.enabled ?? false,
    billing_cycle: system.platform_subscription?.billing_cycle ?? "monthly",
    amount: system.platform_subscription?.amount ?? null,
    currency: system.platform_subscription?.currency ?? "NGN",
  };
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
