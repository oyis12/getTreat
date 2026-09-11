export const sanitizeUser = (user) => {
  if (!user) {
    return null;
  }

  const source =
    typeof user.toObject === "function"
      ? user.toObject()
      : { ...user };

  const id =
    source.id ||
    source._id?.toString();

  delete source._id;
  delete source.__v;
  delete source.password;

  if (source.auth?.providers?.google) {
    delete source.auth.providers.google.googleId;
  }

  return {
    id,
    fullname: source.fullname,
    email: source.email,
    phone_no: source.phone_no,
    birth_date: source.birth_date,
    gender: source.gender,
    address: source.address,
    role: source.role,
    emailVerified: source.emailVerified,
    accountStatus: source.accountStatus,
    profileCompleted: source.profileCompleted,
    profileImage: source.profileImage,
    lastLoginAt: source.lastLoginAt,
    created_at:
      source.createdAt || source.created_at,
    modified_at:
      source.updatedAt ||
      source.modified_at,
  };
};

export default sanitizeUser;