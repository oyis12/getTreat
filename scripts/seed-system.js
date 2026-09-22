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
          amount: null,
          currency: "NGN",
        },
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );

  console.log("System configuration ready:", system._id.toString());
} catch (error) {
  console.error("Failed to seed system configuration:", error.message);
  process.exitCode = 1;
} finally {
  await closeDB();
}
