import mongoose from "mongoose"

const { Schema } = mongoose

const serviceSchema = new Schema(
    {},
    {
    timestamps: {
      createdAt: "createdAt",
      updatedAt: "modifiedAt",
    },

    versionKey: false,
  }
);

const Service = mongoose.model("Service", serviceSchema);

export default Service;