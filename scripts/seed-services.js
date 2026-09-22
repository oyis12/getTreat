import "dotenv/config";
import { connectDB, closeDB } from "../config/db.js";
import Service from "../models/services.model.js";

const services = [
  {
    name: "Progress Report",
    slug: "progress-report",
    category: "pregnancy_care",
    access_type: "included",
    sort_order: 1,
  },
  {
    name: "Personalized Recommendations",
    slug: "personalized-recommendations",
    category: "pregnancy_care",
    access_type: "included",
    sort_order: 2,
  },
  {
    name: "Access to Articles",
    slug: "access-to-articles",
    category: "pregnancy_care",
    access_type: "included",
    sort_order: 3,
  },
  {
    name: "Join a Community",
    slug: "join-a-community",
    category: "pregnancy_care",
    access_type: "included",
    sort_order: 4,
  },
  {
    name: "Monthly Nutritional Recommendations",
    slug: "monthly-nutritional-recommendations",
    category: "pregnancy_care",
    access_type: "included",
    sort_order: 5,
  },
  {
    name: "Personalized Follow-up",
    slug: "personalized-follow-up",
    category: "pregnancy_care",
    access_type: "optional",
    sort_order: 10,
    plans: [
      { code: "weekly", label: "Weekly", billing_cycle: "weekly", amount: null },
      { code: "monthly", label: "Monthly", billing_cycle: "monthly", amount: null },
    ],
  },
  {
    name: "Meal Plan",
    slug: "meal-plan",
    category: "pregnancy_care",
    access_type: "optional",
    sort_order: 11,
    plans: [
      { code: "weekly", label: "Weekly", billing_cycle: "weekly", amount: null },
      { code: "monthly", label: "Monthly", billing_cycle: "monthly", amount: null },
    ],
  },
  {
    name: "Progress Review",
    slug: "progress-review",
    category: "pregnancy_care",
    access_type: "optional",
    sort_order: 12,
    plans: [
      { code: "weekly", label: "Weekly", billing_cycle: "weekly", amount: null },
      { code: "monthly", label: "Monthly", billing_cycle: "monthly", amount: null },
    ],
  },
];

try {
  await connectDB();

  for (const service of services) {
    await Service.updateOne(
      { slug: service.slug },
      { $setOnInsert: service },
      { upsert: true }
    );
  }

  console.log(`Service catalogue ready: ${services.length} entries checked.`);
} catch (error) {
  console.error("Failed to seed services:", error.message);
  process.exitCode = 1;
} finally {
  await closeDB();
}
