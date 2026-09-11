import express from "express";

import {
  signup,
  signin,
  verify,
  resend,
  forgotPassword,
  newPassword,
  completeProfile,
  refreshToken,
  logout,
} from "../controllers/auth.controller.js";

import {
  signupValidator,
  signinValidator,
  verifyValidator,
  resendValidator,
  forgotPasswordValidator,
  newPasswordValidator,
  completeProfileValidator,
  refreshTokenValidator,
} from "../validators/auth.validator.js";

import { validate } from "../middlewares/validation.middleware.js";

import { protect  } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post(
  "/signup",
  signupValidator,
  validate,
  signup
);


router.post(
  "/signin",
  signinValidator,
  validate,
  signin
);

router.post(
  "/verify",
  verifyValidator,
  validate,
  verify
);

router.post(
  "/resend",
  resendValidator,
  validate,
  resend
);


router.post(
  "/forgot-password",
  forgotPasswordValidator,
  validate,
  forgotPassword
);

router.post(
  "/forget-password",
  forgotPasswordValidator,
  validate,
  forgotPassword
);

router.post(
  "/new-password",
  newPasswordValidator,
  validate,
  newPassword
);

router.post(
  "/complete-profile",
  protect ,
  completeProfileValidator,
  validate,
  completeProfile
);


router.post(
  "/refresh-token",
  refreshTokenValidator,
  validate,
  refreshToken
);

router.post(
  "/logout",
  refreshTokenValidator,
  validate,
  logout
);

export default router;