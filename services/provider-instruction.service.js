import ProviderInstruction from "../models/provider-instruction.model.js";
import ProviderProfile, {
  providerProfessionalFieldLabels,
} from "../models/provider-profile.model.js";
import ProviderSubscription from "../models/provider-subscription.model.js";
import PatientProfile from "../models/patient-profile.model.js";
import User from "../models/user.model.js";
import AppError from "../utils/AppError.js";
import {
  assertActiveProviderSubscription,
  assertApprovedProvider,
} from "./provider-access.policy.js";

const getUserId = (user) => user?._id?.toString?.() ?? user?.id;

const getApprovedProviderProfile = async (providerUserId) => {
  const profile = await ProviderProfile.findOne({ user: providerUserId });
  assertApprovedProvider(profile);
  return profile;
};

const getPatientProfile = async (patientUserId) => {
  const patient = await User.findById(patientUserId).select("role");
  if (!patient || patient.role !== "patient") {
    throw new AppError("Patient account not found", 404);
  }
  const profile = await PatientProfile.findOne({ user: patientUserId }).select("user");
  if (!profile) throw new AppError("Patient profile not found", 404);
  return profile;
};

export const findActiveProviderSubscription = async (
  providerProfileId,
  patientProfileId,
  now = new Date()
) => {
  const subscription = await ProviderSubscription.findOne({
    provider_profile: providerProfileId,
    patient_profile: patientProfileId,
    status: "active",
    starts_at: { $lte: now },
    $or: [
      { ends_at: { $gt: now } },
      { renewal_grace_ends_at: { $gt: now } },
    ],
  }).select("_id status starts_at ends_at renewal_grace_ends_at");
  assertActiveProviderSubscription(subscription, now);
  return subscription;
};

export const serializeInstruction = (instruction) => ({
  id: instruction._id.toString(),
  doctor: {
    id: instruction.provider_profile.toString(),
    name: instruction.provider_name,
    profession: instruction.provider_profession,
  },
  instruction: instruction.instruction,
  prescription: instruction.prescription,
  created_at: instruction.createdAt,
});

export const createProviderInstruction = async (
  providerUser,
  patientUserId,
  payload
) => {
  const providerUserId = getUserId(providerUser);
  const providerProfile = await getApprovedProviderProfile(providerUserId);
  const patientProfile = await getPatientProfile(patientUserId);

  await findActiveProviderSubscription(
    providerProfile._id,
    patientProfile._id
  );

  const instruction = await ProviderInstruction.create({
    provider_profile: providerProfile._id,
    patient_profile: patientProfile._id,
    provider_name: providerUser.fullname,
    provider_profession:
      providerProfile.professional_field === "others"
        ? providerProfile.professional_field_other ?? "Others"
        : providerProfessionalFieldLabels[providerProfile.professional_field],
    instruction: payload.instruction.trim(),
    prescription:
      typeof payload.prescription === "string" && payload.prescription.trim()
        ? payload.prescription.trim()
        : null,
  });

  return serializeInstruction(instruction);
};

export const listProviderPatientInstructions = async (
  providerUser,
  patientUserId,
  { page, limit }
) => {
  const providerProfile = await getApprovedProviderProfile(getUserId(providerUser));
  const patientProfile = await getPatientProfile(patientUserId);
  await findActiveProviderSubscription(providerProfile._id, patientProfile._id);

  const filter = { patient_profile: patientProfile._id };
  const skip = (page - 1) * limit;
  const [instructions, total] = await Promise.all([
    ProviderInstruction.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit),
    ProviderInstruction.countDocuments(filter),
  ]);

  return {
    items: instructions.map(serializeInstruction),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
};

export const listCurrentPatientInstructions = async (
  patientUserId,
  { page, limit }
) => {
  const patientProfile = await PatientProfile.findOne({ user: patientUserId }).select("_id");
  if (!patientProfile) throw new AppError("Patient profile not found", 404);

  const filter = { patient_profile: patientProfile._id };
  const skip = (page - 1) * limit;
  const [instructions, total] = await Promise.all([
    ProviderInstruction.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit),
    ProviderInstruction.countDocuments(filter),
  ]);

  return {
    items: instructions.map(serializeInstruction),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
};

export const getCurrentPatientInstruction = async (
  patientUserId,
  instructionId
) => {
  const patientProfile = await PatientProfile.findOne({ user: patientUserId }).select("_id");
  if (!patientProfile) throw new AppError("Patient profile not found", 404);

  const instruction = await ProviderInstruction.findOne({
    _id: instructionId,
    patient_profile: patientProfile._id,
  });
  if (!instruction) throw new AppError("Provider instruction not found", 404);
  return serializeInstruction(instruction);
};

export const listProviderPatients = async (
  providerUserId,
  { page, limit, status }
) => {
  const providerProfile = await getApprovedProviderProfile(providerUserId);
  const now = new Date();
  const skip = (page - 1) * limit;
  const pipeline = [
    { $match: { provider_profile: providerProfile._id } },
    {
      $addFields: {
        _has_active_period: {
          $and: [
            { $eq: ["$status", "active"] },
            { $lte: ["$starts_at", now] },
            { $or: [{ $gt: ["$ends_at", now] }, { $gt: ["$renewal_grace_ends_at", now] }] },
          ],
        },
      },
    },
    { $sort: { _has_active_period: -1, starts_at: -1, createdAt: -1 } },
    { $group: { _id: "$patient_profile", subscription: { $first: "$$ROOT" } } },
    {
      $addFields: {
        subscription_status: {
          $cond: [
            {
              $and: [
                { $eq: ["$subscription.status", "active"] },
                { $lte: ["$subscription.starts_at", now] },
                { $or: [{ $gt: ["$subscription.ends_at", now] }, { $gt: ["$subscription.renewal_grace_ends_at", now] }] },
              ],
            },
            "active",
            "expired",
          ],
        },
      },
    },
    ...(status === "all" ? [] : [{ $match: { subscription_status: status } }]),
    {
      $facet: {
        items: [
          { $sort: { subscription_status: 1, "subscription.starts_at": -1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: PatientProfile.collection.name,
              localField: "_id",
              foreignField: "_id",
              as: "patient_profile",
            },
          },
          { $unwind: "$patient_profile" },
          {
            $lookup: {
              from: User.collection.name,
              localField: "patient_profile.user",
              foreignField: "_id",
              as: "patient_user",
            },
          },
          { $unwind: "$patient_user" },
          {
            $project: {
              _id: 0,
              patient_id: "$patient_user._id",
              fullname: "$patient_user.fullname",
              profile_image: "$patient_profile.profileImage",
              subscription_status: 1,
              subscribed_at: "$subscription.starts_at",
              expires_at: { $cond: [{ $gt: ["$subscription.renewal_grace_ends_at", now] }, "$subscription.renewal_grace_ends_at", "$subscription.ends_at"] },
            },
          },
        ],
        total: [{ $count: "count" }],
      },
    },
  ];

  const [result] = await ProviderSubscription.aggregate(pipeline);
  const total = result?.total?.[0]?.count ?? 0;

  return {
    items: result?.items ?? [],
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
};
