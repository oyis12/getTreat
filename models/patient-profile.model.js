import mongoose from "mongoose";

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
    
   service_type: {type:[String],ref:"Services"},

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

    pregnancy:{},

    medical_conditions:[],

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
