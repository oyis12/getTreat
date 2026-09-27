import User from "../models/user.model.js";
import PatientProfile from "../models/patient-profile.model.js";
import AppError from "../utils/AppError.js";

const ensurePatientProfile = async (userId) => {
  const user = await User.findById(userId).select("role accountStatus");

  if (!user) throw new AppError("User account not found", 404);
  if (user.role !== "patient") {
    throw new AppError("This endpoint is only available to patients", 403);
  }
  if (["suspended", "deactivated"].includes(user.accountStatus)) {
    throw new AppError("Your account cannot be accessed", 403);
  }

  const profile = await PatientProfile.findOne({ user: userId });
  if (!profile) throw new AppError("Patient profile not found", 404);
  return profile;
};

const getCurrentPregnancy = (profile) => {
  const pregnancy = profile.pregnancies.find((item) => item.is_current === true);
  if (!pregnancy) throw new AppError("No active pregnancy found", 404);
  return pregnancy;
};

const findBaby = (pregnancy, babyId) => {
  const baby = pregnancy.babies.id(babyId);
  if (!baby) throw new AppError("Baby not found", 404);
  return baby;
};

const serializeMeasurement = (measurement) =>
  measurement
    ? { value: measurement.value, unit: measurement.unit }
    : null;

const serializeGrowth = (record) => ({
  id: record._id.toString(),
  recorded_at: record.recorded_at,
  weight: serializeMeasurement(record.weight),
  length: serializeMeasurement(record.length),
  head_circumference: serializeMeasurement(record.head_circumference),
  source: record.source,
  created_at: record.createdAt ?? null,
  modified_at: record.updatedAt ?? null,
});

const daysInMonth = (year, monthIndex) =>
  new Date(year, monthIndex + 1, 0).getDate();

export const calculateAge = (dateOfBirth, at = new Date()) => {
  const dob = new Date(dateOfBirth);
  const end = new Date(at);

  if (Number.isNaN(dob.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }

  let years = end.getFullYear() - dob.getFullYear();
  let months = end.getMonth() - dob.getMonth();
  let days = end.getDate() - dob.getDate();

  if (days < 0) {
    months -= 1;
    const previousMonth = new Date(end.getFullYear(), end.getMonth(), 0);
    days += previousMonth.getDate();
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (years < 0) return null;

  const totalDays = Math.floor((end - dob) / 86400000);
  const weeks = Math.floor(totalDays / 7);

  const weekRemainderDays = totalDays % 7;
  const formattedParts = years || months
    ? [
        years ? `${years} ${years === 1 ? "year" : "years"}` : null,
        months ? `${months} ${months === 1 ? "month" : "months"}` : null,
        days ? `${days} ${days === 1 ? "day" : "days"}` : null,
      ]
    : [
        totalDays >= 7 ? `${weeks} ${weeks === 1 ? "week" : "weeks"}` : null,
        totalDays >= 7 && weekRemainderDays ? `${weekRemainderDays} ${weekRemainderDays === 1 ? "day" : "days"}` : null,
        totalDays < 7 && days ? `${days} ${days === 1 ? "day" : "days"}` : null,
      ];

  return {
    years,
    months,
    days,
    total_days: totalDays,
    total_weeks: weeks,
    formatted: formattedParts.filter(Boolean).join(" and ") || "0 days",
  };
};

const parseDateOnly = (value, field) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError(`${field} must use YYYY-MM-DD format`, 400);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new AppError(`${field} must be a valid date`, 400);
  }
  return date;
};

const parseFilters = (query = {}) => {
  const allowed = ["date", "from", "to"];
  const unknown = Object.keys(query).filter((key) => !allowed.includes(key));
  if (unknown.length) throw new AppError(`Unknown query parameter(s): ${unknown.join(", ")}`, 400);

  if (query.date && (query.from || query.to)) {
    throw new AppError("date cannot be combined with from/to", 400);
  }
  if ((query.from && !query.to) || (!query.from && query.to)) {
    throw new AppError("from and to must be provided together", 400);
  }

  if (query.date) {
    const start = parseDateOnly(query.date, "date");
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { date: query.date, from: null, to: null, start, end };
  }

  if (query.from && query.to) {
    const from = parseDateOnly(query.from, "from");
    const to = parseDateOnly(query.to, "to");
    if (from > to) throw new AppError("from cannot be later than to", 400);
    const end = new Date(to);
    end.setUTCDate(end.getUTCDate() + 1);
    return { date: null, from: query.from, to: query.to, start: from, end };
  }

  return { date: null, from: null, to: null, start: null, end: null };
};

const filterGrowth = (history, filters) => {
  if (!filters.start) return history;
  return history.filter((record) => {
    const recorded = new Date(record.recorded_at);
    return recorded >= filters.start && recorded < filters.end;
  });
};

const canonicalValue = (measurement, field) => {
  if (!measurement) return null;
  const value = Number(measurement.value);
  const unit = measurement.unit?.toLowerCase();

  if (field === "weight") {
    if (unit === "kg") return value;
    if (unit === "lbs") return value * 0.45359237;
  }
  if (field === "length" || field === "head_circumference") {
    if (unit === "cm") return value;
    if (unit === "m") return value * 100;
  }
  return null;
};

const calculateChange = (current, previous, field) => {
  const currentValue = canonicalValue(current, field);
  const previousValue = canonicalValue(previous, field);

  if (currentValue === null || previousValue === null || previousValue === 0) {
    return { absolute: null, percentage: null };
  }

  const absolute = currentValue - previousValue;
  const percentage = (absolute / previousValue) * 100;

  return {
    absolute: Number(absolute.toFixed(2)),
    percentage: Number(percentage.toFixed(2)),
  };
};

const emptyClinicalReference = (field) => ({
  value: null,
  status: "reference_standard_required",
  field,
});

const getHistory = (baby) =>
  (baby.growth_history ?? [])
    .slice()
    .sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at));

const ensureLegacyBaseline = (baby) => {
  const history = getHistory(baby);
  if (history.length) return history;

  if (!baby.weight && !baby.length && !baby.head_circumference) return [];

  return [
    {
      _id: null,
      recorded_at: baby.createdAt ?? baby.date_of_birth,
      weight: baby.weight,
      length: baby.length,
      head_circumference: baby.head_circumference,
      source: "registration",
    },
  ];
};

const buildProgress = (baby, history) => {
  const latest = history[0] ?? null;
  const previous = history[1] ?? null;

  const change = {
    weight: latest ? calculateChange(latest.weight, previous?.weight, "weight") : { absolute: null, percentage: null },
    length: latest ? calculateChange(latest.length, previous?.length, "length") : { absolute: null, percentage: null },
    head_circumference: latest ? calculateChange(latest.head_circumference, previous?.head_circumference, "head_circumference") : { absolute: null, percentage: null },
  };

  return {
    latest_growth: latest ? serializeGrowth(latest) : null,
    previous_growth: previous ? serializeGrowth(previous) : null,
    change,
    percentiles: {
      weight_for_age: emptyClinicalReference("weight_for_age"),
      length_for_age: emptyClinicalReference("length_for_age"),
      head_circumference_for_age: emptyClinicalReference("head_circumference_for_age"),
      weight_for_length: emptyClinicalReference("weight_for_length"),
    },
    developmental_milestones: {
      status: "reference_data_required",
      items: [],
    },
  };
};

export const addGrowthRecord = async (userId, babyId, payload) => {
  const profile = await ensurePatientProfile(userId);
  const pregnancy = getCurrentPregnancy(profile);
  const baby = findBaby(pregnancy, babyId);

  if (!payload.weight && !payload.length && !payload.head_circumference) {
    throw new AppError("At least one growth measurement is required", 400);
  }

  const record = {
    recorded_at: payload.recorded_at ? new Date(payload.recorded_at) : new Date(),
    weight: payload.weight ?? null,
    length: payload.length ?? null,
    head_circumference: payload.head_circumference ?? null,
    source: "patient_update",
  };

  if (Number.isNaN(record.recorded_at.getTime())) {
    throw new AppError("recorded_at must be a valid date", 400);
  }

  if (record.recorded_at > new Date()) {
    throw new AppError("recorded_at cannot be in the future", 400);
  }

  baby.growth_history.push(record);

  // Keep the legacy top-level fields synchronized with the latest measurement
  // for backwards compatibility with existing My Baby consumers.
  if (record.weight) baby.weight = record.weight;
  if (record.length) baby.length = record.length;
  if (record.head_circumference) baby.head_circumference = record.head_circumference;

  await profile.save();

  return serializeGrowth(baby.growth_history[baby.growth_history.length - 1]);
};

export const getGrowthHistory = async (userId, babyId, query) => {
  const profile = await ensurePatientProfile(userId);
  const pregnancy = getCurrentPregnancy(profile);
  const baby = findBaby(pregnancy, babyId);
  const filters = parseFilters(query);
  const history = filterGrowth(ensureLegacyBaseline(baby), filters);
  const sorted = history.slice().sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at));

  return {
    baby_id: baby._id.toString(),
    filters: { date: filters.date, from: filters.from, to: filters.to },
    latest: sorted[0] ? serializeGrowth(sorted[0]) : null,
    history: sorted.map(serializeGrowth),
    total_records: sorted.length,
    total_records_all: ensureLegacyBaseline(baby).length,
  };
};

export const getBabyProgress = async (userId, babyId, query = {}) => {
  const profile = await ensurePatientProfile(userId);
  const pregnancy = getCurrentPregnancy(profile);
  const baby = findBaby(pregnancy, babyId);
  const filters = parseFilters(query);
  const allHistory = ensureLegacyBaseline(baby);
  const history = filterGrowth(allHistory, filters)
    .slice()
    .sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at));
  const progress = buildProgress(baby, history);

  return {
    baby: {
      id: baby._id.toString(),
      full_name: baby.full_name,
      date_of_birth: baby.date_of_birth,
      gender: baby.gender,
      photos: (baby.photos ?? []).map((photo) => ({
        id: photo._id.toString(),
        url: photo.url,
        public_id: photo.public_id,
      })),
    },
    age: calculateAge(baby.date_of_birth),
    ...progress,
    total_growth_records: history.length,
    total_growth_records_all: allHistory.length,
    filters: { date: filters.date, from: filters.from, to: filters.to },
  };
};

export const getBabyProgressReport = async (userId, babyId, query) => {
  const profile = await ensurePatientProfile(userId);
  const pregnancy = getCurrentPregnancy(profile);
  const baby = findBaby(pregnancy, babyId);
  const filters = parseFilters(query);
  const allHistory = ensureLegacyBaseline(baby);
  const history = filterGrowth(allHistory, filters).slice().sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at));

  const chart = {
    weight: history.filter((r) => r.weight).map((r) => ({ recorded_at: r.recorded_at, value: r.weight.value, unit: r.weight.unit })),
    length: history.filter((r) => r.length).map((r) => ({ recorded_at: r.recorded_at, value: r.length.value, unit: r.length.unit })),
    head_circumference: history.filter((r) => r.head_circumference).map((r) => ({ recorded_at: r.recorded_at, value: r.head_circumference.value, unit: r.head_circumference.unit })),
  };

  const progress = buildProgress(baby, history);

  return {
    baby: {
      id: baby._id.toString(),
      full_name: baby.full_name,
      date_of_birth: baby.date_of_birth,
      gender: baby.gender,
    },
    age: calculateAge(baby.date_of_birth),
    summary: {
      latest_growth: progress.latest_growth,
      previous_growth: progress.previous_growth,
      change: progress.change,
      percentiles: progress.percentiles,
      developmental_milestones: progress.developmental_milestones,
    },
    filters: { date: filters.date, from: filters.from, to: filters.to },
    records: history.map(serializeGrowth),
    chart,
    total_records: history.length,
    total_records_all: allHistory.length,
  };
};

export const findBabyForProgress = async (userId, babyId) => {
  const profile = await ensurePatientProfile(userId);
  const pregnancy = getCurrentPregnancy(profile);
  return findBaby(pregnancy, babyId);
};
