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
    folder: (req) => {
      const userId = req.user?.id?.toString();
      const babyId = req.params?.babyId?.toString();

      if (!userId || !babyId) {
        throw new Error(
          "Authenticated user and baby are required for baby photo upload"
        );
      }

      return `gettreat/babies/${userId}/${babyId}`;
    },

    allowed_formats: ["jpg", "jpeg", "png", "webp"],

    resource_type: "image",

    transformation: [
      {
        width: 1200,
        height: 1200,
        crop: "limit",
        quality: "auto",
        fetch_format: "auto",
      },
    ],

    public_id: (req, file) => {
      const userId = req.user?.id?.toString();
      const babyId = req.params?.babyId?.toString();

      if (!userId || !babyId) {
        throw new Error(
          "Authenticated user and baby are required for baby photo upload"
        );
      }

      return `photo-${Date.now()}`;
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

export const uploadBabyPhoto = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter,
}).single("photo");

export default uploadBabyPhoto