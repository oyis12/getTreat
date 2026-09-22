import System from "../models/system.model.js";
import AppError from "../utils/AppError.js";

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
