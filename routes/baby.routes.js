import express from "express";

import {
  createBabyController,
  getBabiesController,
  getBabyController,
  updateBabyController,
  deleteBabyController,
  addBabyPhotoController,
  updateBabyPhotoController,
  deleteBabyPhotoController
} from "../controllers/baby.controller.js";

import {
  validateCreateBaby,
  validateUpdateBaby,
} from "../validators/baby.validator.js";

import { protect } from "../middlewares/auth.middleware.js";
import uploadBabyPhoto from "../middlewares/baby-photo-upload.middleware.js";

const router = express.Router();

router.post(
  "/",
  protect,
  validateCreateBaby,
  createBabyController
);

router.get(
  "/",
  protect,
  getBabiesController
);

router.post(
  "/:babyId/photos",
  protect,
  uploadBabyPhoto,
  addBabyPhotoController
);

router.delete(
  "/:babyId/photos/:photoId",
  protect,
  deleteBabyPhotoController
);

router.patch(
  "/:babyId/photos/:photoId",
  protect,
  uploadBabyPhoto,
  updateBabyPhotoController
);

router.get(
  "/:babyId",
  protect,
  getBabyController
);

router.patch(
  "/:babyId",
  protect,
  validateUpdateBaby,
  updateBabyController
);


router.delete(
  "/:babyId",
  protect,
  deleteBabyController
);

export default router;