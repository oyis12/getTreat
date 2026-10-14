import { connectDB, closeDB } from "../config/db.js";
import AuditLog from "../models/audit-log.model.js";
import ProviderBalance from "../models/provider-balance.model.js";
import ProviderLedgerEntry from "../models/provider-ledger-entry.model.js";
import ProviderPayout from "../models/provider-payout.model.js";
import ProviderPayoutMethod from "../models/provider-payout-method.model.js";

if (process.env.CREATE_PROVIDER_PAYOUT_INDEXES !== "true") {
  console.error("Set CREATE_PROVIDER_PAYOUT_INDEXES=true after confirming MONGO_URI points to the intended database.");
  process.exit(1);
}

try {
  await connectDB();
  for (const model of [AuditLog, ProviderBalance, ProviderLedgerEntry, ProviderPayout, ProviderPayoutMethod]) {
    await model.createIndexes();
    console.log(`Indexes ensured for ${model.collection.collectionName}`);
  }
} catch (error) {
  console.error("Provider payout index migration failed:", error.message);
  process.exitCode = 1;
} finally {
  await closeDB();
}
