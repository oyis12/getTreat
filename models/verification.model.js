import mongoose from "mongoose";

const { Schema } = mongoose;

const verificationSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
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
    },

    expiresAt: {
      type: Date,
      required: true,
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