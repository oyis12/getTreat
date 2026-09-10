import jwt from "jsonwebtoken";
import crypto from "crypto";
import { env } from "../config/env.js";


const ACCESS_TOKEN_EXPIRES_IN = "15m";
const REFRESH_TOKEN_EXPIRES_IN = "30d";

export const generateAccessToken = (user) => {
  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
      type: "access",
    },
    env.jwtAccessSecret,
    {
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
      issuer: "gettreat-api",
      audience: "gettreat-client",
    }
  );
};

export const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      sub: user._id.toString(),
      type: "refresh",
      tokenId: crypto.randomUUID(),
    },
    env.jwtRefreshSecret,
    {
      expiresIn: REFRESH_TOKEN_EXPIRES_IN,
      issuer: "gettreat-api",
      audience: "gettreat-client",
    }
  );
};


export const verifyAccessToken = (token) => {
  return jwt.verify(
    token,
    env.jwtAccessSecret,
    {
      issuer: "gettreat-api",
      audience: "gettreat-client",
    }
  );
};


export const verifyRefreshToken = (token) => {
  return jwt.verify(
    token,
    env.jwtRefreshSecret,
    {
      issuer: "gettreat-api",
      audience: "gettreat-client",
    }
  );
};

export const getTokenExpirationDate = (token) => {
  const decoded = jwt.decode(token);

  if (!decoded || !decoded.exp) {
    return null;
  }

  return new Date(decoded.exp * 1000);
};


export const hashToken = (token) => {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
};

export default {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  getTokenExpirationDate,
  hashToken,
};