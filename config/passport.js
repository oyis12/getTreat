import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/user.model.js";
import { env } from "./env.js";

export const configurePassport = () => {
  passport.use(
    new GoogleStrategy(
      {
        clientID: env.googleClientId,
        clientSecret: env.googleClientSecret,
        callbackURL: env.googleCallbackUrl
      },

      async (accessToken, refreshToken, profile, done) => {
        try {
          const googleId = profile.id;

          const email =
            profile.emails?.[0]?.value?.toLowerCase()?.trim();

          if (!email) {
            return done(
              new Error(
                "Google account does not contain a usable email address"
              ),
              null
            );
          }


          let user = await User.findOne({
            "auth.providers.google.googleId": googleId,
          });

          if (user) {
            return done(null, user);
          }

          user = await User.findOne({ email });

          if (user) {
            user.auth.providers.google.enabled = true;
            user.auth.providers.google.googleId = googleId;


            user.emailVerified = true;

            if (user.accountStatus === "pending") {
              user.accountStatus = "active";
            }


            await user.save();

            return done(null, user);
          }


          const fullname =
            profile.displayName ||
            `${profile.name?.givenName || ""} ${
              profile.name?.familyName || ""
            }`.trim() ||
            "GetTreat User";

          user = await User.create({
            fullname,
            email,

            auth: {
              providers: {
                local: {
                  enabled: false,
                  googleId: null,
                },

                google: {
                  enabled: true,
                  googleId,
                },
              },
            },

            emailVerified: true,
            accountStatus: "active",
            profileCompleted: false,
            role: "patient",
          });

          return done(null, user);
        } catch (error) {
          return done(error, null);
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);

      if (!user) {
        return done(null, false);
      }

      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  });

  return passport;
};

export default passport;