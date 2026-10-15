import test from "node:test";
import assert from "node:assert/strict";

import { findBabyInPregnancyHistory, createBaby, getBabies, updateBaby } from "../services/baby.service.js";
import { confirmPregnancyBirth } from "../services/pregnancy.service.js";
import { addGrowthRecord, getBabyProgress } from "../services/baby-progress.service.js";
import User from "../models/user.model.js";
import PatientProfile from "../models/patient-profile.model.js";
import {
  validateBirthConfirmation,
} from "../validators/pregnancy.validator.js";
import { validateCreateBaby } from "../validators/baby.validator.js";

const invokeMiddleware = (middleware, body) => {
  let error;
  middleware({ body }, {}, (nextError) => { error = nextError; });
  return error;
};

test("birth confirmation requires an explicit delivered choice and approved mode", () => {
  assert.equal(invokeMiddleware(validateBirthConfirmation, { delivered: false }), undefined);
  assert.equal(
    invokeMiddleware(validateBirthConfirmation, {
      delivered: true,
      delivery_mode: "vaginal_birth",
    }),
    undefined
  );
  assert.equal(
    invokeMiddleware(validateBirthConfirmation, {
      delivered: true,
      delivery_mode: "cesarean_section",
    }),
    undefined
  );
});

test("birth confirmation rejects absent/unknown delivery details", () => {
  assert.equal(invokeMiddleware(validateBirthConfirmation, {})?.statusCode, 400);
  assert.equal(
    invokeMiddleware(validateBirthConfirmation, { delivered: true })?.statusCode,
    400
  );
  assert.equal(
    invokeMiddleware(validateBirthConfirmation, {
      delivered: false,
      delivery_mode: "vaginal_birth",
    })?.statusCode,
    400
  );
  assert.equal(
    invokeMiddleware(validateBirthConfirmation, { delivered: true, status: "completed" })?.statusCode,
    400
  );
});

test("baby creation requires the design's guardian consent checkbox", () => {
  const validBaby = {
    full_name: "Baby Doe",
    date_of_birth: "2026-10-14",
    gender: "female",
  };
  assert.equal(invokeMiddleware(validateCreateBaby, validBaby)?.statusCode, 400);
  assert.equal(
    invokeMiddleware(validateCreateBaby, { ...validBaby, guardian_consent: false })?.statusCode,
    400
  );
  assert.equal(
    invokeMiddleware(validateCreateBaby, { ...validBaby, guardian_consent: true }),
    undefined
  );
});

test("baby creation only accepts a Mongo pregnancy id and known request fields", () => {
  const validBaby = {
    full_name: "Baby Doe",
    date_of_birth: "2026-10-14",
    gender: "female",
    guardian_consent: true,
  };
  assert.equal(
    invokeMiddleware(validateCreateBaby, { ...validBaby, pregnancy_id: "not-an-id" })?.statusCode,
    400
  );
  assert.equal(
    invokeMiddleware(validateCreateBaby, { ...validBaby, patient_profile_id: "foreign-profile" })?.statusCode,
    400
  );
});

test("baby lookup searches the patient's full embedded pregnancy history", () => {
  const historicalBaby = { _id: "baby-historical" };
  const currentBaby = { _id: "baby-current" };
  const profile = {
    pregnancies: [
      { status: "completed", babies: { id: (id) => id === "baby-historical" ? historicalBaby : null } },
      { status: "active", babies: { id: (id) => id === "baby-current" ? currentBaby : null } },
    ],
  };

  assert.equal(findBabyInPregnancyHistory(profile, "baby-historical").baby, historicalBaby);
  assert.equal(findBabyInPregnancyHistory(profile, "baby-current").baby, currentBaby);
  assert.equal(findBabyInPregnancyHistory(profile, "not-owned"), null);
});

const withPatientProfile = async (profile, handler) => {
  const originalFindUser = User.findById;
  const originalFindProfile = PatientProfile.findOne;
  User.findById = (id) => {
    const user = { _id: id, role: "patient", accountStatus: "active" };
    return {
      select: async () => user,
      then: (resolve, reject) => Promise.resolve(user).then(resolve, reject),
    };
  };
  PatientProfile.findOne = () => ({
    populate: async () => profile,
    then: (resolve, reject) => Promise.resolve(profile).then(resolve, reject),
  });
  profile.save = async () => profile;

  try {
    return await handler(profile);
  } finally {
    User.findById = originalFindUser;
    PatientProfile.findOne = originalFindProfile;
  }
};

test("birth confirmation completes the current pregnancy and same-mode retries are idempotent", async () => {
  const profile = new PatientProfile({
    user: "6ad055cabe3df71cab97d1d0",
    pregnancies: [{ status: "active", is_current: true }],
  });

  await withPatientProfile(profile, async () => {
    const first = await confirmPregnancyBirth(profile.user.toString(), {
      delivered: true,
      delivery_mode: "cesarean_section",
    });
    assert.equal(first.delivered, true);
    assert.equal(first.pregnancy.status, "completed");
    assert.equal(first.pregnancy.is_current, false);
    assert.ok(first.pregnancy.birth_confirmed_at);

    const retry = await confirmPregnancyBirth(profile.user.toString(), {
      delivered: true,
      delivery_mode: "cesarean_section",
      pregnancy_id: first.pregnancy.id,
    });
    assert.equal(retry.pregnancy.id, first.pregnancy.id);
  });
});

test("baby creation records consent and historical babies remain manageable", async () => {
  const profile = new PatientProfile({
    user: "6ad055cabe3df71cab97d1d0",
    pregnancies: [{
      status: "completed",
      is_current: false,
      birth_confirmed_at: new Date("2026-10-14T00:00:00Z"),
    }],
  });
  const pregnancyId = profile.pregnancies[0]._id.toString();

  await withPatientProfile(profile, async () => {
    const created = await createBaby(profile.user.toString(), {
      pregnancy_id: pregnancyId,
      guardian_consent: true,
      full_name: "Baby Henderson",
      date_of_birth: "2026-10-14",
      gender: "female",
    });
    assert.equal(created.pregnancy_id, pregnancyId);
    assert.equal(created.data_consent.version, "infant-health-data-v1");
    assert.equal(created.data_consent.scope, "child_health_data");

    const list = await getBabies(profile.user.toString());
    assert.equal(list.length, 1);
    assert.equal(list[0].pregnancy_status, "completed");

    const updated = await updateBaby(profile.user.toString(), created.id, {
      full_name: "Baby H.",
    });
    assert.equal(updated.full_name, "Baby H.");
    assert.equal(updated.pregnancy_status, "completed");

    await addGrowthRecord(profile.user.toString(), created.id, {
      weight: { value: 3.4, unit: "kg" },
    });
    const progress = await getBabyProgress(profile.user.toString(), created.id);
    assert.equal(progress.latest_growth.weight.value, 3.4);
  });
});

test("baby creation rejects ended or non-owned pregnancy records", async () => {
  const profile = new PatientProfile({
    user: "6ad055cabe3df71cab97d1d0",
    pregnancies: [{ status: "ended", is_current: false }],
  });
  const pregnancyId = profile.pregnancies[0]._id.toString();
  const babyPayload = {
    pregnancy_id: pregnancyId,
    guardian_consent: true,
    full_name: "Baby Doe",
    date_of_birth: "2026-10-14",
    gender: "female",
  };

  await withPatientProfile(profile, async () => {
    await assert.rejects(
      createBaby(profile.user.toString(), babyPayload),
      { statusCode: 409 }
    );
    await assert.rejects(
      createBaby(profile.user.toString(), { ...babyPayload, pregnancy_id: "6ad055cabe3df71cab97d1d1" }),
      { statusCode: 404 }
    );
  });
});
