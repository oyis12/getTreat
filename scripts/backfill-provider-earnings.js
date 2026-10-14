import mongoose from "mongoose";
import { connectDB, closeDB } from "../config/db.js";
import System from "../models/system.model.js";
import ProviderPaymentAttempt from "../models/provider-payment-attempt.model.js";
import ProviderLedgerEntry from "../models/provider-ledger-entry.model.js";
import { calculateProviderPaymentSplit, postProviderPaymentEarnings, writeAuditEvent } from "../services/financial-ledger.service.js";

if (process.env.APPLY_PROVIDER_EARNINGS_BACKFILL !== "true") {
  console.error("Set APPLY_PROVIDER_EARNINGS_BACKFILL=true after reviewing the selected database and current platform fee.");
  process.exit(1);
}

try {
  await connectDB();
  const system = await System.findOne({ key: "global" }).lean();
  const rate = Number(system?.platform_fee_percent ?? 15);
  const attempts = await ProviderPaymentAttempt.find({ status: "success" }).sort({ createdAt: 1 });
  let posted = 0;
  for (const candidate of attempts) {
    const session = await mongoose.startSession();
    let postedThisAttempt = false;
    try {
      await session.withTransaction(async () => {
        const attempt = await ProviderPaymentAttempt.findById(candidate._id).session(session);
        if (!attempt || attempt.status !== "success") return;
        const existing = await ProviderLedgerEntry.exists({ source_key: `provider-payment:${attempt._id}:provider-credit` }).session(session);
        if (existing) return;
        if (!attempt.commission_snapshotted_at) {
          const split = calculateProviderPaymentSplit(attempt.amount_kobo, rate);
          attempt.commission_rate_percent = rate;
          attempt.platform_fee_kobo = split.platformFeeKobo;
          attempt.provider_net_kobo = split.providerNetKobo;
          attempt.commission_snapshotted_at = new Date();
          attempt.commission_snapshot_source = "legacy_backfill";
          await attempt.save({ session });
        }
        await postProviderPaymentEarnings(attempt, { session });
        await writeAuditEvent({
          eventKey: `provider-payment:${attempt._id}:earnings-backfilled`,
          actorRole: "system",
          action: "provider_payment_earnings_backfilled",
          resourceType: "provider_payment_attempt",
          resourceId: attempt._id,
          newState: "posted",
          correlationId: attempt.reference,
          metadata: { commission_rate_percent: attempt.commission_rate_percent, platform_fee_kobo: attempt.platform_fee_kobo, provider_net_kobo: attempt.provider_net_kobo },
          session,
        });
        postedThisAttempt = true;
      });
      if (postedThisAttempt) posted += 1;
    } finally { await session.endSession(); }
  }
  console.log(`Provider earnings backfill complete: ${posted} historical successful payment(s) posted at configured commission rate ${rate}%.`);
} catch (error) {
  console.error("Provider earnings backfill failed:", error.message);
  process.exitCode = 1;
} finally {
  await closeDB();
}
