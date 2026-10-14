import "dotenv/config";
import { connectDB, closeDB } from "../config/db.js";
import Appointment from "../models/appointment.model.js";
import AppointmentPaymentAttempt from "../models/appointment-payment-attempt.model.js";
import AppointmentType from "../models/appointment-type.model.js";
import ProviderAvailability from "../models/provider-availability.model.js";

if (process.env.CREATE_APPOINTMENT_INDEXES !== "true") {
  console.error("Set CREATE_APPOINTMENT_INDEXES=true after confirming MONGO_URI points to the intended database.");
  process.exit(1);
}

try {
  await connectDB();
  for (const Model of [Appointment, AppointmentPaymentAttempt, AppointmentType, ProviderAvailability]) {
    await Model.createIndexes();
    console.log(`Indexes ensured for ${Model.collection.collectionName}`);
  }
} catch (error) {
  console.error("Appointment index migration failed:", error.message);
  process.exitCode = 1;
} finally {
  await closeDB();
}
