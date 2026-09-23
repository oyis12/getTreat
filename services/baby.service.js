import User from "../models/user.model.js";
import PatientProfile from "../models/patient-profile.model.js";
import AppError from "../utils/AppError.js";
import cloudinary from "../config/cloudinary.js";

const ensurePatientProfile = async (userId) => {
  const user = await User.findById(userId).select(
    "role accountStatus"
  );

  if (!user) {
    throw new AppError("User account not found", 404);
  }

  if (user.role !== "patient") {
    throw new AppError(
      "This endpoint is only available to patients",
      403
    );
  }

  if (["suspended", "deactivated"].includes(user.accountStatus)) {
    throw new AppError(
      "Your account cannot be accessed",
      403
    );
  }

  const profile = await PatientProfile.findOne({
    user: userId,
  });

  if (!profile) {
    throw new AppError(
      "Patient profile not found",
      404
    );
  }

  return profile;
};

const getCurrentPregnancy = (profile) => {
  const pregnancy = profile.pregnancies.find(
    (item) => item.is_current === true
  );

  if (!pregnancy) {
    throw new AppError(
      "No active pregnancy found",
      404
    );
  }

  return pregnancy;
};

const findBaby = (pregnancy, babyId) => {
  const baby = pregnancy.babies.id(babyId);

  if (!baby) {
    throw new AppError(
      "Baby not found",
      404
    );
  }

  return baby;
};

const serializeMeasurement = (measurement) => {
  if (!measurement) {
    return null;
  }

  return {
    value: measurement.value,
    unit: measurement.unit,
  };
};

const serializeBaby = (baby) => ({
  id: baby._id.toString(),

  full_name: baby.full_name,

  date_of_birth: baby.date_of_birth,

  gender: baby.gender,

  weight: serializeMeasurement(baby.weight),

  length: serializeMeasurement(baby.length),

  head_circumference: serializeMeasurement(
    baby.head_circumference
  ),

  photos: (baby.photos ?? []).map((photo) => ({
    id: photo._id.toString(),
    url: photo.url,
    public_id: photo.public_id,
  })),

  created_at: baby.createdAt,

  modified_at: baby.updatedAt,
});

const normalizeMeasurement = (
  measurement,
  fieldName
) => {
  if (measurement === undefined || measurement === null) {
    return null;
  }

  if (
    typeof measurement !== "object" ||
    Array.isArray(measurement)
  ) {
    throw new AppError(
      `${fieldName} must be an object`,
      400
    );
  }

  const { value, unit } = measurement;

  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0
  ) {
    throw new AppError(
      `${fieldName}.value must be a valid positive number`,
      400
    );
  }

  if (typeof unit !== "string") {
    throw new AppError(
      `${fieldName}.unit is required`,
      400
    );
  }

  const normalizedUnit = unit.toLowerCase().trim();

  const allowedUnits = {
    weight: ["kg", "lbs"],
    length: ["cm", "m"],
    head_circumference: ["cm", "m"],
  };

  if (!allowedUnits[fieldName]?.includes(normalizedUnit)) {
    throw new AppError(
      `Invalid unit for ${fieldName}`,
      400
    );
  }

  return {
    value,
    unit: normalizedUnit,
  };
};

const buildBabyPayload = (payload) => {
  const babyPayload = {
    full_name: payload.full_name.trim(),
    date_of_birth: new Date(payload.date_of_birth),
    gender: payload.gender.toLowerCase().trim(),
  };

  if (payload.weight !== undefined) {
    babyPayload.weight = normalizeMeasurement(
      payload.weight,
      "weight"
    );
  }

  if (payload.length !== undefined) {
    babyPayload.length = normalizeMeasurement(
      payload.length,
      "length"
    );
  }

  if (payload.head_circumference !== undefined) {
    babyPayload.head_circumference =
      normalizeMeasurement(
        payload.head_circumference,
        "head_circumference"
      );
  }

  return babyPayload;
};


export const createBaby = async (userId, payload) => {
  const profile = await ensurePatientProfile(userId);

  const pregnancy = getCurrentPregnancy(profile);

  const babyPayload = buildBabyPayload(payload);

  pregnancy.babies.push(babyPayload);

  const baby =
    pregnancy.babies[pregnancy.babies.length - 1];

  await profile.save();

  return serializeBaby(baby);
};


export const getBabies = async (userId) => {
  const profile = await ensurePatientProfile(userId);

  const pregnancy = getCurrentPregnancy(profile);

  return pregnancy.babies.map(serializeBaby);
};


export const getBaby = async (
  userId,
  babyId
) => {
  const profile = await ensurePatientProfile(userId);

  const pregnancy = getCurrentPregnancy(profile);

  const baby = findBaby(
    pregnancy,
    babyId
  );

  return serializeBaby(baby);
};


export const updateBaby = async (
  userId,
  babyId,
  payload
) => {
  const profile = await ensurePatientProfile(userId);

  const pregnancy = getCurrentPregnancy(profile);

  const baby = findBaby(
    pregnancy,
    babyId
  );

  if (payload.full_name !== undefined) {
    baby.full_name = payload.full_name.trim();
  }

  if (payload.date_of_birth !== undefined) {
    baby.date_of_birth = new Date(
      payload.date_of_birth
    );
  }

  if (payload.gender !== undefined) {
    baby.gender = payload.gender
      .toLowerCase()
      .trim();
  }

  if (payload.weight !== undefined) {
    baby.weight = normalizeMeasurement(
      payload.weight,
      "weight"
    );
  }

  if (payload.length !== undefined) {
    baby.length = normalizeMeasurement(
      payload.length,
      "length"
    );
  }

  if (
    payload.head_circumference !== undefined
  ) {
    baby.head_circumference =
      normalizeMeasurement(
        payload.head_circumference,
        "head_circumference"
      );
  }

  await profile.save();

  return serializeBaby(baby);
};


export const deleteBaby = async (
  userId,
  babyId
) => {
  const profile = await ensurePatientProfile(userId);

  const pregnancy = getCurrentPregnancy(profile);

  const baby = findBaby(
    pregnancy,
    babyId
  );

  pregnancy.babies.pull(baby._id);

  await profile.save();

  return {
    id: baby._id.toString(),
  };
};

export const addBabyPhoto = async (userId, babyId, file) => {
  if (!file) {
    throw new AppError("Baby photo is required", 400);
  }

  const profile = await ensurePatientProfile(userId);

  const pregnancy = getCurrentPregnancy(profile);

  const baby = findBaby(pregnancy, babyId);

  if ((baby.photos ?? []).length >= 5) {
    throw new AppError(
      "A baby can have a maximum of 5 photos",
      422
    );
  }

  baby.photos.push({
    url: file.path,
    public_id: file.filename,
  });

  await profile.save();

  const addedPhoto = baby.photos[baby.photos.length - 1];

  return {
    id: addedPhoto._id.toString(),
    url: addedPhoto.url,
    public_id: addedPhoto.public_id,
  };
};

export const updateBabyPhoto = async (
  userId,
  babyId,
  photoId,
  file
) => {
  if (!file) {
    throw new AppError("Baby photo is required", 400);
  }

  const profile = await ensurePatientProfile(userId);

  const pregnancy = getCurrentPregnancy(profile);

  const baby = findBaby(pregnancy, babyId);

  const photo = baby.photos.id(photoId);

  if (!photo) {
    throw new AppError("Baby photo not found", 404);
  }

  const oldPublicId = photo.public_id;

  photo.url = file.path;
  photo.public_id = file.filename;

  try {
    await profile.save();
  } catch (error) {
    try {
      await cloudinary.uploader.destroy(file.filename, {
        resource_type: "image",
      });
    } catch (_cleanupError) {
    }

    throw error;
  }

  if (oldPublicId && oldPublicId !== file.filename) {
    try {
      await cloudinary.uploader.destroy(oldPublicId, {
        resource_type: "image",
      });
    } catch (_error) {

    }
  }

  return {
    id: photo._id.toString(),
    url: photo.url,
    public_id: photo.public_id,
  };
};

export const deleteBabyPhoto = async (userId, babyId, photoId) => {
  const profile = await ensurePatientProfile(userId);

  const pregnancy = getCurrentPregnancy(profile);

  const baby = findBaby(pregnancy, babyId);

  const photo = baby.photos?.id(photoId);

  if (!photo) {
    throw new AppError("Baby photo not found", 404);
  }

  const publicId = photo.public_id;

  baby.photos.pull(photo._id);

  await profile.save();

  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: "image",
    });
  } catch (error) {
    console.error("Failed to delete baby photo from Cloudinary:", error);
  }

  return {
    id: photoId,
  };
};