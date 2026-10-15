import AppError from "../utils/AppError.js";

const isValidDate = (value) => !Number.isNaN(new Date(value).getTime());

export const validatePregnancyPayload = (req, _res, next) => {
  try {
    const allowedFields = [
      "conception_method",
      "last_menstral_date",
      "status",
      "has_fibroid",
    ];

    const unknownFields = Object.keys(req.body).filter(
      (field) => !allowedFields.includes(field)
    );
    if (unknownFields.length) {
      throw new AppError(`Unknown pregnancy field(s): ${unknownFields.join(", ")}`, 400);
    }

    if (
      req.body.conception_method !== undefined &&
      req.body.conception_method !== null &&
      !["natural_conception", "assisted_reproduction"].includes(req.body.conception_method)
    ) {
      throw new AppError("Invalid conception method", 400);
    }

    if (req.body.last_menstral_date !== undefined && req.body.last_menstral_date !== null) {
      if (!isValidDate(req.body.last_menstral_date)) {
        throw new AppError("Invalid last menstral date", 400);
      }
      if (new Date(req.body.last_menstral_date) > new Date()) {
        throw new AppError("Last menstral date cannot be in the future", 400);
      }
    }

    if (req.body.status !== undefined && !["active", "ended"].includes(req.body.status)) {
      throw new AppError("status must be active or ended; use birth confirmation to complete a delivered pregnancy", 400);
    }

    if (req.body.has_fibroid !== undefined && typeof req.body.has_fibroid !== "boolean") {
      throw new AppError("has_fibroid must be a boolean", 400);
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const validateBirthConfirmation = (req, _res, next) => {
  try {
    const body = req.body ?? {};
    const allowedFields = ["delivered", "delivery_mode", "pregnancy_id"];
    const unknown = Object.keys(body).filter((field) => !allowedFields.includes(field));
    if (unknown.length) throw new AppError(`Unknown birth-confirmation field(s): ${unknown.join(", ")}`, 400);
    if (typeof body.delivered !== "boolean") {
      throw new AppError("delivered must be a boolean", 400);
    }
    if (body.pregnancy_id !== undefined &&
        (typeof body.pregnancy_id !== "string" || !/^[a-f\d]{24}$/i.test(body.pregnancy_id))) {
      throw new AppError("pregnancy_id must be a valid pregnancy ID", 400);
    }

    if (body.delivered) {
      if (!["vaginal_birth", "cesarean_section"].includes(body.delivery_mode)) {
        throw new AppError("delivery_mode must be vaginal_birth or cesarean_section when delivered is true", 400);
      }
    } else if (body.delivery_mode !== undefined) {
      throw new AppError("delivery_mode is only accepted when delivered is true", 400);
    }

    next();
  } catch (error) {
    next(error);
  }
};

export default validatePregnancyPayload;
