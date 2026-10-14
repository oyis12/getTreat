import mongoose from "mongoose";
import AuditLog from "../models/audit-log.model.js";
import ProviderBalance from "../models/provider-balance.model.js";
import ProviderLedgerEntry from "../models/provider-ledger-entry.model.js";

export const calculateProviderPaymentSplit = (grossKobo, ratePercent) => {
  if (!Number.isSafeInteger(grossKobo) || grossKobo < 1) throw new TypeError("grossKobo must be a positive safe integer");
  if (!Number.isFinite(ratePercent) || ratePercent < 0 || ratePercent > 100) throw new TypeError("ratePercent must be between 0 and 100");
  const platformFeeKobo = Math.round(grossKobo * ratePercent / 100);
  return { platformFeeKobo, providerNetKobo: grossKobo - platformFeeKobo };
};

export const writeAuditEvent = async ({
  eventKey,
  actor = null,
  actorRole = "system",
  action,
  resourceType,
  resourceId = null,
  priorState = null,
  newState = null,
  correlationId = null,
  metadata = {},
  session,
}) => {
  if (eventKey && await AuditLog.exists({ event_key: eventKey }).session(session ?? null)) return null;
  const [entry] = await AuditLog.create([{
    ...(eventKey ? { event_key: eventKey } : {}),
    actor,
    actor_role: actorRole,
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    prior_state: priorState,
    new_state: newState,
    correlation_id: correlationId,
    metadata,
  }], session ? { session } : {});
  return entry;
};

const createLedgerEntry = async (data, session) => {
  const existing = await ProviderLedgerEntry.findOne({ source_key: data.source_key }).session(session);
  if (existing) return false;
  await ProviderLedgerEntry.create([data], { session });
  return true;
};

export const postProviderPaymentEarnings = async (attempt, { session }) => {
  const providerKey = `provider-payment:${attempt._id}:provider-credit`;
  const platformKey = `provider-payment:${attempt._id}:platform-fee`;
  const exists = await ProviderLedgerEntry.exists({ source_key: providerKey }).session(session);
  if (exists) return false;

  await createLedgerEntry({
    provider_profile: attempt.provider_profile,
    account: "provider",
    entry_type: "provider_earning",
    amount_kobo: attempt.provider_net_kobo,
    source_type: "provider_payment",
    source_id: attempt._id,
    source_key: providerKey,
    commission_rate_percent: attempt.commission_rate_percent,
    description: "Successful provider service subscription earning",
  }, session);
  await createLedgerEntry({
    provider_profile: attempt.provider_profile,
    account: "platform",
    entry_type: "platform_commission",
    amount_kobo: attempt.platform_fee_kobo,
    source_type: "provider_payment",
    source_id: attempt._id,
    source_key: platformKey,
    commission_rate_percent: attempt.commission_rate_percent,
    description: "Platform commission from provider service subscription",
  }, session);
  await ProviderBalance.findOneAndUpdate(
    { provider_profile: attempt.provider_profile },
    { $inc: { available_kobo: attempt.provider_net_kobo }, $set: { modified_at: new Date() }, $setOnInsert: { currency: "NGN", reserved_kobo: 0 } },
    { new: true, upsert: true, session, setDefaultsOnInsert: true }
  );
  await writeAuditEvent({
    eventKey: `${providerKey}:audit`,
    actorRole: "system",
    action: "provider_payment_earnings_posted",
    resourceType: "provider_payment_attempt",
    resourceId: attempt._id,
    newState: "success",
    correlationId: attempt.reference,
    metadata: { gross_kobo: attempt.amount_kobo, platform_fee_kobo: attempt.platform_fee_kobo, provider_net_kobo: attempt.provider_net_kobo, commission_rate_percent: attempt.commission_rate_percent },
    session,
  });
  return true;
};

export const reverseProviderPaymentEarnings = async (attempt, reason, { session, actor = null, actorRole = "system" } = {}) => {
  const providerKey = `provider-payment:${attempt._id}:reversal-provider`;
  if (await ProviderLedgerEntry.exists({ source_key: providerKey }).session(session ?? null)) return false;
  await createLedgerEntry({
    provider_profile: attempt.provider_profile,
    account: "provider",
    entry_type: "payment_reversal",
    amount_kobo: -attempt.provider_net_kobo,
    source_type: reason === "refunded" ? "refund" : "reversal",
    source_id: attempt._id,
    source_key: providerKey,
    commission_rate_percent: attempt.commission_rate_percent,
    description: `Provider earnings reversed: ${reason}`,
    actor,
  }, session);
  await createLedgerEntry({
    provider_profile: attempt.provider_profile,
    account: "platform",
    entry_type: "payment_reversal",
    amount_kobo: -attempt.platform_fee_kobo,
    source_type: reason === "refunded" ? "refund" : "reversal",
    source_id: attempt._id,
    source_key: `provider-payment:${attempt._id}:reversal-platform`,
    commission_rate_percent: attempt.commission_rate_percent,
    description: `Platform commission reversed: ${reason}`,
    actor,
  }, session);
  await ProviderBalance.updateOne(
    { provider_profile: attempt.provider_profile },
    { $inc: { available_kobo: -attempt.provider_net_kobo }, $set: { modified_at: new Date() } },
    { session }
  );
  await writeAuditEvent({
    eventKey: `${providerKey}:audit`,
    actor,
    actorRole,
    action: "provider_payment_earnings_reversed",
    resourceType: "provider_payment_attempt",
    resourceId: attempt._id,
    priorState: "success",
    newState: reason,
    correlationId: attempt.reference,
    metadata: { platform_fee_kobo_reversed: attempt.platform_fee_kobo, provider_net_kobo_reversed: attempt.provider_net_kobo },
    session,
  });
  return true;
};

export const postAppointmentPaymentEarnings = async (attempt, { session }) => {
  const providerKey = `appointment-payment:${attempt._id}:provider-credit`;
  if (await ProviderLedgerEntry.exists({ source_key: providerKey }).session(session)) return false;
  await createLedgerEntry({
    provider_profile: attempt.provider_profile, account: "provider", entry_type: "provider_earning",
    amount_kobo: attempt.provider_net_kobo, source_type: "appointment_payment", source_id: attempt._id,
    source_key: providerKey, commission_rate_percent: attempt.commission_rate_percent,
    description: "Successful appointment payment earning",
  }, session);
  await createLedgerEntry({
    provider_profile: attempt.provider_profile, account: "platform", entry_type: "platform_commission",
    amount_kobo: attempt.platform_fee_kobo, source_type: "appointment_payment", source_id: attempt._id,
    source_key: `appointment-payment:${attempt._id}:platform-fee`, commission_rate_percent: attempt.commission_rate_percent,
    description: "Platform commission from appointment payment",
  }, session);
  await ProviderBalance.findOneAndUpdate(
    { provider_profile: attempt.provider_profile },
    { $inc: { available_kobo: attempt.provider_net_kobo }, $set: { modified_at: new Date() }, $setOnInsert: { currency: "NGN", reserved_kobo: 0 } },
    { new: true, upsert: true, session, setDefaultsOnInsert: true }
  );
  await writeAuditEvent({ eventKey: `${providerKey}:audit`, actorRole: "system", action: "appointment_payment_earnings_posted", resourceType: "appointment_payment_attempt", resourceId: attempt._id, newState: "success", correlationId: attempt.reference, metadata: { gross_kobo: attempt.amount_kobo, platform_fee_kobo: attempt.platform_fee_kobo, provider_net_kobo: attempt.provider_net_kobo, commission_rate_percent: attempt.commission_rate_percent }, session });
  return true;
};

export const reverseAppointmentPaymentEarnings = async (attempt, reason, { session, actor = null, actorRole = "system" } = {}) => {
  const providerKey = `appointment-payment:${attempt._id}:reversal-provider`;
  if (await ProviderLedgerEntry.exists({ source_key: providerKey }).session(session ?? null)) return false;
  await createLedgerEntry({ provider_profile: attempt.provider_profile, account: "provider", entry_type: "payment_reversal", amount_kobo: -attempt.provider_net_kobo, source_type: reason === "refunded" ? "refund" : "reversal", source_id: attempt._id, source_key: providerKey, commission_rate_percent: attempt.commission_rate_percent, description: `Appointment provider earnings reversed: ${reason}`, actor }, session);
  await createLedgerEntry({ provider_profile: attempt.provider_profile, account: "platform", entry_type: "payment_reversal", amount_kobo: -attempt.platform_fee_kobo, source_type: reason === "refunded" ? "refund" : "reversal", source_id: attempt._id, source_key: `appointment-payment:${attempt._id}:reversal-platform`, commission_rate_percent: attempt.commission_rate_percent, description: `Appointment platform commission reversed: ${reason}`, actor }, session);
  await ProviderBalance.updateOne({ provider_profile: attempt.provider_profile }, { $inc: { available_kobo: -attempt.provider_net_kobo }, $set: { modified_at: new Date() } }, { session });
  await writeAuditEvent({ eventKey: `${providerKey}:audit`, actor, actorRole, action: "appointment_payment_earnings_reversed", resourceType: "appointment_payment_attempt", resourceId: attempt._id, priorState: "success", newState: reason, correlationId: attempt.reference, metadata: { platform_fee_kobo_reversed: attempt.platform_fee_kobo, provider_net_kobo_reversed: attempt.provider_net_kobo }, session });
  return true;
};
