# Patient Health Management API (Phase 4J)

This guide covers the patient pregnancy health-assessment endpoints currently mounted
under `/api/user`. They operate on the authenticated patient's current pregnancy.

## Postman setup

Set a base URL, for example `http://localhost:3000`, and a valid patient access token.
For all requests, add:

| Header | Value |
| --- | --- |
| `Authorization` | `Bearer {{access_token}}` |
| `Content-Type` | `application/json` (for the `PUT` request) |

The patient identity comes from the access token. Do not send a patient/user ID.

## Routes

| Method | URL | Purpose |
| --- | --- | --- |
| `GET` | `{{base_url}}/api/user/me/pregnancy/health-assessments` | List active configured assessments and the patient's saved state. |
| `GET` | `{{base_url}}/api/user/me/pregnancy/health-assessments/{{condition_slug}}` | Fetch one assessment by slug. |
| `PUT` | `{{base_url}}/api/user/me/pregnancy/health-assessments/{{condition_slug}}` | Save/replace the submitted answer set for that assessment. |

Current default condition slugs are `gestational-diabetes`, `high-blood-pressure`,
`venous-thromboembolism`, and `anxiety-depression`. The condition must be active and
have an enabled assessment.

## Save assessment example

Request:

```http
PUT {{base_url}}/api/user/me/pregnancy/health-assessments/gestational-diabetes
Authorization: Bearer {{access_token}}
Content-Type: application/json
```

```json
{
  "answers": [
    { "question_key": "previous_gestational_diabetes", "value": false },
    { "question_key": "previous_baby_over_4_1kg", "value": false },
    { "question_key": "family_history_of_diabetes", "value": true },
    { "question_key": "previous_prediabetes", "value": false },
    { "question_key": "persistent_uti_or_vaginal_infections", "value": false },
    { "question_key": "excessive_tiredness", "value": true },
    { "question_key": "physical_activity_frequency", "value": "weekly" }
  ]
}
```

Answers must use the question keys and value types returned by the assessment `GET`
route. The example's final text value is free text; change it to the patient's answer.
The `PUT` replaces the saved answer set, so include every answer the client intends to
retain. Partial submissions are allowed; required unanswered questions leave the
assessment `in_progress`.

Example successful response (`200`):

```json
{
  "success": true,
  "msg": "Pregnancy health assessment saved successfully",
  "data": {
    "id": "<assessment-id>",
    "condition": {
      "id": "<condition-id>",
      "name": "Gestational Diabetes",
      "slug": "gestational-diabetes"
    },
    "condition_name": "Gestational Diabetes",
    "condition_slug": "gestational-diabetes",
    "status": "completed",
    "result_status": "pending",
    "score": null,
    "answers": [
      { "question_key": "previous_gestational_diabetes", "value": false }
    ],
    "started_at": "<ISO-8601 timestamp>",
    "completed_at": "<ISO-8601 timestamp>"
  }
}
```

The response shows one answer for brevity; a successful response returns the submitted
answer set. Assessment completion currently records completion only. Clinical scoring,
risk percentages, and derived Health Check statuses are deferred TODOs; no score or
clinical result is calculated, and `result_status` remains `pending` with `score: null`.

## Read examples

List all enabled assessments:

```http
GET {{base_url}}/api/user/me/pregnancy/health-assessments
Authorization: Bearer {{access_token}}
```

Read one assessment and its configured questions:

```http
GET {{base_url}}/api/user/me/pregnancy/health-assessments/gestational-diabetes
Authorization: Bearer {{access_token}}
```

An assessment not yet saved returns `status: "not_started"`, empty `answers`,
`result_status: "pending"`, and `score: null`.

## Errors and access

Successful reads and saves return `200` using the standard `{ success, msg, data }`
response envelope. Common errors include:

- `400` — malformed body, unknown fields/questions, duplicate question keys, wrong
  answer types, or invalid configured options.
- `401` — missing or invalid bearer token.
- `403` — authenticated account is not a patient or is suspended/deactivated.
- `404` — patient/profile/current pregnancy or active condition is not found.
- `422` — condition exists but has no enabled assessment.

All access is scoped to the authenticated patient. A current pregnancy is required.
The four default conditions are populated by `npm run seed:health-conditions` in
environments where they have not otherwise been configured.
