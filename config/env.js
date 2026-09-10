

import "dotenv/config";

const required = (key, fallback = undefined) => {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  isPublicDns: process.env.FORCE_PUBLIC_DNS,
  isProd: process.env.NODE_ENV === "production",
  port: parseInt(process.env.PORT || "7100", 10),


  mongoUri: required("MONGO_URI"),
  frontendUrl: process.env.FRONTEND_URL || "https://www.gettreat.com",

  corsOrigins: (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),

  jwtAccessSecret: required("JWT_ACCESS_SECRET"),
  jwtRefreshSecret: required("JWT_REFRESH_SECRET"),

  cloudinaryApiKey: required("CLOUD_API_KEY"),
  cloudinaryApiSecret: required("CLOUD_API_SECRET"),
  cloudinaryCloudName: required("CLOUD_NAME"),

  googleClientId: required("GOOGLE_CLIENT_ID"),
  googleClientSecret: required("GOOGLE_CLIENT_SECRET"),
  googleCallbackUrl: required("GOOGLE_CALLBACK_URL"),

};