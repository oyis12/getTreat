import "dotenv/config";

const required = (key, fallback = undefined) => {
  const value = process.env[key] ?? fallback;

  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
};

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",

  isPublicDns: process.env.FORCE_PUBLIC_DNS,
  isProd: process.env.NODE_ENV === "production",

  port: parseInt(process.env.PORT || "7700", 10),

  mongoUri: required("MONGO_URI"),

  frontendUrl: process.env.FRONTEND_URL || "https://www.gettreat.com",

  corsOrigins: (process.env.CORS_ORIGINS || "").split(",").map((origin) => origin.trim()).filter(Boolean),

  jwtAccessSecret: required("JWT_ACCESS_SECRET"),
  jwtRefreshSecret: required("JWT_REFRESH_SECRET"),

  cloudinaryApiKey: required("CLOUD_API_KEY"),
  cloudinaryApiSecret: required("CLOUD_API_SECRET"),
  cloudinaryCloudName: required("CLOUD_NAME"),

  smtpUser: process.env.SMTP_USER || "resend",
  smtpPass: process.env.SMTP_PASS || "",

  mailFrom: process.env.MAIL_FROM || "GetTreat <noreply@gettreat.com>",

  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL || "http://localhost:7700/auth/google/callback",

  accessTokenExpiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "15m",

  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "30d",

  verificationCodeExpiresMinutes: parseInt(process.env.VERIFICATION_CODE_EXPIRES_MINUTES || "10",10 ),

  maxOtpAttempts: parseInt(process.env.MAX_OTP_ATTEMPTS || "5",10),
};