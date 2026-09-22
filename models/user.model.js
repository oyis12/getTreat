import mongoose from "mongoose";

const { Schema } = mongoose;

const authSchema = new Schema(
  {
    providers: {
      local: {
        enabled: {
          type: Boolean,
          default: false,
        },
      },

      google: {
        enabled: {
          type: Boolean,
          default: false,
        },

        googleId: {
          type: String,
          default: null,
          trim: true,
        },
      },
    },
  },
  {
    _id: false,
  }
);

const userSchema = new Schema(
  {
    fullname: {
      type: String,
      required: [true, "Fullname is required"],
      trim: true,
      minlength: 2,
      maxlength: 120,
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },

    password: {
      type: String,
      select: false,
      default: null,
    },

    role: {
      type: String,
      enum: {
        values: ["patient", "provider", "admin", "super_admin"],
        message: "Invalid user role",
      },
      default: "patient",
      index: true,
    },

    auth: {
      type: authSchema,

      default: () => ({
        providers: {
          local: {
            enabled: false,
          },

          google: {
            enabled: false,
            googleId: null,
          },
        },
      }),
    },

    emailVerified: {
      type: Boolean,
      default: false,
      index: true,
    },

    accountStatus: {
      type: String,
      enum: {
        values: [
          "pending",
          "active",
          "suspended",
          "deactivated",
        ],
        message: "Invalid account status",
      },
      default: "pending",
      index: true,
    },

    // Server-controlled onboarding state. Clients must never mass-assign this field.
    page: {
      type: String,
      enum: {
        values: [
          "verify",
          "complete_profile",
          "preferences",
          "dashboard",
        ],
        message: "Invalid onboarding page",
      },
      default: "verify",
      index: true,
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },
  },

  {
    timestamps: {
      createdAt: "createdAt",
      updatedAt: "modifiedAt",
    },

    versionKey: false,
  }
);

userSchema.index(
  { "auth.providers.google.googleId": 1 },
  {
    unique: true,
    sparse: true,
  }
);

userSchema.pre("save", function (next) {
  if (this.email) {
    this.email = this.email.toLowerCase().trim();
  }

});

userSchema.set("toJSON", {
  transform: function (_doc, ret) {
    ret.id = ret._id?.toString();

    delete ret._id;
    delete ret.password;

    if (ret.auth?.providers?.google) {
      delete ret.auth.providers.google.googleId;
    }

    return ret;
  },
});

const User = mongoose.model("User", userSchema);

export default User;
