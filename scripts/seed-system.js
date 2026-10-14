import "dotenv/config";
import { connectDB, closeDB } from "../config/db.js";
import System from "../models/system.model.js";

try {
  await connectDB();

  const system = await System.findOneAndUpdate(
    { key: "global" },
    {
      $setOnInsert: {
        key: "global",
        platform_subscription: {
          enabled: true,
          billing_cycle: "monthly",
          amount: 555,
          currency: "NGN",
          plans: [
            { billing_cycle: "monthly", amount: 555, currency: "NGN", active: true },
            { billing_cycle: "quarterly", amount: 1500, currency: "NGN", active: true },
            { billing_cycle: "yearly", amount: 5500, currency: "NGN", active: true },
          ],
        },
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );

  // Upgrade legacy singleton docs only when the plans array is absent. Never
  // overwrite an owner's existing pricing when this seed is rerun.
  const storedSystem = await System.collection.findOne({ _id: system._id }, { projection: { "platform_subscription.plans": 1, "platform_subscription.amount": 1 } });
  if (!storedSystem?.platform_subscription?.plans?.length) {
    await System.updateOne({ _id: system._id, $or: [
      { "platform_subscription.plans": { $exists: false } },
      { "platform_subscription.plans": { $size: 0 } },
    ] }, {
      $set: { "platform_subscription.plans": [
        { billing_cycle: "monthly", amount: storedSystem?.platform_subscription?.amount ?? 555, currency: "NGN", active: true },
        { billing_cycle: "quarterly", amount: 1500, currency: "NGN", active: true },
        { billing_cycle: "yearly", amount: 5500, currency: "NGN", active: true },
      ], "platform_subscription.amount": storedSystem?.platform_subscription?.amount ?? 555 },
    });
  }

  console.log("System configuration ready:", system._id.toString());
} catch (error) {
  console.error("Failed to seed system configuration:", error.message);
  process.exitCode = 1;
} finally {
  await closeDB();
}
