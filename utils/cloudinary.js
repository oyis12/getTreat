import cloudinary from "../config/cloudinary.js";

export const deleteCloudinaryImage = async (publicId) => {
  if (!publicId) return null;

  return cloudinary.uploader.destroy(publicId, {
    resource_type: "image",
    invalidate: true,
  });
};
