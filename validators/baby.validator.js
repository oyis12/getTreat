import AppError from "../utils/AppError.js";

const ALLOWED_CREATE_FIELDS = [
  "full_name",
  "date_of_birth",
  "gender",
  "weight",
  "length",
  "head_circumference",
];

const ALLOWED_UPDATE_FIELDS = [
  "full_name",
  "date_of_birth",
  "gender",
  "weight",
  "length",
  "head_circumference",
];

const GENDERS = ["male", "female"];

const WEIGHT_UNITS = ["kg", "lbs"];

const LENGTH_UNITS = ["cm", "m"];

const isValidDate = (value) => {
  if (typeof value !== "string" && !(value instanceof Date)) {
    return false;
  }

  const date = new Date(value);

  return !Number.isNaN(date.getTime());
};

const isFutureDate = (value) => {
  const date = new Date(value);

  return date.getTime() > Date.now();
};

const validateMeasurement = (
  measurement,
  fieldName,
  allowedUnits,
  { allowNull = true } = {}
) => {
  if (measurement === null) {
    if (allowNull) {
      return;
    }

    throw new AppError(
      `${fieldName} cannot be null`,
      400
    );
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

  const allowedFields = ["value", "unit"];

  const unknownFields = Object.keys(measurement).filter(
    (key) => !allowedFields.includes(key)
  );

  if (unknownFields.length > 0) {
    throw new AppError(
      `Unknown field(s) in ${fieldName}: ${unknownFields.join(", ")}`,
      400
    );
  }

  if (
    measurement.value === undefined ||
    measurement.value === null
  ) {
    throw new AppError(
      `${fieldName}.value is required`,
      400
    );
  }

  if (
    typeof measurement.value !== "number" ||
    !Number.isFinite(measurement.value) ||
    measurement.value < 0
  ) {
    throw new AppError(
      `${fieldName}.value must be a valid non-negative number`,
      400
    );
  }

  if (typeof measurement.unit !== "string") {
    throw new AppError(
      `${fieldName}.unit is required`,
      400
    );
  }

  const normalizedUnit =
    measurement.unit.toLowerCase().trim();

  if (!allowedUnits.includes(normalizedUnit)) {
    throw new AppError(
      `${fieldName}.unit must be one of: ${allowedUnits.join(", ")}`,
      400
    );
  }
};

const validateUnknownFields = (
  body,
  allowedFields
) => {
  const unknownFields = Object.keys(body).filter(
    (key) => !allowedFields.includes(key)
  );

  if (unknownFields.length > 0) {
    throw new AppError(
      `Unknown field(s): ${unknownFields.join(", ")}`,
      400
    );
  }
};


export const validateCreateBaby = (
  req,
  _res,
  next
) => {
  try {
    const body = req.body ?? {};

    validateUnknownFields(
      body,
      ALLOWED_CREATE_FIELDS
    );

    if (
      typeof body.full_name !== "string" ||
      !body.full_name.trim()
    ) {
      throw new AppError(
        "full_name is required",
        400
      );
    }

    const fullName = body.full_name.trim();

    if (fullName.length < 2) {
      throw new AppError(
        "full_name must be at least 2 characters",
        400
      );
    }

    if (fullName.length > 100) {
      throw new AppError(
        "full_name must not exceed 100 characters",
        400
      );
    }

    if (
      body.date_of_birth === undefined ||
      body.date_of_birth === null ||
      body.date_of_birth === ""
    ) {
      throw new AppError(
        "date_of_birth is required",
        400
      );
    }

    if (!isValidDate(body.date_of_birth)) {
      throw new AppError(
        "date_of_birth must be a valid date",
        400
      );
    }

    if (isFutureDate(body.date_of_birth)) {
      throw new AppError(
        "date_of_birth cannot be in the future",
        400
      );
    }

    if (
      typeof body.gender !== "string" ||
      !body.gender.trim()
    ) {
      throw new AppError(
        "gender is required",
        400
      );
    }

    const gender = body.gender
      .toLowerCase()
      .trim();

    if (!GENDERS.includes(gender)) {
      throw new AppError(
        "gender must be male or female",
        400
      );
    }

    if (body.weight !== undefined) {
      validateMeasurement(
        body.weight,
        "weight",
        WEIGHT_UNITS
      );
    }

    if (body.length !== undefined) {
      validateMeasurement(
        body.length,
        "length",
        LENGTH_UNITS
      );
    }

    if (
      body.head_circumference !== undefined
    ) {
      validateMeasurement(
        body.head_circumference,
        "head_circumference",
        LENGTH_UNITS
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const validateUpdateBaby = (
  req,
  _res,
  next
) => {
  try {
    const body = req.body ?? {};

    validateUnknownFields(
      body,
      ALLOWED_UPDATE_FIELDS
    );

    if (Object.keys(body).length === 0) {
      throw new AppError(
        "At least one field is required to update the baby",
        400
      );
    }

    if (body.full_name !== undefined) {
      if (
        typeof body.full_name !== "string" ||
        !body.full_name.trim()
      ) {
        throw new AppError(
          "full_name must be a non-empty string",
          400
        );
      }

      const fullName = body.full_name.trim();

      if (fullName.length < 2) {
        throw new AppError(
          "full_name must be at least 2 characters",
          400
        );
      }

      if (fullName.length > 100) {
        throw new AppError(
          "full_name must not exceed 100 characters",
          400
        );
      }
    }

    if (body.date_of_birth !== undefined) {
      if (
        body.date_of_birth === null ||
        body.date_of_birth === ""
      ) {
        throw new AppError(
          "date_of_birth cannot be empty",
          400
        );
      }

      if (!isValidDate(body.date_of_birth)) {
        throw new AppError(
          "date_of_birth must be a valid date",
          400
        );
      }

      if (isFutureDate(body.date_of_birth)) {
        throw new AppError(
          "date_of_birth cannot be in the future",
          400
        );
      }
    }

    if (body.gender !== undefined) {
      if (
        typeof body.gender !== "string" ||
        !body.gender.trim()
      ) {
        throw new AppError(
          "gender must be a non-empty string",
          400
        );
      }

      const gender = body.gender
        .toLowerCase()
        .trim();

      if (!GENDERS.includes(gender)) {
        throw new AppError(
          "gender must be male or female",
          400
        );
      }
    }

    if (body.weight !== undefined) {
      validateMeasurement(
        body.weight,
        "weight",
        WEIGHT_UNITS
      );
    }

    if (body.length !== undefined) {
      validateMeasurement(
        body.length,
        "length",
        LENGTH_UNITS
      );
    }

    if (
      body.head_circumference !== undefined
    ) {
      validateMeasurement(
        body.head_circumference,
        "head_circumference",
        LENGTH_UNITS
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};