import mongoose from "mongoose";

const { Schema } = mongoose;

const verificationSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    codeHash: {
      type: String,
      required: true,
      select: false,
    },

    type: {
      type: String,
      enum: {
        values: [
          "email_verification",
          "password_reset",
        ],
        message: "Invalid verification type",
      },
      required: true,
      index: true,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },

    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },

    maxAttempts: {
      type: Number,
      default: 5,
      min: 1,
    },

    verifiedAt: {
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

verificationSchema.index({
  user: 1,
  type: 1,
  createdAt: -1,
});

verificationSchema.index({
  email: 1,
  type: 1,
  createdAt: -1,
});


verificationSchema.index(
  { expiresAt: 1 },
  {
    expireAfterSeconds: 0,
  }
);

const Verification = mongoose.model(
  "Verification",
  verificationSchema
);

export default Verification;