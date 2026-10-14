import multer from "multer";

const allowed = new Set(["image/jpeg", "image/png", "application/pdf"]);
const fileFilter = (_req, file, callback) => {
  const isProfilePhoto = file.fieldname === "profile_image";
  if (!allowed.has(file.mimetype) || (isProfilePhoto && !["image/jpeg", "image/png"].includes(file.mimetype))) {
    return callback(new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname));
  }
  callback(null, true);
};

export const uploadProviderRegistrationFiles = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 4, fieldSize: 10 * 1024 },
  fileFilter,
}).fields([
  { name: "profile_image", maxCount: 1 },
  { name: "higher_institution_certificate", maxCount: 1 },
  { name: "nysc_certificate", maxCount: 1 },
  { name: "medical_license", maxCount: 1 },
]);
