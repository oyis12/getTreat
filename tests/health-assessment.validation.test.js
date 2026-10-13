import test from "node:test";
import assert from "node:assert/strict";

import {
  clearUnscoredAssessmentResult,
  validateAnswers,
} from "../services/health-assessment.service.js";
import validateHealthAssessmentPayload from "../validators/health-assessment.validator.js";

const condition = {
  assessment: {
    questions: [
      { key: "has_history", prompt: "Previous history?", type: "boolean", required: true, active: true },
      {
        key: "activity_frequency",
        prompt: "How often?",
        type: "single_select",
        required: true,
        active: true,
        options: [{ value: "often" }, { value: "sometimes" }],
      },
      { key: "optional_note", prompt: "Optional note", type: "text", required: false, active: true },
      { key: "inactive_question", prompt: "Inactive", type: "text", required: true, active: false },
    ],
  },
};

const validAnswers = [
  { question_key: "has_history", value: false },
  { question_key: "activity_frequency", value: "often" },
];

const invokeMiddleware = (middleware, body) => {
  let error;
  middleware({ body }, {}, (nextError) => {
    error = nextError;
  });
  return error;
};

test("completed assessments require all active required questions", () => {
  assert.deepEqual(validateAnswers(condition, validAnswers), { isComplete: true });
  assert.deepEqual(
    validateAnswers(condition, [{ question_key: "has_history", value: true }]),
    { isComplete: false }
  );
});

test("optional and inactive questions do not block completion", () => {
  assert.deepEqual(validateAnswers(condition, validAnswers), { isComplete: true });
});

test("assessment answers reject unknown question keys", () => {
  assert.throws(
    () => validateAnswers(condition, [{ question_key: "unknown", value: true }]),
    { message: "Unknown assessment question: unknown", statusCode: 400 }
  );
});

test("assessment answers reject duplicate question keys", () => {
  assert.throws(
    () => validateAnswers(condition, [
      { question_key: "has_history", value: true },
      { question_key: "has_history", value: false },
    ]),
    { message: "Duplicate answer for question: has_history", statusCode: 400 }
  );
});

test("assessment answers enforce configured answer types and options", () => {
  assert.throws(
    () => validateAnswers(condition, [{ question_key: "has_history", value: "yes" }]),
    { message: "Answer for has_history must be boolean", statusCode: 400 }
  );
  assert.throws(
    () => validateAnswers(condition, [{ question_key: "activity_frequency", value: "rarely" }]),
    { message: "Invalid option for: How often?", statusCode: 400 }
  );
});

test("assessment service rejects unrecognized nested answer fields", () => {
  assert.throws(
    () => validateAnswers(condition, [{ question_key: "has_history", value: true, score: 10 }]),
    { message: "Unknown answer field(s): score", statusCode: 400 }
  );
});

test("unscored assessment results remain pending with no score", () => {
  const assessment = { result_status: "at_risk", score: 82 };

  clearUnscoredAssessmentResult(assessment);

  assert.deepEqual(assessment, { result_status: "pending", score: null });
});

test("HTTP validator accepts the documented answers body", () => {
  assert.equal(invokeMiddleware(validateHealthAssessmentPayload, { answers: validAnswers }), undefined);
});

test("HTTP validator rejects unknown nested answer fields", () => {
  assert.equal(
    invokeMiddleware(validateHealthAssessmentPayload, {
      answers: [{ question_key: "has_history", value: true, result_status: "normal" }],
    })?.statusCode,
    400
  );
});

test("HTTP validator rejects non-object and extra top-level payloads", () => {
  assert.equal(
    invokeMiddleware(validateHealthAssessmentPayload, {
      answers: [["has_history", true]],
    })?.statusCode,
    400
  );
  assert.equal(
    invokeMiddleware(validateHealthAssessmentPayload, { answers: validAnswers, score: 10 })?.statusCode,
    400
  );
});
