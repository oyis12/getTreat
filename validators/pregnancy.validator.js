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

    if (req.body.status !== undefined && !["active", "completed", "ended"].includes(req.body.status)) {
      throw new AppError("Invalid pregnancy status", 400);
    }

    if (req.body.has_fibroid !== undefined && typeof req.body.has_fibroid !== "boolean") {
      throw new AppError("has_fibroid must be a boolean", 400);
    }

    next();
  } catch (error) {
    next(error);
  }
};

export default validatePregnancyPayload;
