import { connectDB, closeDB } from "../config/db.js";
import PatientProfile from "../models/patient-profile.model.js";

/**
 * Backfills the registration growth baseline for babies created before
 * Phase 4I introduced baby.growth_history.
 *
 * Safe rules:
 * - Only babies with an EMPTY growth_history are changed.
 * - The existing top-level measurement fields are copied as the baseline.
 * - The baby subdocument creation timestamp is used as recorded_at.
 * - Babies that already have growth history are never modified.
 * - Babies with no legacy measurements are skipped.
 *
 * IMPORTANT:
 * If a legacy baby's top-level measurements were already overwritten by a
 * post-4I update, this migration cannot reconstruct the original baseline.
 * Such a baby must be repaired only when the original registration values are
 * known and explicitly supplied.
 */

const hasMeasurement = (baby) =>
  Boolean(baby.weight || baby.length || baby.head_circumference);

const buildBaseline = (baby) => ({
  recorded_at: baby.createdAt ?? new Date(),
  weight: baby.weight ?? null,
  length: baby.length ?? null,
  head_circumference: baby.head_circumference ?? null,
  source: "registration",
});

const migrateBabyGrowthHistory = async () => {
  await connectDB();

  let scanned = 0;
  let migrated = 0;
  let skippedWithHistory = 0;
  let skippedWithoutMeasurements = 0;
  let errors = 0;

  try {
    const cursor = PatientProfile.find({
      "pregnancies.babies.0": { $exists: true },
    }).cursor();

    for await (const profile of cursor) {
      let profileChanged = false;

      for (const pregnancy of profile.pregnancies ?? []) {
        for (const baby of pregnancy.babies ?? []) {
          scanned += 1;

          if ((baby.growth_history ?? []).length > 0) {
            skippedWithHistory += 1;
            continue;
          }

          if (!hasMeasurement(baby)) {
            skippedWithoutMeasurements += 1;
            continue;
          }

          baby.growth_history.push(buildBaseline(baby));
          profileChanged = true;
          migrated += 1;
        }
      }

      if (profileChanged) {
        try {
          await profile.save();
        } catch (error) {
          errors += 1;
          console.error(
            `Failed to migrate patient profile ${profile._id}:`,
            error.message
          );
        }
      }
    }

    console.log("Baby growth history migration complete.");
    console.log(`Scanned: ${scanned}`);
    console.log(`Migrated: ${migrated}`);
    console.log(`Skipped (already has history): ${skippedWithHistory}`);
    console.log(`Skipped (no legacy measurements): ${skippedWithoutMeasurements}`);
    console.log(`Errors: ${errors}`);
  } finally {
    await closeDB();
  }
};

migrateBabyGrowthHistory().catch(async (error) => {
  console.error("Baby growth history migration failed:", error.message);
  await closeDB().catch(() => {});
  process.exit(1);
});
