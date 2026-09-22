import mongoose from "mongoose";

const { Schema } = mongoose;

const servicePlanSchema = new Schema(
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

    billing_cycle: {
      type: String,
      enum: ["one_off", "weekly", "monthly", "quarterly", "yearly"],
      required: true,
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

    discount_percent: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },

    active: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

const serviceSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Service name is required"],
      trim: true,
      maxlength: 150,
    },

    slug: {
      type: String,
      required: [true, "Service slug is required"],
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 180,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: null,
    },

    category: {
      type: String,
      enum: ["pregnancy_care", "newborn_care"],
      required: true,
      index: true,
    },

    access_type: {
      type: String,
      enum: ["included", "optional"],
      required: true,
      index: true,
    },

    active: {
      type: Boolean,
      default: true,
      index: true,
    },

    sort_order: {
      type: Number,
      default: 0,
      min: 0,
    },

    plans: {
      type: [servicePlanSchema],
      default: [],
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

serviceSchema.index({ category: 1, active: 1, sort_order: 1 });

const Service = mongoose.model("Service", serviceSchema);

export default Service;
