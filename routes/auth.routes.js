import express from "express";
import passport from "passport";

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
  googleSuccess,
  googleFailure,
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
import { protect } from "../middlewares/auth.middleware.js";

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

// Backward-compatible alias
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
  protect,
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

router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  })
);


router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: "/api/auth/google/failure",
  }),
  googleSuccess
);

router.get(
  "/google/failure",
  googleFailure
);

export default router;
