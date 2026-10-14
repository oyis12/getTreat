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
import { requireActivePlatformSubscription } from "../middlewares/platform-subscription.middleware.js";

const router = express.Router();

router.post(
  "/",
  protect,
  requireActivePlatformSubscription,
  validateCreateBaby,
  createBabyController
);

router.get(
  "/",
  protect,
  requireActivePlatformSubscription,
  getBabiesController
);

router.post(
  "/:babyId/photos",
  protect,
  requireActivePlatformSubscription,
  uploadBabyPhoto,
  addBabyPhotoController
);

router.delete(
  "/:babyId/photos/:photoId",
  protect,
  requireActivePlatformSubscription,
  deleteBabyPhotoController
);

router.patch(
  "/:babyId/photos/:photoId",
  protect,
  requireActivePlatformSubscription,
  uploadBabyPhoto,
  updateBabyPhotoController
);

router.get(
  "/:babyId",
  protect,
  requireActivePlatformSubscription,
  getBabyController
);

router.patch(
  "/:babyId",
  protect,
  requireActivePlatformSubscription,
  validateUpdateBaby,
  updateBabyController
);


router.delete(
  "/:babyId",
  protect,
  requireActivePlatformSubscription,
  deleteBabyController
);

export default router;
