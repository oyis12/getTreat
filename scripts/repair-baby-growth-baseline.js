import { connectDB, closeDB } from "../config/db.js";
import PatientProfile from "../models/patient-profile.model.js";

/**
 * Repair one legacy baby when the original registration measurements are known.
 *
 * Usage:
 *   node scripts/repair-baby-growth-baseline.js <babyId> '<baseline-json>'
 *
 * Example:
 *   node scripts/repair-baby-growth-baseline.js 6ab33f793f84bf3f2be57dca \
 *     '{"weight":{"value":5.6,"unit":"kg"},"length":{"value":60,"unit":"cm"},"head_circumference":{"value":40,"unit":"cm"}}'
 *
 * The script refuses to modify a baby that already contains a registration
 * baseline, and refuses to guess an original value.
 */

const [, , babyId, baselineJson] = process.argv;

if (!babyId || !baselineJson) {
  console.error(
    "Usage: node scripts/repair-baby-growth-baseline.js <babyId> '<baseline-json>'"
  );
  process.exit(1);
}

const isMeasurement = (value) =>
  value &&
  typeof value === "object" &&
  Number.isFinite(value.value) &&
  typeof value.unit === "string";

const validateBaseline = (baseline) => {
  const fields = ["weight", "length", "head_circumference"];
  const present = fields.filter((field) => baseline[field] !== undefined && baseline[field] !== null);

  if (!present.length) {
    throw new Error("At least one original registration measurement is required.");
  }

  for (const field of present) {
    if (!isMeasurement(baseline[field]) || baseline[field].value < 0) {
      throw new Error(`${field} must contain a non-negative numeric value and unit.`);
    }
  }
};

const repairBabyGrowthBaseline = async () => {
  let baseline;

  try {
    baseline = JSON.parse(baselineJson);
  } catch {
    throw new Error("baseline-json must be valid JSON.");
  }

  validateBaseline(baseline);
  await connectDB();

  try {
    const profile = await PatientProfile.findOne({
      "pregnancies.babies._id": babyId,
    });

    if (!profile) {
      throw new Error(`Baby ${babyId} was not found.`);
    }

    let baby = null;

    for (const pregnancy of profile.pregnancies ?? []) {
      const candidate = pregnancy.babies.id(babyId);
      if (candidate) {
        baby = candidate;
        break;
      }
    }

    if (!baby) {
      throw new Error(`Baby ${babyId} was not found.`);
    }

    const history = baby.growth_history ?? [];

    const hasRegistration = history.some(
      (record) => record.source === "registration"
    );

    if (hasRegistration) {
      throw new Error(
        `Baby ${babyId} already has a registration growth baseline; refusing to duplicate it.`
      );
    }

    if (history.length > 0) {
      console.warn(
        `Baby ${babyId} already has ${history.length} growth record(s). The supplied baseline will be inserted before the existing records because the original registration values were explicitly supplied.`
      );
    }

    const baselineRecord = {
      recorded_at: baby.createdAt ?? baby.date_of_birth,
      weight: baseline.weight ?? null,
      length: baseline.length ?? null,
      head_circumference: baseline.head_circumference ?? null,
      source: "registration",
    };

    baby.growth_history.push(baselineRecord);
    baby.growth_history.sort(
      (a, b) => new Date(a.recorded_at) - new Date(b.recorded_at)
    );

    await profile.save();

    console.log(`Baby ${babyId} registration baseline repaired successfully.`);
    console.log(JSON.stringify({
      baby_id: babyId,
      recorded_at: baselineRecord.recorded_at,
      weight: baselineRecord.weight,
      length: baselineRecord.length,
      head_circumference: baselineRecord.head_circumference,
      source: baselineRecord.source,
    }, null, 2));
  } finally {
    await closeDB();
  }
};

repairBabyGrowthBaseline().catch(async (error) => {
  console.error("Baby baseline repair failed:", error.message);
  await closeDB().catch(() => {});
  process.exit(1);
});
