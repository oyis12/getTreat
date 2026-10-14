import mongoose from "mongoose";
import ProviderProfile from "../models/provider-profile.model.js";
import ProviderService from "../models/provider-service.model.js";
import User from "../models/user.model.js";
import AppError from "../utils/AppError.js";
import { assertApprovedProvider } from "./provider-access.policy.js";

const escapedRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getApprovedProviderProfile = async (userId) => {
  const profile = await ProviderProfile.findOne({ user: userId });
  assertApprovedProvider(profile);
  const user = await User.findById(userId).select("emailVerified accountStatus role fullname");
  if (!user || user.role !== "provider" || !user.emailVerified || user.accountStatus !== "active") {
    throw new AppError("Provider account must be verified and active", 403);
  }
  return { profile, user };
};

const serializeService = (service, provider = null) => {
  const discountedPrice = Number((service.original_price * (1 - service.discount_percent / 100)).toFixed(2));
  return {
    id: service._id.toString(),
    title: service.title,
    original_price: service.original_price,
    discount_percent: service.discount_percent,
    discounted_price: discountedPrice,
    currency: service.currency,
    billing_cycle: service.billing_cycle,
    active: service.active,
    ...(provider ? {
      provider: {
        id: provider._id.toString(),
        fullname: provider.user?.fullname ?? null,
        professional_field: provider.professional_field,
        profession: provider.professional_field === "others"
          ? provider.professional_field_other ?? "Others"
          : provider.professional_field,
        profile_image: provider.profile_image ?? null,
      },
    } : {}),
    created_at: service.createdAt,
    modified_at: service.modifiedAt,
  };
};

export const listMyProviderServices = async (userId) => {
  const { profile } = await getApprovedProviderProfile(userId);
  const services = await ProviderService.find({ provider_profile: profile._id }).sort({ active: -1, createdAt: -1 });
  return services.map((service) => serializeService(service));
};

export const createProviderService = async (userId, payload) => {
  const { profile } = await getApprovedProviderProfile(userId);
  const service = await ProviderService.create({ provider_profile: profile._id, ...payload, currency: "NGN" });
  return serializeService(service);
};

export const updateProviderService = async (userId, serviceId, payload) => {
  const { profile } = await getApprovedProviderProfile(userId);
  if (!mongoose.isValidObjectId(serviceId)) throw new AppError("Invalid provider service ID", 400);
  const service = await ProviderService.findOne({ _id: serviceId, provider_profile: profile._id });
  if (!service) throw new AppError("Provider service not found", 404);
  Object.assign(service, payload);
  await service.save();
  return serializeService(service);
};

export const archiveProviderService = async (userId, serviceId) => {
  const { profile } = await getApprovedProviderProfile(userId);
  if (!mongoose.isValidObjectId(serviceId)) throw new AppError("Invalid provider service ID", 400);
  const service = await ProviderService.findOneAndUpdate(
    { _id: serviceId, provider_profile: profile._id, active: true },
    { $set: { active: false } },
    { new: true }
  );
  if (!service) throw new AppError("Active provider service not found", 404);
  return serializeService(service);
};

export const listPatientProviderServices = async ({ page, limit, search, professionalField, discountOnly, providerProfileId }) => {
  if (providerProfileId && !mongoose.isValidObjectId(providerProfileId)) throw new AppError("Invalid provider profile ID", 400);
  const skip = (page - 1) * limit;
  const pipeline = [
    { $match: { active: true, ...(providerProfileId ? { provider_profile: new mongoose.Types.ObjectId(providerProfileId) } : {}), ...(professionalField ? {} : {}) } },
    { $lookup: { from: ProviderProfile.collection.name, localField: "provider_profile", foreignField: "_id", as: "provider_profile" } },
    { $unwind: "$provider_profile" },
    { $match: { "provider_profile.approval_status": "approved", ...(professionalField ? { "provider_profile.professional_field": professionalField } : {}), ...(discountOnly ? { discount_percent: { $gt: 0 } } : {}) } },
    { $lookup: { from: User.collection.name, localField: "provider_profile.user", foreignField: "_id", as: "provider_user" } },
    { $unwind: "$provider_user" },
    { $match: { "provider_user.role": "provider", "provider_user.emailVerified": true, "provider_user.accountStatus": "active" } },
  ];
  if (search) {
    const regex = new RegExp(escapedRegex(search), "i");
    pipeline.push({ $match: { $or: [{ title: regex }, { "provider_user.fullname": regex }] } });
  }
  pipeline.push({
    $facet: {
      items: [
        { $sort: { discount_percent: -1, createdAt: -1, _id: 1 } }, { $skip: skip }, { $limit: limit },
        { $project: { _id: 1, title: 1, original_price: 1, discount_percent: 1, currency: 1, billing_cycle: 1, active: 1, createdAt: 1, modifiedAt: 1, provider: { _id: "$provider_profile._id", professional_field: "$provider_profile.professional_field", professional_field_other: "$provider_profile.professional_field_other", profile_image: "$provider_profile.profile_image", user: { _id: "$provider_user._id", fullname: "$provider_user.fullname" } } } },
      ],
      total: [{ $count: "count" }],
    },
  });
  const [result] = await ProviderService.aggregate(pipeline);
  const items = (result?.items ?? []).map((item) => serializeService({ ...item, _id: item._id, createdAt: item.createdAt, modifiedAt: item.modifiedAt }, item.provider));
  const total = result?.total?.[0]?.count ?? 0;
  return { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
};
