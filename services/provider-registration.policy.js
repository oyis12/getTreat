import AppError from "../utils/AppError.js";

export const isProviderRegistrationComplete = (profile) => {
  const credentialKinds = new Set((profile?.credentials ?? []).map((item) => item.kind));
  return Boolean(
    profile?.professional_field &&
    (profile.professional_field !== "others" || profile.professional_field_other?.trim()) &&
    profile.years_experience !== null && profile.years_experience !== undefined &&
    profile.bio?.trim() && profile.country?.trim() && profile.state?.trim() && profile.address?.trim() &&
    profile.consents?.credentials_valid && profile.consents?.regulations_agreed && profile.consents?.professional_data_consent &&
    credentialKinds.has("higher_institution_certificate") && credentialKinds.has("nysc_certificate")
  );
};

export const assertProviderRegistrationComplete = (profile) => {
  if (!isProviderRegistrationComplete(profile)) {
    throw new AppError("Provider registration is incomplete; both required credentials and all consent/profile fields are required before approval", 409);
  }
};
