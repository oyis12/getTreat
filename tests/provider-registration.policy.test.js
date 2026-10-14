import test from "node:test";
import assert from "node:assert/strict";
import ProviderProfile from "../models/provider-profile.model.js";
import { assertProviderRegistrationComplete, isProviderRegistrationComplete } from "../services/provider-registration.policy.js";

const completeProfile = () => ({
  professional_field: "gynecology",
  years_experience: 4,
  bio: "Provider bio",
  country: "Nigeria",
  state: "Lagos",
  address: "Example address",
  consents: { credentials_valid: true, regulations_agreed: true, professional_data_consent: true },
  credentials: [
    { kind: "higher_institution_certificate" },
    { kind: "nysc_certificate" },
  ],
});

test("provider registration cannot be approved before consent, profile, and credentials are complete", () => {
  const incomplete = completeProfile();
  incomplete.credentials.pop();
  assert.equal(isProviderRegistrationComplete(incomplete), false);
  assert.throws(() => assertProviderRegistrationComplete(incomplete), { statusCode: 409 });

  const noConsent = completeProfile();
  noConsent.consents.regulations_agreed = false;
  assert.equal(isProviderRegistrationComplete(noConsent), false);
});

test("complete provider registration satisfies the approval prerequisites", () => {
  const profile = completeProfile();
  assert.equal(isProviderRegistrationComplete(profile), true);
  assert.doesNotThrow(() => assertProviderRegistrationComplete(profile));

  const other = { ...profile, professional_field: "others", professional_field_other: "Doula" };
  assert.equal(isProviderRegistrationComplete(other), true);
  assert.equal(isProviderRegistrationComplete({ ...other, professional_field_other: " " }), false);
});

test("provider profile schema stores registration and authenticated credential metadata", async () => {
  const profile = new ProviderProfile({
    user: "507f1f77bcf86cd799439011",
    professional_field: "others",
    professional_field_other: "Doula",
    years_experience: 5,
    bio: "Provider bio",
    country: "Nigeria",
    state: "Lagos",
    address: "Address",
    consents: { credentials_valid: true, regulations_agreed: true, professional_data_consent: true, accepted_at: new Date() },
    credentials: [{ kind: "higher_institution_certificate", public_id: "private/provider-certificate", resource_type: "raw", format: "pdf" }],
  });
  await assert.doesNotReject(profile.validate());
  assert.equal(profile.credentials[0].public_id, "private/provider-certificate");
});
