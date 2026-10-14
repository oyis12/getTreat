import { connectDB, closeDB } from "../config/db.js";
import PlatformSubscription from "../models/platform-subscription.model.js";
import PlatformPaymentAttempt from "../models/platform-payment-attempt.model.js";

if (process.env.CREATE_PLATFORM_SUBSCRIPTION_INDEXES !== "true") {
  console.error("Set CREATE_PLATFORM_SUBSCRIPTION_INDEXES=true only after confirming MONGO_URI points to the intended database.");
  process.exit(1);
}
try {
  await connectDB();
  for (const model of [PlatformSubscription, PlatformPaymentAttempt]) {
    await model.createIndexes();
    console.log(`Indexes ensured for ${model.collection.collectionName}`);
  }
} catch (error) {
  console.error("Platform subscription index migration failed:", error.message);
  process.exitCode = 1;
} finally { await closeDB(); }
