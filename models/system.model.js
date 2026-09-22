import mongoose from "mongoose";

const { Schema } = mongoose;

const platformSubscriptionSchema = new Schema(
  {
    enabled: {
      type: Boolean,
      default: true,
    },

    billing_cycle: {
      type: String,
      enum: ["monthly"],
      default: "monthly",
    },

    amount: {
      type: Number,
      min: 0,
      default: null,
    },

    currency: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 3,
      default: "NGN",
    },
  },
  { _id: false }
);

const serviceCategorySchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 50,
    },

    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    active: {
      type: Boolean,
      default: true,
    },

    sort_order: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const systemSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: "global",
      immutable: true,
      trim: true,
      lowercase: true,
    },

    platform_subscription: {
      type: platformSubscriptionSchema,
      default: () => ({}),
    },

    service_categories: {
      type: [serviceCategorySchema],
      default: () => [
        {
          code: "pregnancy_care",
          label: "Pregnancy Care",
          active: true,
          sort_order: 1,
        },
        {
          code: "newborn_care",
          label: "Newborn Care",
          active: true,
          sort_order: 2,
        },
      ],
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

const System = mongoose.model("System", systemSchema);

export default System;
