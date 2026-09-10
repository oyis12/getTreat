import crypto from "crypto";

export const OTP_LENGTH = 6;

export const OTP_EXPIRY_MINUTES = 10;

export const generateOtp = () => {
  const max = 10 ** OTP_LENGTH;

  const number = crypto.randomInt(0, max);

  return number.toString().padStart(OTP_LENGTH, "0");
};

export const hashOtp = (otp) => {
  return crypto
    .createHash("sha256")
    .update(otp)
    .digest("hex");
};

export const compareOtp = (otp, otpHash) => {
  if (!otp || !otpHash) {
    return false;
  }

  const hashedOtp = hashOtp(otp);

  return crypto.timingSafeEqual(
    Buffer.from(hashedOtp, "hex"),
    Buffer.from(otpHash, "hex")
  );
};

export const getOtpExpiry = (
  minutes = OTP_EXPIRY_MINUTES
) => {
  return new Date(
    Date.now() + minutes * 60 * 1000
  );
};

export default {
  generateOtp,
  hashOtp,
  compareOtp,
  getOtpExpiry,
  OTP_LENGTH,
  OTP_EXPIRY_MINUTES,
};