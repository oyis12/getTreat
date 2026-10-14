import "dotenv/config";
import { connectDB, closeDB } from "../config/db.js";
import AppointmentType from "../models/appointment-type.model.js";

const types = [
  { name: "Consultation", slug: "consultation", active: true },
  { name: "Nutrition Plan", slug: "nutrition-plan", active: true },
];

try {
  await connectDB();
  for (const type of types) {
    await AppointmentType.updateOne({ slug: type.slug }, { $setOnInsert: type }, { upsert: true });
    console.log(`Appointment type ensured: ${type.name}`);
  }
} catch (error) {
  console.error("Appointment type seed failed:", error.message);
  process.exitCode = 1;
} finally {
  await closeDB();
}
