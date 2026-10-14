import mongoose from "mongoose";
import PatientProfile from "../models/patient-profile.model.js";
import ProviderProfile from "../models/provider-profile.model.js";
import ProviderPaymentAttempt from "../models/provider-payment-attempt.model.js";
import AppError from "../utils/AppError.js";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const buildTransactionFilter = (scope, { status, purpose, search }) => {
  const filter = { ...scope };
  if (status && status !== "all") filter.status = status;
  if (purpose && purpose !== "all") filter.purpose = purpose;
  if (search) {
    const expression = new RegExp(escapeRegex(search), "i");
    filter.$or = [
      { reference: expression },
      { gateway_transaction_id: expression },
    ];
  }
  return filter;
};

const transactionSort = {
  newest: { createdAt: -1, _id: -1 },
  oldest: { createdAt: 1, _id: 1 },
  highest: { amount_kobo: -1, createdAt: -1, _id: -1 },
  lowest: { amount_kobo: 1, createdAt: -1, _id: -1 },
};

const populateTransaction = (query) => query
  .populate({ path: "provider_subscription", select: "service_snapshot" })
  .populate({
    path: "provider_profile",
    select: "user professional_field professional_field_other",
    populate: { path: "user", select: "fullname" },
  })
  .populate({
    path: "patient_profile",
    select: "user",
    populate: { path: "user", select: "fullname" },
  });

const idOf = (value) => value?._id?.toString?.() ?? value?.toString?.() ?? null;

export const serializeTransactionAttempt = (attempt, audience) => {
  const subscription = attempt.provider_subscription;
  const providerProfile = attempt.provider_profile;
  const patientProfile = attempt.patient_profile;
  const result = {
    id: idOf(attempt._id),
    transaction_reference: attempt.reference,
    status: attempt.status,
    purpose: attempt.purpose,
    amount_minor: attempt.amount_kobo,
    amount: Number((attempt.amount_kobo / 100).toFixed(2)),
    currency: attempt.currency,
    created_at: attempt.createdAt,
    verified_at: attempt.verified_at ?? null,
    provider_service: {
      id: idOf(attempt.provider_service),
      title: subscription?.service_snapshot?.title ?? null,
      billing_cycle: subscription?.service_snapshot?.billing_cycle ?? null,
    },
    provider_subscription_id: idOf(subscription),
  };

  if (audience === "patient" || audience === "admin") {
    result.provider = providerProfile ? {
      id: idOf(providerProfile),
      fullname: providerProfile.user?.fullname ?? null,
    } : null;
  }
  if (audience === "provider" || audience === "admin") {
    result.patient = patientProfile ? {
      id: idOf(patientProfile),
      fullname: patientProfile.user?.fullname ?? null,
    } : null;
  }

  return result;
};

const paginateTransactions = async (scope, filters, audience) => {
  const filter = buildTransactionFilter(scope, filters);
  const [documents, total] = await Promise.all([
    populateTransaction(
      ProviderPaymentAttempt.find(filter)
        .sort(transactionSort[filters.sort])
        .skip((filters.page - 1) * filters.limit)
        .limit(filters.limit)
    ).lean(),
    ProviderPaymentAttempt.countDocuments(filter),
  ]);
  return {
    items: documents.map((document) => serializeTransactionAttempt(document, audience)),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      pages: Math.ceil(total / filters.limit),
    },
  };
};

const findTransaction = async (scope, transactionId, audience) => {
  if (!mongoose.isValidObjectId(transactionId)) throw new AppError("Invalid transaction ID", 400);
  const document = await populateTransaction(
    ProviderPaymentAttempt.findOne({ ...scope, _id: transactionId })
  ).lean();
  if (!document) throw new AppError("Transaction not found", 404);
  return serializeTransactionAttempt(document, audience);
};

const getOwnedProfile = async (Profile, userId, label) => {
  const profile = await Profile.findOne({ user: userId }).select("_id user");
  if (!profile) throw new AppError(`${label} profile not found`, 404);
  return profile;
};

export const listPatientTransactions = async (userId, filters) => {
  const profile = await getOwnedProfile(PatientProfile, userId, "Patient");
  return paginateTransactions({ patient_profile: profile._id }, filters, "patient");
};

export const getPatientTransaction = async (userId, transactionId) => {
  const profile = await getOwnedProfile(PatientProfile, userId, "Patient");
  return findTransaction({ patient_profile: profile._id }, transactionId, "patient");
};

export const listProviderTransactions = async (userId, filters) => {
  const profile = await getOwnedProfile(ProviderProfile, userId, "Provider");
  return paginateTransactions({ provider_profile: profile._id }, filters, "provider");
};

export const getProviderTransaction = async (userId, transactionId) => {
  const profile = await getOwnedProfile(ProviderProfile, userId, "Provider");
  return findTransaction({ provider_profile: profile._id }, transactionId, "provider");
};

export const listAdminTransactions = (filters) => paginateTransactions({}, filters, "admin");

export const getAdminTransaction = (transactionId) => findTransaction({}, transactionId, "admin");
