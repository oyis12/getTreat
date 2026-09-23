// import mongoose from "mongoose";

// const { Schema } = mongoose;

// const pregnancyHealthConditionSchema = new Schema(
//   {
//     condition: {
//       type: Schema.Types.ObjectId,
//       ref: "HealthCondition",
//       required: true,
//     },
//     status: {
//       type: String,
//       enum: [
//         "reported",
//         "at_risk",
//         "suspected",
//         "diagnosed",
//         "monitored",
//         "resolved",
//       ],
//       default: "reported",
//     },
//     source: {
//       type: String,
//       enum: ["patient", "provider", "assessment", "admin"],
//       default: "patient",
//     },
//     identified_at: { type: Date, default: Date.now },
//     notes: { type: String, trim: true, maxlength: 1000, default: null },
//   },
//   { _id: true, versionKey: false }
// );

// const healthAssessmentAnswerSchema = new Schema(
//   {
//     question_key: {
//       type: String,
//       required: true,
//       trim: true,
//       lowercase: true,
//       maxlength: 100,
//     },
//     value: { type: Schema.Types.Mixed, default: null },
//   },
//   { _id: false }
// );

// const healthAssessmentSchema = new Schema(
//   {
//     condition: {
//       type: Schema.Types.ObjectId,
//       ref: "HealthCondition",
//       required: true,
//     },
//     condition_slug: {
//       type: String,
//       required: true,
//       trim: true,
//       lowercase: true,
//     },
//     condition_name: {
//       type: String,
//       required: true,
//       trim: true,
//     },
//     status: {
//       type: String,
//       enum: ["not_started", "in_progress", "completed"],
//       default: "not_started",
//     },
//     result_status: {
//       type: String,
//       enum: ["pending", "at_risk", "low_risk", "normal", "needs_review"],
//       default: "pending",
//     },
//     score: { type: Number, min: 0, default: null },
//     answers: { type: [healthAssessmentAnswerSchema], default: [] },
//     started_at: { type: Date, default: null },
//     completed_at: { type: Date, default: null },
//   },
//   { _id: true, versionKey: false }
// );

// const pregnancySchema = new Schema(
//   {
//     status: {
//       type: String,
//       enum: {
//         values: ["active", "completed", "ended"],
//         message: "Invalid pregnancy status",
//       },
//       default: "active",
//       index: true,
//     },
//     is_current: { type: Boolean, default: true, index: true },
//     conception_method: {
//       type: String,
//       enum: {
//         values: ["natural_conception", "assisted_reproduction"],
//         message: "Invalid conception method",
//       },
//       default: null,
//     },
//     last_menstral_date: { type: Date, default: null },
//     expected_delivery_date: { type: Date, default: null },
//     current_trimester: { type: Number, min: 0, max: 3, default: 0 },
//     weeks_gone: { type: Number, min: 0, max: 40, default: 0 },
//     weeks_left: { type: Number, min: 0, max: 40, default: 0 },
//     has_fibroid: { type: Boolean, default: false },
//     health_conditions: { type: [pregnancyHealthConditionSchema], default: [] },
//     health_assessments: { type: [healthAssessmentSchema], default: [] },
//   },
//   {
//     _id: true,
//     timestamps: { createdAt: "createdAt", updatedAt: "modifiedAt" },
//     versionKey: false,
//   }
// );

// export { pregnancyHealthConditionSchema, healthAssessmentSchema };
// export default pregnancySchema;


import mongoose from "mongoose";

const { Schema } = mongoose;


const pregnancyHealthConditionSchema = new Schema(
  {
    condition: {
      type: Schema.Types.ObjectId,
      ref: "HealthCondition",
      required: true,
    },

    status: {
      type: String,
      enum: [
        "reported",
        "at_risk",
        "suspected",
        "diagnosed",
        "monitored",
        "resolved",
      ],
      default: "reported",
    },

    source: {
      type: String,
      enum: ["patient", "provider", "assessment", "admin"],
      default: "patient",
    },

    identified_at: {
      type: Date,
      default: Date.now,
    },

    notes: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    _id: true,
  }
);


const healthAssessmentAnswerSchema = new Schema(
  {
    question_key: {
      type: String,
      required: true,
      trim: true,
    },

    value: {
      type: Schema.Types.Mixed,
      default: null,
    },
  },
  {
    _id: false,
  }
);


const healthAssessmentSchema = new Schema(
  {
    condition: {
      type: Schema.Types.ObjectId,
      ref: "HealthCondition",
      required: true,
    },

    condition_slug: {
      type: String,
      required: true,
      trim: true,
    },

    condition_name: {
      type: String,
      required: true,
      trim: true,
    },

    status: {
      type: String,
      enum: ["not_started", "in_progress", "completed"],
      default: "not_started",
    },

    result_status: {
      type: String,
      enum: [
        "pending",
        "at_risk",
        "low_risk",
        "normal",
        "needs_review",
      ],
      default: "pending",
    },

    score: {
      type: Number,
      default: null,
    },

    answers: {
      type: [healthAssessmentAnswerSchema],
      default: [],
    },

    started_at: {
      type: Date,
      default: null,
    },

    completed_at: {
      type: Date,
      default: null,
    },
  },
  {
    _id: true,
  }
);

const babyPhotoSchema = new Schema(
  {
    url: {
      type: String,
      required: true,
      trim: true,
    },

    public_id: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    _id: true,
  }
);

const babyMeasurementSchema = new Schema(
  {
    value: {
      type: Number,
      required: true,
      min: 0,
    },

    unit: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    _id: false,
  }
);

const babySchema = new Schema(
  {
    full_name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },

    date_of_birth: {
      type: Date,
      required: true,
    },

    gender: {
      type: String,
      enum: ["male", "female"],
      required: true,
      lowercase: true,
      trim: true,
    },

    weight: {
      type: babyMeasurementSchema,
      default: null,
    },

    length: {
      type: babyMeasurementSchema,
      default: null,
    },

    head_circumference: {
      type: babyMeasurementSchema,
      default: null,
    },

  photos: {
      type: [babyPhotoSchema],
      default: [],
      validate: {
        validator: function (photos) {
          return photos.length <= 5;
        },
        message: "A baby can have a maximum of 5 photos",
      },
    },
  },
  {
    _id: true,
    timestamps: true,
  }
);

babySchema.pre("validate", function (next) {
  if (this.weight && !["kg", "lbs"].includes(this.weight.unit)) {
    this.invalidate("weight.unit", "Weight unit must be kg or lbs");
  }

  if (this.length && !["cm", "m"].includes(this.length.unit)) {
    this.invalidate("length.unit", "Length unit must be cm or m");
  }

  if (
    this.head_circumference &&
    !["cm", "m"].includes(this.head_circumference.unit)
  ) {
    this.invalidate(
      "head_circumference.unit",
      "Head circumference unit must be cm or m"
    );
  }

  //next();
});


const pregnancySchema = new Schema(
  {
    status: {
      type: String,
      enum: ["active", "completed", "ended"],
      default: "active",
    },

    is_current: {
      type: Boolean,
      default: true,
    },

    conception_method: {
      type: String,
      enum: [
        "natural_conception",
        "assisted_reproduction",
      ],
      default: "natural_conception",
    },

    last_menstral_date: {
      type: Date,
      default: null,
    },

    expected_delivery_date: {
      type: Date,
      default: null,
    },

    current_trimester: {
      type: Number,
      min: 0,
      max: 3,
      default: 0,
    },

    weeks_gone: {
      type: Number,
      min: 0,
      max: 40,
      default: 0,
    },

    weeks_left: {
      type: Number,
      min: 0,
      max: 40,
      default: 0,
    },

    has_fibroid: {
      type: Boolean,
      default: false,
    },

    health_conditions: {
      type: [pregnancyHealthConditionSchema],
      default: [],
    },

    health_assessments: {
      type: [healthAssessmentSchema],
      default: [],
    },

    babies: {
      type: [babySchema],
      default: [],
    },
  },
  {
    _id: true,
    timestamps: true,
  }
);

export default pregnancySchema;

export {
  babySchema,
  babyPhotoSchema,
  babyMeasurementSchema,
  pregnancyHealthConditionSchema,
  healthAssessmentAnswerSchema,
  healthAssessmentSchema,
};