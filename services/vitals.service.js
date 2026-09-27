import User from "../models/user.model.js";
import PatientProfile from "../models/patient-profile.model.js";
import AppError from "../utils/AppError.js";

const ensurePatient = async (userId) => {
  const user = await User.findById(userId);

  if (!user) throw new AppError("Patient account not found", 404);
  if (user.role !== "patient") {
    throw new AppError("This endpoint is only available to patients", 403);
  }
  if (["suspended", "deactivated"].includes(user.accountStatus)) {
    throw new AppError("Your account cannot be accessed", 403);
  }

  const profile = await PatientProfile.findOne({ user: user._id });

  if (!profile) {
    throw new AppError(
      "Patient profile not found. Please complete your profile.",
      404
    );
  }

  return profile;
};

const serializeVital = (vital) => ({
  id: vital._id.toString(),
  pregnancy_id: vital.pregnancy_id ? vital.pregnancy_id.toString() : null,
  blood_pressure: vital.blood_pressure
    ? {
        systolic: vital.blood_pressure.systolic,
        diastolic: vital.blood_pressure.diastolic,
        unit: "mmHg",
      }
    : null,
  sugar_level: vital.sugar_level
    ? {
        value: vital.sugar_level.value,
        unit: vital.sugar_level.unit,
      }
    : null,
  recorded_at: vital.recorded_at,
  created_at: vital.createdAt,
  modified_at: vital.updatedAt,
});

export const recordVital = async (userId, payload) => {
  const profile = await ensurePatient(userId);

  const currentPregnancy =
    profile.pregnancies?.find((pregnancy) => pregnancy.is_current) ?? null;

  if (!currentPregnancy) {
    throw new AppError("No current pregnancy found", 404);
  }

  const vital = {
    pregnancy_id: currentPregnancy._id,
    blood_pressure: {
      systolic: payload.blood_pressure.systolic,
      diastolic: payload.blood_pressure.diastolic,
    },
    sugar_level: {
      value: payload.sugar_level.value,
      unit: payload.sugar_level.unit,
    },
    recorded_at: new Date(),
  };

  profile.vitals.push(vital);
  await profile.save();

  return serializeVital(profile.vitals[profile.vitals.length - 1]);
};

const parseDateOnly = (value, fieldName) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError(`${fieldName} must use YYYY-MM-DD format`, 400);
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new AppError(`${fieldName} is not a valid calendar date`, 400);
  }

  return date;
};

const getDateRange = (filters = {}) => {
  const allowedFilters = ["date", "from", "to"];
  const unknownFilters = Object.keys(filters).filter(
    (key) => !allowedFilters.includes(key)
  );

  if (unknownFilters.length > 0) {
    throw new AppError(
      `Unknown vital filter(s): ${unknownFilters.join(", ")}`,
      400
    );
  }

  const { date, from, to } = filters;
  if (date !== undefined && (from !== undefined || to !== undefined)) {
    throw new AppError("Use either date or from/to, not both", 400);
  }

  if (date !== undefined) {
    const start = parseDateOnly(date, "date");
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { start, end, date, from: date, to: date };
  }

  if (from === undefined && to === undefined) {
    return { start: null, end: null, date: null, from: null, to: null };
  }

  const start = from !== undefined ? parseDateOnly(from, "from") : null;
  const endExclusive = to !== undefined ? parseDateOnly(to, "to") : null;

  if (start && endExclusive && start > endExclusive) {
    throw new AppError("from cannot be later than to", 400);
  }

  const end = endExclusive
    ? new Date(endExclusive)
    : null;

  if (end) end.setUTCDate(end.getUTCDate() + 1);

  return {
    start,
    end,
    date: null,
    from: from ?? null,
    to: to ?? null,
  };
};

const filterVitalsByDate = (vitals, range) => {
  if (!range.start && !range.end) return vitals;

  return vitals.filter((vital) => {
    const recordedAt = new Date(vital.recorded_at);

    if (range.start && recordedAt < range.start) return false;
    if (range.end && recordedAt >= range.end) return false;

    return true;
  });
};

const sortVitals = (vitals) =>
  vitals
    .slice()
    .sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at));

export const getVitals = async (userId, filters = {}) => {
  const profile = await ensurePatient(userId);
  const range = getDateRange(filters);

  const allVitals = sortVitals(profile.vitals ?? []);
  const filteredVitals = filterVitalsByDate(allVitals, range);
  const history = filteredVitals.map(serializeVital);

  return {
    filters: {
      date: range.date,
      from: range.from,
      to: range.to,
    },
    latest: history[0] ?? null,
    history,
    total_records: history.length,
    total_records_all: allVitals.length,
  };
};

export const getVitalsReport = async (userId, filters = {}) => {
  const profile = await ensurePatient(userId);
  const range = getDateRange(filters);

  const allVitals = sortVitals(profile.vitals ?? []);
  const filteredVitals = filterVitalsByDate(allVitals, range);
  const records = filteredVitals.map(serializeVital);

  return {
    filters: {
      date: range.date,
      from: range.from,
      to: range.to,
    },
    total_records: records.length,
    records,
    chart: {
      blood_pressure: records
        .filter((vital) => vital.blood_pressure)
        .map((vital) => ({
          recorded_at: vital.recorded_at,
          systolic: vital.blood_pressure.systolic,
          diastolic: vital.blood_pressure.diastolic,
          unit: vital.blood_pressure.unit,
        })),
      sugar_level: records
        .filter((vital) => vital.sugar_level)
        .map((vital) => ({
          recorded_at: vital.recorded_at,
          value: vital.sugar_level.value,
          unit: vital.sugar_level.unit,
        })),
    },
  };
};

export const getVitalsSummary = async (userId) => {
  const profile = await ensurePatient(userId);

  const latestVital = profile.vitals
    .slice()
    .sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at))[0] ?? null;

  const latest = latestVital ? serializeVital(latestVital) : null;

  return {
    latest_blood_pressure: latest?.blood_pressure ?? null,
    latest_sugar_level: latest?.sugar_level ?? null,
    last_recorded_at: latest?.recorded_at ?? null,
    total_records: profile.vitals.length,
  };
};

export const updateVital = async (userId, vitalId, payload) => {
  const profile = await ensurePatient(userId);
  const vital = profile.vitals.id(vitalId);

  if (!vital) {
    throw new AppError("Vital record not found", 404);
  }

  if (payload.blood_pressure !== undefined) {
    vital.blood_pressure = {
      systolic:
        payload.blood_pressure.systolic ?? vital.blood_pressure?.systolic,
      diastolic:
        payload.blood_pressure.diastolic ?? vital.blood_pressure?.diastolic,
    };
  }

  if (payload.sugar_level !== undefined) {
    vital.sugar_level = {
      value: payload.sugar_level.value ?? vital.sugar_level?.value,
      unit: payload.sugar_level.unit ?? vital.sugar_level?.unit,
    };
  }

  await profile.save();

  return serializeVital(vital);
};

export const deleteVital = async (userId, vitalId) => {
  const profile = await ensurePatient(userId);
  const vital = profile.vitals.id(vitalId);

  if (!vital) {
    throw new AppError("Vital record not found", 404);
  }

  vital.deleteOne();
  await profile.save();

  return {
    id: vitalId,
  };
};

export default {
  recordVital,
  getVitals,
  getVitalsReport,
  getVitalsSummary,
  updateVital,
  deleteVital,
};
