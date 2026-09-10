import mongoose from "mongoose";

const { Schema } = mongoose;

const addressSchema = new Schema(
  {
    country: {
      type: String,
      trim: true,
      maxlength: 100,
    },

    city: {
      type: String,
      trim: true,
      maxlength: 100,
    },

    state: {
      type: String,
      trim: true,
      maxlength: 100,
    },

    zip: {
      type: String,
      trim: true,
      maxlength: 30,
    },

    house_no: {
      type: String,
      trim: true,
      maxlength: 200,
    },
  },
  {
    _id: false,
  }
);

const authProviderSchema = new Schema(
  {
    enabled: {
      type: Boolean,
      default: false,
    },

    googleId: {
      type: String,
      default: null,
      sparse: true,
    },
  },
  {
    _id: false,
  }
);

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
          sparse: true,
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
      index: true,
      maxlength: 254,
    },

    phone_no: {
      type: String,
      trim: true,
      maxlength: 30,
      default: null,
    },

    birth_date: {
      type: Date,
      default: null,
    },

    gender: {
      type: String,
      trim: true,
      maxlength: 50,
      default: null,
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
            googleId: null,
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
        values: ["pending", "active", "suspended", "deactivated"],
        message: "Invalid account status",
      },
      default: "pending",
      index: true,
    },

    profileCompleted: {
      type: Boolean,
      default: false,
    },

    profileImage: {
      type: String,
      trim: true,
      default: null,
    },

    profileImagePublicId: {
      type: String,
      trim: true,
      default: null,
    },

    address: {
      type: addressSchema,
      default: () => ({}),
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },

    modifiedAt: {
      type: Date,
      default: Date.now,
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

  next();
});


userSchema.set("toJSON", {
  transform: function (_doc, ret) {
    ret.id = ret._id?.toString();

    delete ret._id;
    delete ret.__v;
    delete ret.password;

    return ret;
  },
});

const User = mongoose.model("User", userSchema);

export default User;