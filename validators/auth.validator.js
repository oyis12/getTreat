import { body } from "express-validator";

const passwordRules = [
  body("password")
    .isString()
    .withMessage("Password must be a string")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long"),
];

export const signupValidator = [
  body("fullname")
    .trim()
    .notEmpty()
    .withMessage("Fullname is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Fullname must be between 2 and 100 characters"),

  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("A valid email is required")
    .normalizeEmail(),

  body("phone_no")
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 7, max: 30 })
    .withMessage("Phone number is invalid"),

  body("birth_date")
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage("Birth date must be a valid date"),

  ...passwordRules,

  body("addr")
    .optional()
    .isObject()
    .withMessage("Address must be an object"),

  body("addr.country")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Country is too long"),

  body("addr.state")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("State is too long"),

  body("addr.city")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("City is too long"),

  body("addr.zip")
    .optional()
    .trim()
    .isLength({ max: 30 })
    .withMessage("ZIP code is too long"),

  body("addr.house_no")
    .optional()
    .trim()
    .isLength({ max: 150 })
    .withMessage("House number is too long"),

  body("role")
    .optional()
    .isIn(["patient", "provider"])
    .withMessage("Invalid role"),
];

export const signinValidator = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("A valid email is required")
    .normalizeEmail(),

  body("password")
    .isString()
    .notEmpty()
    .withMessage("Password is required"),
];

export const verifyValidator = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("A valid email is required")
    .normalizeEmail(),

  body("code")
    .trim()
    .notEmpty()
    .withMessage("Verification code is required")
    .matches(/^\d{6}$/)
    .withMessage("Verification code must be 6 digits"),
];

export const resendValidator = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("A valid email is required")
    .normalizeEmail(),
];

export const forgotPasswordValidator = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("A valid email is required")
    .normalizeEmail(),
];

export const newPasswordValidator = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("A valid email is required")
    .normalizeEmail(),

  body("code")
    .trim()
    .notEmpty()
    .withMessage("Reset code is required")
    .matches(/^\d{6}$/)
    .withMessage("Reset code must be 6 digits"),

  ...passwordRules,
];

export const completeProfileValidator = [
  body("phone_no")
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 7, max: 30 })
    .withMessage("Phone number is invalid"),

  body("gender")
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 30 })
    .withMessage("Gender is invalid"),

  body("birth_date")
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage("Birth date must be a valid date"),

  body("addr")
    .optional()
    .isObject()
    .withMessage("Address must be an object"),

  body("addr.country")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Country is too long"),

  body("addr.city")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("City is too long"),

  body("addr.state")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("State is too long"),

  body("addr.zip")
    .optional()
    .trim()
    .isLength({ max: 30 })
    .withMessage("ZIP code is too long"),

  body("addr.house_no")
    .optional()
    .trim()
    .isLength({ max: 150 })
    .withMessage("House number is too long"),
];

export const refreshTokenValidator = [
  body("refresh_token")
    .trim()
    .notEmpty()
    .withMessage("Refresh token is required"),
];