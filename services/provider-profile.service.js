import mongoose from "mongoose";
import ProviderProfile, {
  providerProfessionalFieldLabels,
} from "../models/provider-profile.model.js";
import User from "../models/user.model.js";
import AppError from "../utils/AppError.js";
import cloudinary from "../config/cloudinary.js";
import { assertProviderRegistrationComplete } from "./provider-registration.policy.js";

const ensureProviderUser = async (userId) => {
  const user = await User.findById(userId).select(
    "role fullname email emailVerified accountStatus"
  );
  if (!user) throw new AppError("User account not found", 404);
  if (user.role !== "provider") {
    throw new AppError("This endpoint is only available to providers", 403);
  }
  if (!user.emailVerified || user.accountStatus !== "active") {
    throw new AppError("Verify and activate your account before submitting a provider profile", 403);
  }
  return user;
};

const serializeHistory = (entry) => ({
  approval_status: entry.approval_status,
  action_by: entry.action_by?.toString?.() ?? entry.action_by,
  changed_at: entry.changed_at,
});

const uploadProviderFile = (file, { privateCredential = false } = {}) => new Promise((resolve, reject) => {
  const options = {
    folder: privateCredential ? "gettreat/provider-credentials" : "gettreat/provider-profiles",
    resource_type: privateCredential ? "auto" : "image",
    allowed_formats: privateCredential ? ["jpg", "jpeg", "png", "pdf"] : ["jpg", "jpeg", "png"],
    ...(privateCredential ? { type: "authenticated" } : {
      transformation: [{ width: 800, height: 800, crop: "limit", quality: "auto", fetch_format: "auto" }],
    }),
  };
  const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
    if (error) return reject(error);
    resolve(result);
  });
  stream.end(file.buffer);
});

const deleteUploadedAsset = async (asset, { privateCredential = false } = {}) => {
  if (!asset?.public_id) return;
  await cloudinary.uploader.destroy(asset.public_id, {
    resource_type: asset.resource_type ?? (privateCredential ? "raw" : "image"),
    ...(privateCredential ? { type: "authenticated" } : {}),
    invalidate: true,
  });
};

export const serializeProviderProfile = (profile, user = null) => ({
  id: profile._id.toString(),
  user: user
    ? {
        id: user._id.toString(),
        fullname: user.fullname,
        ...(user.email ? { email: user.email } : {}),
      }
    : profile.user?.toString?.() ?? profile.user,
  professional_field: profile.professional_field,
  professional_field_other: profile.professional_field_other ?? null,
  years_experience: profile.years_experience ?? null,
  bio: profile.bio ?? null,
  country: profile.country ?? null,
  state: profile.state ?? null,
  address: profile.address ?? null,
  profile_image: profile.profile_image ?? null,
  consents: {
    credentials_valid: Boolean(profile.consents?.credentials_valid),
    regulations_agreed: Boolean(profile.consents?.regulations_agreed),
    professional_data_consent: Boolean(profile.consents?.professional_data_consent),
    accepted_at: profile.consents?.accepted_at ?? null,
  },
  credentials: (profile.credentials ?? []).map((credential) => ({
    kind: credential.kind,
    download_url: cloudinary.utils.private_download_url(credential.public_id, credential.format, {
      resource_type: credential.resource_type,
      type: "authenticated",
      expires_at: Math.floor(Date.now() / 1000) + 600,
    }),
    uploaded_at: credential.uploaded_at,
  })),
  profession: profile.professional_field === "others"
    ? profile.professional_field_other ?? "Others"
    : providerProfessionalFieldLabels[profile.professional_field],
  approval_status: profile.approval_status,
  submitted_at: profile.submitted_at,
  approval_history: (profile.approval_history ?? []).map(serializeHistory),
  created_at: profile.createdAt,
  modified_at: profile.modifiedAt,
});

export const getProviderProfile = async (userId) => {
  await ensureProviderUser(userId);
  const profile = await ProviderProfile.findOne({ user: userId });
  if (!profile) throw new AppError("Provider profile not found", 404);
  return serializeProviderProfile(profile);
};

export const submitProviderProfile = async (userId, payload, files = {}) => {
  await ensureProviderUser(userId);
  const now = new Date();
  let profile = await ProviderProfile.findOne({ user: userId });

  const documents = [
    ["higher_institution_certificate", "higher_institution_certificate"],
    ["nysc_certificate", "nysc_certificate"],
  ];
  const justUploaded = [];
  const uploadedCredentials = [];
  let profilePhoto = null;
  try {
    for (const [field, kind] of documents) {
      const file = files[field]?.[0];
      if (!file) continue;
      const uploaded = await uploadProviderFile(file, { privateCredential: true });
      justUploaded.push({ ...uploaded, privateCredential: true });
      uploadedCredentials.push({ kind, public_id: uploaded.public_id, resource_type: uploaded.resource_type, format: uploaded.format, uploaded_at: now });
    }
    if (files.profile_image?.[0]) {
      const uploaded = await uploadProviderFile(files.profile_image[0]);
      profilePhoto = { ...uploaded, privateCredential: false };
      justUploaded.push(profilePhoto);
    }
  } catch (error) {
    await Promise.allSettled(justUploaded.map((asset) => deleteUploadedAsset(asset, { privateCredential: asset.privateCredential })));
    throw error;
  }
  const profileFields = {
    professional_field: payload.professional_field,
    professional_field_other: payload.professional_field === "others" ? payload.professional_field_other.trim() : null,
    years_experience: Number(payload.years_experience),
    bio: payload.bio.trim(),
    country: payload.country.trim(),
    state: payload.state.trim(),
    address: payload.address.trim(),
    ...(profilePhoto ? { profile_image: profilePhoto.secure_url, profile_image_public_id: profilePhoto.public_id } : {}),
    consents: {
      credentials_valid: true,
      regulations_agreed: true,
      professional_data_consent: true,
      accepted_at: now,
    },
  };

  if (!profile) {
    const kinds = new Set(uploadedCredentials.map((item) => item.kind));
    if (!kinds.has("higher_institution_certificate") || !kinds.has("nysc_certificate")) {
      await Promise.allSettled(justUploaded.map((asset) => deleteUploadedAsset(asset, { privateCredential: asset.privateCredential })));
      throw new AppError("Both the higher institution certificate and NYSC certificate/exemption are required", 400);
    }
    try {
      profile = await ProviderProfile.create({ user: userId, ...profileFields, credentials: uploadedCredentials, approval_status: "pending", submitted_at: now, approval_history: [{ approval_status: "pending", action_by: userId, changed_at: now }] });
      return serializeProviderProfile(profile);
    } catch (error) {
      await Promise.allSettled(justUploaded.map((asset) => deleteUploadedAsset(asset, { privateCredential: asset.privateCredential })));
      throw error;
    }
  }

  const previousCredentials = profile.credentials ?? [];
  const previousPhotoPublicId = profile.profile_image_public_id;
  const credentialsByKind = new Map(previousCredentials.map((item) => [item.kind, item.toObject?.() ?? item]));
  for (const item of uploadedCredentials) credentialsByKind.set(item.kind, item);
  if (!credentialsByKind.has("higher_institution_certificate") || !credentialsByKind.has("nysc_certificate")) {
    await Promise.allSettled(justUploaded.map((asset) => deleteUploadedAsset(asset, { privateCredential: asset.privateCredential })));
    throw new AppError("Both the higher institution certificate and NYSC certificate/exemption are required", 400);
  }
  const changed = profile.professional_field !== profileFields.professional_field ||
    profile.professional_field_other !== profileFields.professional_field_other ||
    profile.years_experience !== profileFields.years_experience ||
    profile.bio !== profileFields.bio || profile.country !== profileFields.country ||
    profile.state !== profileFields.state || profile.address !== profileFields.address ||
    uploadedCredentials.length > 0 || Boolean(profilePhoto);
  Object.assign(profile, profileFields);
  profile.credentials = [...credentialsByKind.values()];
  if (changed && profile.approval_status !== "pending") {
    profile.submitted_at = now;
    profile.approval_status = "pending";
    profile.approval_history.push({ approval_status: "pending", action_by: userId, changed_at: now });
  }
  if (changed) profile.submitted_at = now;
  try {
    await profile.save();
  } catch (error) {
    await Promise.allSettled(justUploaded.map((asset) => deleteUploadedAsset(asset, { privateCredential: asset.privateCredential })));
    throw error;
  }

  const replacedCredentials = uploadedCredentials.map((item) => previousCredentials.find((old) => old.kind === item.kind)).filter(Boolean);
  await Promise.allSettled(replacedCredentials.map((old) => cloudinary.uploader.destroy(old.public_id, { resource_type: old.resource_type, type: "authenticated", invalidate: true })));
  if (profilePhoto && previousPhotoPublicId) await Promise.allSettled([cloudinary.uploader.destroy(previousPhotoPublicId, { resource_type: "image", invalidate: true })]);

  return serializeProviderProfile(profile);
};

export const listProviderProfiles = async ({ status, page, limit }) => {
  const filter = status ? { approval_status: status } : {};
  const skip = (page - 1) * limit;
  const [profiles, total] = await Promise.all([
    ProviderProfile.find(filter)
      .sort({ submitted_at: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .populate({ path: "user", select: "fullname email role" }),
    ProviderProfile.countDocuments(filter),
  ]);

  return {
    items: profiles.map((profile) => serializeProviderProfile(profile, profile.user)),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

export const reviewProviderProfile = async (
  profileId,
  approvalStatus,
  adminUserId
) => {
  if (!mongoose.isValidObjectId(profileId)) {
    throw new AppError("Invalid provider profile ID", 400);
  }
  const profile = await ProviderProfile.findById(profileId);
  if (!profile) throw new AppError("Provider profile not found", 404);

  const provider = await User.findById(profile.user).select(
    "role fullname email emailVerified accountStatus"
  );
  if (!provider || provider.role !== "provider") {
    throw new AppError("Provider account not found", 404);
  }
  if (!provider.emailVerified || provider.accountStatus !== "active") {
    throw new AppError("Provider account must be verified and active before approval", 409);
  }

  if (approvalStatus === "approved") {
    assertProviderRegistrationComplete(profile);
  }

  if (profile.approval_status !== approvalStatus) {
    profile.approval_status = approvalStatus;
    profile.approval_history.push({
      approval_status: approvalStatus,
      action_by: adminUserId,
      changed_at: new Date(),
    });
    await profile.save();
  }

  return serializeProviderProfile(profile, provider);
};
