import mongoose from "mongoose";
import PatientProfile from "../models/patient-profile.model.js";
import ProviderProfile from "../models/provider-profile.model.js";
import ProviderPaymentAttempt from "../models/provider-payment-attempt.model.js";
import AppointmentPaymentAttempt from "../models/appointment-payment-attempt.model.js";
import AuditLog from "../models/audit-log.model.js";
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

  if (attempt.purpose === "appointment") {
    result.provider_service = null;
    result.provider_subscription_id = null;
    result.appointment = attempt.appointment ? {
      id: idOf(attempt.appointment._id),
      type: attempt.appointment.appointment_type_snapshot?.name ?? null,
      starts_at: attempt.appointment.starts_at ?? null,
      status: attempt.appointment.status ?? null,
    } : null;
  }

  if (audience === "provider" || audience === "admin") {
    result.commission_rate_percent = attempt.commission_rate_percent ?? 0;
    result.platform_fee_minor = attempt.platform_fee_kobo ?? 0;
    result.platform_fee = Number(((attempt.platform_fee_kobo ?? 0) / 100).toFixed(2));
    result.provider_net_minor = attempt.provider_net_kobo ?? attempt.amount_kobo;
    result.provider_net = Number(((attempt.provider_net_kobo ?? attempt.amount_kobo) / 100).toFixed(2));
  }

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
  const includeProviderPayments = filters.purpose !== "appointment";
  const includeAppointments = filters.purpose === "all" || filters.purpose === "appointment";
  const filter = buildTransactionFilter(scope, filters);
  const appointmentFilter = {
    ...(scope.patient_profile ? { patient_profile: scope.patient_profile } : {}),
    ...(scope.provider_profile ? { provider_profile: scope.provider_profile } : {}),
    ...(filters.status !== "all" ? { status: filters.status } : {}),
    ...(filters.search ? { $or: [
      { reference: new RegExp(escapeRegex(filters.search), "i") },
      { gateway_transaction_id: new RegExp(escapeRegex(filters.search), "i") },
    ] } : {}),
  };
  const [providerDocuments, providerTotal, appointmentDocuments, appointmentTotal] = await Promise.all([
    includeProviderPayments ? populateTransaction(ProviderPaymentAttempt.find(filter).sort(transactionSort[filters.sort]).limit(filters.page * filters.limit)).lean() : [],
    includeProviderPayments ? ProviderPaymentAttempt.countDocuments(filter) : 0,
    includeAppointments ? AppointmentPaymentAttempt.find(appointmentFilter)
      .sort(transactionSort[filters.sort])
      .limit(filters.page * filters.limit)
      .populate({ path: "appointment", select: "appointment_type_snapshot starts_at ends_at status" })
      .populate({ path: "provider_profile", select: "user", populate: { path: "user", select: "fullname" } })
      .populate({ path: "patient_profile", select: "user", populate: { path: "user", select: "fullname" } })
      .lean() : [],
    includeAppointments ? AppointmentPaymentAttempt.countDocuments(appointmentFilter) : 0,
  ]);
  const allDocuments = [
    ...providerDocuments,
    ...appointmentDocuments.map((document) => ({ ...document, purpose: "appointment" })),
  ].sort((a, b) => {
    if (filters.sort === "highest" || filters.sort === "lowest") return (a.amount_kobo - b.amount_kobo) * (filters.sort === "highest" ? -1 : 1);
    const direction = filters.sort === "oldest" ? 1 : -1;
    return (new Date(a.createdAt) - new Date(b.createdAt)) * direction;
  });
  const total = providerTotal + appointmentTotal;
  const documents = allDocuments.slice((filters.page - 1) * filters.limit, filters.page * filters.limit);
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
  let document = await populateTransaction(ProviderPaymentAttempt.findOne({ ...scope, _id: transactionId })).lean();
  let resourceType = "provider_payment_attempt";
  if (!document) {
    document = await AppointmentPaymentAttempt.findOne({
      _id: transactionId,
      ...(scope.patient_profile ? { patient_profile: scope.patient_profile } : {}),
      ...(scope.provider_profile ? { provider_profile: scope.provider_profile } : {}),
    })
      .populate({ path: "appointment", select: "appointment_type_snapshot starts_at ends_at status" })
      .populate({ path: "provider_profile", select: "user", populate: { path: "user", select: "fullname" } })
      .populate({ path: "patient_profile", select: "user", populate: { path: "user", select: "fullname" } })
      .lean();
    resourceType = "appointment_payment_attempt";
    if (document) document.purpose = "appointment";
  }
  if (!document) throw new AppError("Transaction not found", 404);
  const transaction = serializeTransactionAttempt(document, audience);
  const auditFilter = resourceType === "appointment_payment_attempt"
    ? { $or: [
      { resource_type: "appointment_payment_attempt", resource_id: document._id },
      ...(document.appointment?._id ? [{ resource_type: "appointment", resource_id: document.appointment._id }] : []),
    ] }
    : { resource_type: resourceType, resource_id: document._id };
  const auditEvents = await AuditLog.find(auditFilter)
    .sort({ createdAt: 1 })
    .select("action prior_state new_state createdAt actor_role")
    .lean();
  transaction.audit_timeline = auditEvents.map((event) => ({
    action: event.action,
    status_before: event.prior_state,
    status_after: event.new_state,
    actor_role: event.actor_role,
    created_at: event.createdAt,
  }));
  return transaction;
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
