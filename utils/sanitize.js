export const sanitizeUser = (user) => {
  if (!user) {
    return null;
  }

  const source =
    typeof user.toObject === "function"
      ? user.toObject()
      : { ...user };

  delete source._id;
  delete source.__v;
  delete source.password;

  if (source.auth?.providers) {
    const providers = source.auth.providers;

    source.auth = {
      providers: {
        local: {
          enabled:
            providers.local?.enabled || false,
        },

        google: {
          enabled:
            providers.google?.enabled || false,
        },
      },
    };
  }

  if (source._id) {
    source.id = source._id.toString();
    delete source._id;
  }

  return source;
};

export default {
  sanitizeUser,
};