import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;


export const hashPassword = async (password) => {
  if (!password || typeof password !== "string") {
    throw new Error("A valid password is required");
  }

  return bcrypt.hash(password, SALT_ROUNDS);
};

export const comparePassword = async (
  password,
  passwordHash
) => {
  if (!password || !passwordHash) {
    return false;
  }

  return bcrypt.compare(password, passwordHash);
};

export default {
  hashPassword,
  comparePassword,
};