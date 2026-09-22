import mongoose from "mongoose";
import AppError from "../utils/AppError.js";

const isValidDate = (value) => {
  const date = new Date(value);

  return !Number.isNaN(date.getTime());
};

const validateAddress = (address) => {
  if (
    address === null ||
    typeof address !== "object" ||
    Array.isArray(address)
  ) {
    throw new AppError("Address must be an object", 400);
  }

  const allowedFields = [
    "country",
    "city",
    "state",
    "zip",
    "house_no",
  ];

  const unknownFields = Object.keys(address).filter(
    (field) => !allowedFields.includes(field)
  );

  if (unknownFields.length > 0) {
    throw new AppError(
      `Unknown address field(s): ${unknownFields.join(", ")}`,
      400
    );
  }

  const limits = {
    country: 100,
    city: 100,
    state: 100,
    zip: 30,
    house_no: 200,
  };

  for (const field of allowedFields) {
    const value = address[field];

    if (value !== undefined && value !== null) {
      if (typeof value !== "string") {
        throw new AppError(
          `Address ${field} must be a string`,
          400
        );
      }

      if (value.trim().length > limits[field]) {
        throw new AppError(
          `Address ${field} cannot exceed ${limits[field]} characters`,
          400
        );
      }
    }
  }
};

export const validatePatientProfileUpdate = (
  req,
  _res,
  next
) => {
  try {
    const {
      fullname,
      phone_no,
      birth_date,
      gender,
      address,
      preferred_service_categories,
      service_type,
    } = req.body;

    const allowedFields = [
      "fullname",
      "phone_no",
      "birth_date",
      "gender",
      "address",
      "preferred_service_categories",
      "service_type",
    ];

    const unknownFields = Object.keys(req.body).filter(
      (field) => !allowedFields.includes(field)
    );

    if (unknownFields.length > 0) {
      throw new AppError(
        `Unknown profile field(s): ${unknownFields.join(", ")}`,
        400
      );
    }

    if (fullname !== undefined) {
      if (typeof fullname !== "string") {
        throw new AppError("Fullname must be a string", 400);
      }

      const value = fullname.trim();

      if (value.length < 2 || value.length > 120) {
        throw new AppError(
          "Fullname must be between 2 and 120 characters",
          400
        );
      }
    }

    if (phone_no !== undefined) {
      if (
        phone_no !== null &&
        typeof phone_no !== "string"
      ) {
        throw new AppError(
          "Phone number must be a string",
          400
        );
      }

      if (
        typeof phone_no === "string" &&
        phone_no.trim().length > 30
      ) {
        throw new AppError(
          "Phone number cannot exceed 30 characters",
          400
        );
      }
    }

    if (birth_date !== undefined) {
      if (
        birth_date !== null &&
        !isValidDate(birth_date)
      ) {
        throw new AppError("Invalid birth date", 400);
      }

      if (birth_date !== null) {
        const birthDate = new Date(birth_date);

        if (birthDate > new Date()) {
          throw new AppError(
            "Birth date cannot be in the future",
            400
          );
        }
      }
    }

    if (gender !== undefined) {
      if (
        gender !== null &&
        typeof gender !== "string"
      ) {
        throw new AppError(
          "Gender must be a string",
          400
        );
      }

      if (
        typeof gender === "string" &&
        gender.trim().length > 50
      ) {
        throw new AppError(
          "Gender cannot exceed 50 characters",
          400
        );
      }
    }

    if (address !== undefined) {
      validateAddress(address);
    }


    if (preferred_service_categories !== undefined) {
      if (!Array.isArray(preferred_service_categories)) {
        throw new AppError(
          "Preferred service categories must be an array",
          400
        );
      }

      const allowedCategories = ["pregnancy_care", "newborn_care"];
      const invalidCategories = preferred_service_categories.filter(
        (category) => !allowedCategories.includes(category)
      );

      if (invalidCategories.length > 0) {
        throw new AppError(
          `Invalid service category: ${invalidCategories[0]}`,
          400
        );
      }

      if (new Set(preferred_service_categories).size !== preferred_service_categories.length) {
        throw new AppError(
          "Preferred service categories cannot contain duplicates",
          400
        );
      }
    }

    if (service_type !== undefined) {
      if (!Array.isArray(service_type)) {
        throw new AppError("Service type must be an array", 400);
      }

      const invalidServiceId = service_type.find(
        (id) => !mongoose.isValidObjectId(id)
      );

      if (invalidServiceId) {
        throw new AppError("One or more service IDs are invalid", 400);
      }

      if (new Set(service_type.map(String)).size !== service_type.length) {
        throw new AppError("Service type cannot contain duplicates", 400);
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

export default validatePatientProfileUpdate;
