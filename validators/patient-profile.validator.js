import AppError from "../utils/AppError.js";

const isValidDate = (value) => {
  const date = new Date(value);

  return !Number.isNaN(date.getTime());
};

export const validatePatientProfileUpdate = (req, _res, next) => {
  try {
    const {
      fullname,
      phone_no,
      birth_date,
      gender,
      address,
    } = req.body;

    // Reject unknown top-level fields
    const allowedFields = [
      "fullname",
      "phone_no",
      "birth_date",
      "gender",
      "address",
    ];

    const receivedFields = Object.keys(req.body);

    const unknownFields = receivedFields.filter(
      (field) => !allowedFields.includes(field)
    );

    if (unknownFields.length > 0) {
      throw new AppError(
        `Unknown profile field(s): ${unknownFields.join(", ")}`,
        400
      );
    }

    // Fullname
    if (fullname !== undefined) {
      if (typeof fullname !== "string") {
        throw new AppError("Fullname must be a string", 400);
      }

      const trimmedFullname = fullname.trim();

      if (trimmedFullname.length < 2) {
        throw new AppError(
          "Fullname must be at least 2 characters",
          400
        );
      }

      if (trimmedFullname.length > 120) {
        throw new AppError(
          "Fullname cannot exceed 120 characters",
          400
        );
      }
    }

    // Phone number
    if (phone_no !== undefined) {
      if (phone_no !== null && typeof phone_no !== "string") {
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

    // Birth date
    if (birth_date !== undefined) {
      if (birth_date !== null && !isValidDate(birth_date)) {
        throw new AppError(
          "Invalid birth date",
          400
        );
      }

      if (birth_date !== null) {
        const birthDate = new Date(birth_date);
        const now = new Date();

        if (birthDate > now) {
          throw new AppError(
            "Birth date cannot be in the future",
            400
          );
        }
      }
    }

    // Gender
    if (gender !== undefined) {
      if (gender !== null && typeof gender !== "string") {
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

    // Address
    if (address !== undefined) {
      if (
        address === null ||
        typeof address !== "object" ||
        Array.isArray(address)
      ) {
        throw new AppError(
          "Address must be an object",
          400
        );
      }

      const allowedAddressFields = [
        "country",
        "city",
        "state",
        "zip",
        "house_no",
      ];

      const unknownAddressFields = Object.keys(address).filter(
        (field) => !allowedAddressFields.includes(field)
      );

      if (unknownAddressFields.length > 0) {
        throw new AppError(
          `Unknown address field(s): ${unknownAddressFields.join(", ")}`,
          400
        );
      }

      for (const field of allowedAddressFields) {
        if (address[field] !== undefined && address[field] !== null) {
          if (typeof address[field] !== "string") {
            throw new AppError(
              `Address ${field} must be a string`,
              400
            );
          }
        }
      }

      if (
        typeof address.country === "string" &&
        address.country.trim().length > 100
      ) {
        throw new AppError(
          "Country cannot exceed 100 characters",
          400
        );
      }

      if (
        typeof address.city === "string" &&
        address.city.trim().length > 100
      ) {
        throw new AppError(
          "City cannot exceed 100 characters",
          400
        );
      }

      if (
        typeof address.state === "string" &&
        address.state.trim().length > 100
      ) {
        throw new AppError(
          "State cannot exceed 100 characters",
          400
        );
      }

      if (
        typeof address.zip === "string" &&
        address.zip.trim().length > 30
      ) {
        throw new AppError(
          "ZIP/postal code cannot exceed 30 characters",
          400
        );
      }

      if (
        typeof address.house_no === "string" &&
        address.house_no.trim().length > 200
      ) {
        throw new AppError(
          "House number/address cannot exceed 200 characters",
          400
        );
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

export default validatePatientProfileUpdate;