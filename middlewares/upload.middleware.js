import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "gettreat/patient-profiles",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    resource_type: "image",
    transformation: [
      {
        width: 800,
        height: 800,
        crop: "limit",
        quality: "auto",
        fetch_format: "auto",
      },
    ],
    public_id: (req, file) => {
      const userId = req.user?.id?.toString();

      if (!userId) {
        throw new Error("Authenticated user is required for profile image upload");
      }

      return `${userId}-${Date.now()}`;
    },
  },
});

const fileFilter = (_req, file, callback) => {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return callback(
      new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname)
    );
  }

  callback(null, true);
};

export const uploadPatientProfileImage = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter,
}).single("profile_image");

export default uploadPatientProfileImage;
