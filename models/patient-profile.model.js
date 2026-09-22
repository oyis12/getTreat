import mongoose from "mongoose";
import pregnancySchema from "./pregnancy.model.js";

const { Schema } = mongoose;

const addressSchema = new Schema(
  {
    country: {
      type: String,
      trim: true,
      maxlength: 100,
      default: null,
    },

    city: {
      type: String,
      trim: true,
      maxlength: 100,
      default: null,
    },

    state: {
      type: String,
      trim: true,
      maxlength: 100,
      default: null,
    },

    zip: {
      type: String,
      trim: true,
      maxlength: 30,
      default: null,
    },

    house_no: {
      type: String,
      trim: true,
      maxlength: 200,
      default: null,
    },
  },
  {
    _id: false,
  }
);

const patientProfileSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Patient profile user is required"],
      unique: true,
    },
    
    preferred_service_categories: {
      type: [String],
      enum: ["pregnancy_care", "newborn_care"],
      default: [],
    },

    service_type: {
      type: [Schema.Types.ObjectId],
      ref: "Service",
      default: [],
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

    address: {
      type: addressSchema,
      default: () => ({}),
    },

    profileImage: {
      type: String,
      trim: true,
      default: null,
    },

    pregnancies: {
      type: [pregnancySchema],
      default: [],
    },

    profileImagePublicId: {
      type: String,
      trim: true,
      default: null,
    },

    profileCompleted: {
      type: Boolean,
      default: false,
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

const PatientProfile = mongoose.model(
  "PatientProfile",
  patientProfileSchema
);

export default PatientProfile;
