
import nodemailer from "nodemailer";
import { env } from "../config/env.js";


export const mailTransporter = nodemailer.createTransport({
  host: "smtp-relay.resend.com",
  port: 587,
  secure: false,
  auth: {
    user: env.smtpUser,
    pass: env.smtpPass,
  },
  pool: true,
  maxConnections: 5,
  connectionTimeout: 20000, // 20s
  greetingTimeout: 20000,
  socketTimeout: 20000,
});