import mongoose from "mongoose";

const { Schema } = mongoose;

const refreshTokenSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    tokenHash: {
      type: String,
      required: true,
      select: false,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },

    revokedAt: {
      type: Date,
      default: null,
      index: true,
    },

    replacedByTokenHash: {
      type: String,
      default: null,
      select: false,
    },

    userAgent: {
      type: String,
      default: null,
      maxlength: 1000,
    },

    ipAddress: {
      type: String,
      default: null,
      maxlength: 100,
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

refreshTokenSchema.index({
  user: 1,
  revokedAt: 1,
});

refreshTokenSchema.index({
  expiresAt: 1,
});


refreshTokenSchema.index(
  { expiresAt: 1 },
  {
    expireAfterSeconds: 0,
  }
);

const RefreshToken = mongoose.model(
  "RefreshToken",
  refreshTokenSchema
);

export default RefreshToken;