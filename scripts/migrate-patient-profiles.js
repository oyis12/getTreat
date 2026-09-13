import { connectDB, closeDB } from "../config/db.js";
import User from "../models/user.model.js";
import PatientProfile from "../models/patient-profile.model.js";

const migratePatientProfiles = async () => {
  await connectDB();

  // Read legacy fields directly from the MongoDB collection because the
  // refactored User schema intentionally no longer defines patient fields.
  const patients = await User.collection
    .find({ role: "patient" })
    .toArray();

  let created = 0;
  let skipped = 0;

  try {
    for (const user of patients) {
      const existing = await PatientProfile.exists({
        user: user._id,
      });

      if (existing) {
        skipped += 1;
        continue;
      }

      await PatientProfile.create({
        user: user._id,
        phone_no: user.phone_no ?? null,
        birth_date: user.birth_date ?? null,
        gender: user.gender ?? null,
        address: user.address ?? {},
        profileImage: user.profileImage ?? null,
        profileImagePublicId:
          user.profileImagePublicId ?? null,
        profileCompleted:
          user.profileCompleted ?? false,
      });

      // Remove legacy patient fields only after the PatientProfile
      // document has been created successfully.
      await User.collection.updateOne(
        { _id: user._id },
        {
          $unset: {
            phone_no: "",
            birth_date: "",
            gender: "",
            address: "",
            profileImage: "",
            profileImagePublicId: "",
            profileCompleted: "",
          },
        }
      );

      created += 1;
    }

    console.log(
      `Patient profile migration complete. Created: ${created}, skipped: ${skipped}`
    );
  } finally {
    await closeDB();
  }
};

migratePatientProfiles().catch(async (error) => {
  console.error(
    "Patient profile migration failed:",
    error.message
  );

  await closeDB().catch(() => {});
  process.exit(1);
});
