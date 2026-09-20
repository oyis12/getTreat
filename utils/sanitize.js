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
    role: source.role,
    emailVerified: source.emailVerified,
    accountStatus: source.accountStatus,
    page: source.page || null,
    lastLoginAt: source.lastLoginAt,
    created_at:
      source.createdAt || source.created_at,
    modified_at:
      source.modifiedAt || source.updatedAt || source.modified_at,
  };
};

export default sanitizeUser;
