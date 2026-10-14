# GetTreat — Complete Development Handoff
**Last updated:** 2026-10-14
**Project:** GetTreat
**Purpose:** Transfer the current project state to a new ChatGPT account / Codex session without losing development history, decisions, completed features, caveats, or the next task.

---

## 1. Exact continuation point

**Current task: deploy and verify the prepared Render Cron Job for 4M — Patient ↔ Provider Service Subscriptions and Paystack billing.**

- **4H — My Vitals:** complete and tested.
- **4I — My Baby Progress:** complete and tested.
- **4K — Doctor's Instructions:** implemented, tests passing.
- **4L — Provider registration/profile/approval:** implemented with provider-owned offerings and patient discovery routes; medical license was added as a required credential in this work.
- **4R — Admin/Super Admin:** foundational account provisioning, permission records, and admin login OTP are implemented; remaining admin dashboard domains are not implemented.
- **4M:** provider-specific service subscriptions and Paystack checkout, verification, webhook reconciliation, optional auto-renew, three renewal attempts over a seven-day grace period, and service access through grace are implemented and mounted. Continue with isolated non-production integration checks, then proceed to **4N — Transactions**. Keep provider subscriptions distinct from platform subscription (4O).
- **Next:** create the `gettreat-provider-billing` service from `render.yaml` after signing into Render, provide its environment secrets directly in Render, and verify that it processes the user's queued webhook. The user authorized up to $2/month; current configuration runs every ten minutes with a one-item batch and has an estimated cost below that amount under normal runtime. Render does not hard-cap Cron runtime spending. 4N transaction history/refund administration remains outstanding.
- Do not restart completed features or invent clinical logic.
- Latest fix: the user encountered a startup error because `validators/patient-profile.validator.js` did not export `validateRecordVital`. The user restored `validateRecordVital` and `validateUpdateVital`; they confirmed: **“its working.”**
- The complete API reference JSON was generated as `getTreat-frontend-api-reference-2026-10-03-complete.json` and provided in the previous conversation.
- The user is switching to a new ChatGPT/Codex account. The actual current project files on disk are the source of truth.

### First instruction for the next AI

> Continue GetTreat using this handoff. **4J Health Management, 4K Provider Instructions, 4L provider registration/profile/approval and offering catalogue, and the 4M provider-service billing implementation are present.** Verify current code and tests before proceeding. The current actors are `patient`, `provider` (including Medical Staff Admin/doctor provider), `admin` (Control Admin), and `super_admin`. Do not redo completed phases or invent clinical rules. Provider subscriptions and platform subscription (4O) are separate.

---

## 2. Required workflow and engineering rules

Follow: **Inspect → Design → Implement → Test → Confirm with user → Update handoff → Advance.**

1. Inspect current code before changing it.
2. Preserve working code and API contracts. Prefer minimal, targeted changes.
3. Do not mark a feature complete until the user tests it or tests clearly prove it.
4. A route file existing does not prove it is mounted. Verify imports and `app.use()`/router registrations.
5. Current local code overrides old ZIPs, generated references, and previous chat conclusions.
6. Never invent clinical fields, risk thresholds, scores, interpretations, medical calculations, reference standards, milestones, or formulas.
7. Figma is a UI/product source, not automatically a database schema.
8. Ownership must derive from authenticated identity and server-side relationships. Never trust client-supplied `patientId`, `userId`, or `pregnancy_id` as proof of ownership.
9. Authentication is not authorization. Check role and ownership/relationship.
10. Validate all client-controlled fields. Reject unknown fields where strict inputs are expected.
11. Never mass-assign role, account status, verification state, permissions, password hash, internal IDs, ownership fields, or other server-controlled values.
12. Keep secrets/configuration in environment variables.
13. Keep controllers thin; business logic belongs in services.
14. Do not introduce a new database or ORM without explicit approval.
15. Mark unknown details as “verify against current code” rather than guessing.

### Preferred stack

- Node.js, Express, MongoDB, Mongoose
- Native ES modules (`"type": "module"`)
- MVC/service/route/validator separation
- Cloudinary for managed image storage
- Existing folders include `config/`, `controllers/`, `middlewares/`, `models/`, `routes/`, `services/`, `validators/`, `utils/`.

Do **not** introduce Prisma, PostgreSQL, or another ORM/database unless the user approves.

### API response contract

Success:
```json
{
  "success": true,
  "msg": "Human-readable outcome",
  "data": {}
}
```

Failure:
```json
{
  "success": false,
  "msg": "Human-readable error",
  "data": null,
  "errors": []
}
```

Serialization:
- `_id` → `id`
- `createdAt` → `created_at`
- `updatedAt` → `modified_at`

Never expose password hashes, OTP secrets, raw refresh tokens, JWT secrets, Cloudinary secrets, email API keys, or unnecessary internal OAuth details.

---

## 3. Product overview

GetTreat is a medical-support platform focused on pregnant patients and related healthcare workflows.

Actors: `patient`, `provider`, `admin`, `super_admin`.

Conceptual domain boundary:
```text
User
├── PatientProfile
│   ├── Pregnancy
│   ├── Baby
│   ├── Vitals
│   ├── Pregnancy health conditions / assessments
│   ├── Appointments (future/other roadmap work)
│   └── Transactions (future/other roadmap work)
├── ProviderProfile
│   ├── Verification
│   ├── Services
│   └── Availability
└── Admin / Super Admin domains
```
This is a conceptual boundary, not proof every future domain exists. Keep pregnancy/medical data out of the `User` identity model.

---

## 4. Roadmap status

### Phase 1 — Foundation
- 1A project structure / ES modules — **complete**
- 1B environment / database configuration — **complete**
- 1C global errors / API response — **complete**
- 1D core middleware — **complete**
- 1E security/auth foundation — **complete**

### Phase 2 — Authentication and onboarding
- 2A User model — **complete**
- 2B Signup — **complete**
- 2C Email verification / OTP — **complete**
- 2D Signin — **complete**
- 2E Refresh token — **complete**
- 2F Logout / token revocation — **complete**
- 2G Forgot password — **complete**
- 2H Reset password — **complete**
- 2I Complete profile — **complete**
- 2J Google OAuth — **complete**
- 2K Existing-account Google sign-in/linking — **complete**
- 2L Signup/onboarding page state — **complete**

### Phase 3 — Patient profile
- 3A PatientProfile model — **complete**
- 3B migration — **complete**
- 3C `GET /api/user/me` — **complete**
- 3D patient profile update — **complete**
- 3E validation — **complete**
- 3F profile image upload — **complete**
- 3G Cloudinary replacement — **complete**

### Phase 4 — Patient dashboard and health domains
- 4A Pregnancy embedded domain — **complete**
- 4B Pregnancy creation — **complete**
- 4C Pregnancy update — **complete**
- 4D Pregnancy progress calculation — **complete**
- 4E Pregnancy history/current pregnancy — **complete**
- 4F Health-condition catalogue — **complete**
- 4G Pregnancy health conditions — **complete**
- 4G-1 Health assessments — **complete**
- 4G-2 Assessment persistence/integration — **complete**
- Separate My Baby work historically numbered 4G-1 through 4G-6 — **complete**
- 4H My Vitals, 4H-1 through 4H-7 — **complete and tested**
- 4I My Baby Progress — **complete and tested**
- 4J Health Management — **implemented and tested; clinical scoring remains deferred TODO**
- 4K Doctor’s Instructions — **implemented and unit/model tested; subscription lifecycle integration continues in 4M**
- **4L Provider registration/profile/approval — implemented and tested; provider offerings/discovery are also implemented as a 4M prerequisite. Medical license is now required for approval.**
- **4R Admin/Super Admin foundation — initial super-admin bootstrap, Control Admin account management, explicit permission scopes, and admin OTP sign-in are implemented; remaining admin domains are outstanding.**
- **4M Patient ↔ Provider Subscriptions/Services — implemented and mounted; checkout, verified payment, idempotent webhook fulfillment, opt-in renewal, retry/grace policy and service entitlement are covered by offline tests. Paystack/MongoDB live integration remains to be tested in an isolated environment.**
- Render Cron configuration is prepared in `render.yaml` with deployment steps in `docs/render-provider-billing-cron.md`; the service has not been created because Render authentication and direct entry of secrets are required.
- **4N Transactions — next; patient/admin/provider history and transaction detail workflows remain upcoming.**
- 4O Platform Subscription — upcoming
- 4P Community — upcoming
- 4Q Support — upcoming
- 4R Admin — foundation implemented; broader admin and super-admin workflows upcoming
- Phase 5 production hardening — upcoming

**Numbering collision:** The historical roadmap uses `4G` for more than one feature group. Do not casually renumber completed work.

---

## 5. Authentication, onboarding, and patient profile

Known core authentication routes:
```text
POST /api/auth/signup
POST /api/auth/signin
POST /api/auth/verify
POST /api/auth/resend
POST /api/auth/forgot-password
POST /api/auth/new-password
POST /api/auth/complete-profile
```
A historical `/auth/forget-password` spelling may exist for compatibility; canonical spelling is `/auth/forgot-password`. Verify current route files.

Implemented auth capabilities include access tokens, refresh tokens/rotation, logout/revocation, auth and role middleware, validation, global error handling, transactional email, Google OAuth, and existing-account Google sign-in/linking.

Approved onboarding page states:
```text
verify
complete_profile
preferences
dashboard
```
Backend `page` state is authoritative and must not be mass-assigned by the client.

### Google OAuth decisions
- Google OAuth is working.
- Google-authenticated users can have role `patient`, `emailVerified: true`, and a patient profile.
- Never infer gender from a name/email. `PatientProfile.gender` may remain `null` until the approved onboarding/profile flow collects it.
- Automatic Google profile-image population was deferred; use the existing profile-image flow.

### PatientProfile
One-to-one relationship: `User 1 — 1 PatientProfile`.

Core fields include:
```text
user
phone_no
birth_date
gender
address
profileImage
profileImagePublicId
profileCompleted
createdAt
modifiedAt
```
Address:
```text
country
city
state
zip
house_no
```
Canonical field is `address`; do not restore an old `addr` structure.

Known profile routes:
```text
GET   /api/patient/profile
PATCH /api/patient/profile
POST  /api/patient/profile/image
```
Verify route mounts in the current code.

### Profile image
- Cloudinary folder: `gettreat/patient-profiles`
- Allowed: JPG/JPEG, PNG, WebP
- Max size: 5 MB
- Upload field: `profile_image`
- Stored metadata: `profileImage`, `profileImagePublicId`
- Replacement persists new asset and removes old asset when appropriate.
- Flow was tested.

---

## 6. Pregnancy and pregnancy health

Completed:
- Pregnancy embedded domain, create/update
- Pregnancy progress calculation
- Current pregnancy and pregnancy history
- Health-condition catalogue
- Patient pregnancy health-condition selection/management
- Configurable health assessments
- Assessment persistence and `/api/user/me` integration

Assessment areas previously seeded:
- Gestational Diabetes
- High Blood Pressure
- Venous Thromboembolism
- Anxiety & Depression

Known assessment routes:
```text
GET /api/user/me/pregnancy/health-assessments
GET /api/user/me/pregnancy/health-assessments/:conditionSlug
PUT /api/user/me/pregnancy/health-assessments/:conditionSlug
```
Verify against current router before relying on them.

Assessment status values:
- `not_started`, `in_progress`, `completed`

Result status values:
- `pending`, `at_risk`, `low_risk`, `normal`, `needs_review`

**Clinical safeguard:** Where no approved medical scoring formula exists, the implementation intentionally leaves `result_status: "pending"` and `score: null`. Do not add scoring, thresholds, diagnoses, or risk classifications without an explicit approved requirement.

Existing patient serialization has represented current pregnancy in both `pregnancy` and `pregnancy_history`. Treat as existing behavior until deliberately reviewed; do not blindly duplicate or remove entries.

---

## 7. My Baby — complete through photo management

My Baby embedded schema/CRUD and photo management were previously completed:
- Baby embedded schema
- Baby CRUD
- add photo
- replace photo
- delete photo
- photo limits/validation

Existing Baby fields:
```text
date_of_birth
gender
weight
length
head_circumference
photos
```
Do not reopen completed photo work without a new requirement.

---

## 8. 4H — My Vitals: complete and tested

### Latest fix
The user encountered:
```text
SyntaxError: The requested module '../validators/patient-profile.validator.js'
does not provide an export named 'validateRecordVital'
```
`routes/vitals.routes.js` imported `validateRecordVital` and `validateUpdateVital`, but the validator module did not export them. The user restored the exports and confirmed the app works.

Relevant files:
```text
controllers/vitals.controller.js
services/vitals.service.js
routes/vitals.routes.js
validators/patient-profile.validator.js
models/patient-profile.model.js
services/patient-profile.service.js
server.js
```
Do not remove the validators or create a parallel Vitals architecture.

### Data model
Vitals are embedded in `PatientProfile`. A record supports:
```text
pregnancy_id (optional for legacy compatibility)
blood_pressure:
  systolic
  diastolic
sugar_level:
  value
  unit
recorded_at
created_at
modified_at
```
Sugar units: `mg/dL`, `mmol/L`, normalized to lowercase (`mg/dl`, `mmol/l`).

### Routes declared by Vitals router
```text
POST   /api/user/vitals
GET    /api/user/vitals
GET    /api/user/vitals/report
GET    /api/user/vitals/summary
PATCH  /api/user/vitals/:vitalId
DELETE /api/user/vitals/:vitalId
```
**Mount caveat:** An older ZIP inspection found `routes/vitals.routes.js` but did not find it imported in `user.routes.js`. The user subsequently fixed missing validator exports locally and confirmed the app works. The next AI must inspect the *current* `server.js`, `user.routes.js`, and `vitals.routes.js` to verify the actual mount. Do not repeat the stale “not mounted” claim without checking.

### Record
`POST /api/user/vitals`

Example:
```json
{
  "blood_pressure": {
    "systolic": 120,
    "diastolic": 80
  },
  "sugar_level": {
    "value": 98,
    "unit": "mg/dL"
  }
}
```
- protected patient endpoint
- owner derived from authenticated user
- patient profile/current pregnancy required as enforced by service
- `recorded_at` and pregnancy context assigned server-side
- client must not send ownership or `pregnancy_id`
- validates nested fields, required values, finite/nonnegative numbers, units, unknown fields
- no clinical interpretation

### History
`GET /api/user/vitals`

Supports:
```text
GET /api/user/vitals
GET /api/user/vitals?date=2026-09-27
GET /api/user/vitals?from=2026-09-01&to=2026-09-27
```
- `date` is mutually exclusive with `from`/`to`
- `from` + `to` is an inclusive range
- newest-first ordering
- latest matching record and history list
- empty history is a successful empty state
- legacy records without `pregnancy_id` remain supported
- invalid/unknown filter combinations are rejected

### Report and summary
`GET /api/user/vitals/report` supports the same date filters and returns chart-ready data:
```text
total_records
records
chart.blood_pressure[]
chart.sugar_level[]
```
`GET /api/user/vitals/summary` returns summary data where available. `/api/user/me` includes `vitals_summary` fields such as:
```text
latest_blood_pressure
latest_sugar_level
last_recorded_at
total_records
```

### Update
`PATCH /api/user/vitals/:vitalId`
- updates `blood_pressure` and/or `sugar_level`
- client cannot update ownership, `pregnancy_id`, `recorded_at`, or ID
- `recorded_at` remains original event time
- validates empty/unknown/malformed updates and units

### Delete
`DELETE /api/user/vitals/:vitalId`
- ownership-protected
- permanently removes the embedded record
- Figma did not show a patient-facing Delete button; do not invent that UI action without product approval.

### Clinical rule: Sugar Difference
Figma displayed “Sugar Difference”, but formula/meaning was not specified. Do not invent a formula or medical interpretation.

### Testing status
User confirmed Vitals was tested for record/list/report/update/delete, filters, units, empty states, validation, auth, role/ownership, protected fields and serialization. **4H-1 through 4H-7 are complete.**

---

## 9. 4I — My Baby Progress: complete and tested

### Design
Current Baby measurements remain top-level latest values, with `growth_history` tracking changes:
```text
Baby
├── date_of_birth
├── gender
├── weight
├── length
├── head_circumference
├── photos
└── growth_history[]
    ├── recorded_at
    ├── weight
    ├── length
    ├── head_circumference
    └── source
```
Growth history source values:
```text
registration
patient_update
```
Growth records use `recorded_at` as event time. They do not necessarily have Mongoose timestamps; `created_at`/`modified_at` may serialize as null intentionally. Do not misrepresent `recorded_at` as a created timestamp.

### Endpoints
```text
POST /api/user/babies/:babyId/growth
GET  /api/user/babies/:babyId/growth
GET  /api/user/babies/:babyId/progress
GET  /api/user/babies/:babyId/progress/report
```
Verify current route mounts and exact serializers in code.

### Behavior
- New Baby registration with measurements creates a registration baseline.
- Patient updates append history and synchronize top-level latest measurements.
- History supports date/range filters.
- Progress calculates calendar-aware age.
- Change values are mathematical absolute and percentage differences only.
- Report returns chart-ready arrays.
- No fabricated medical interpretation.

### Percentile/milestone placeholders
Percentiles stay unavailable without approved reference standards, e.g.:
```json
{
  "value": null,
  "status": "reference_standard_required",
  "field": "weight_for_age"
}
```
Milestones stay placeholders without approved reference data, e.g.:
```json
{
  "status": "reference_data_required",
  "items": []
}
```
Do not invent percentiles, diagnoses, milestone schedules, or standards.

### Historical test example
A Baby Zara test case used baseline weight 5.6 kg, length 60 cm, head circumference 40 cm and later measurements 7.9 kg, 100 cm, 43 cm. Mathematical changes were +2.3 kg / 41.07%, +40 cm / 66.67%, and +3 cm / 7.50%. This is test data, not a clinical reference. Avoid copying test IDs into frontend docs unnecessarily.

### Tests
4I passed progress/age serialization, latest/previous measurements, absolute/percentage changes, newest-first history, date filtering, report, filtered progress, and placeholder handling. **4I is complete; do not restart it.**

---

## 10. 4J — Health Management: next task

Figma file:
`https://www.figma.com/design/ANUmIFPqBQvwHpiurrtpt1/Getreat-Project?node-id=7361-39414&t=PBYe11Sipu4LMEd2-1`

File key: `ANUmIFPqBQvwHpiurrtpt1`

Known frames:

Desktop:
- `6625:10966` — Health management details
- `6625:11326` — Health Check
- `6637:18143` — Health Check (At risk)
- `6637:18435` — Health Check (Stable)

Mobile:
- `1128:2292` — Health management landing page
- `1128:2313` — Health management details
- `1128:2384` — Health Check
- `1128:3499` — Health Check 8
- `1128:3578` — Health Check 9
- `1128:5380` — Health management selection

**Design review update (2026-10-13):** Individual exports under `designs/patients_dashboard/Health management/` were inspected. They show the four assessment forms and their question inputs, condition summary states, and the Health Management selection screen. The original Figma MCP call limit still prevented inspection of every listed remote frame, so use the repository exports as the visual reference for this work.

### Existing implementation verified

- `GET /api/user/me/pregnancy/health-assessments` lists each active configured assessment with saved answers or `not_started` state.
- `GET /api/user/me/pregnancy/health-assessments/:conditionSlug` returns one assessment and its configured questions.
- `PUT /api/user/me/pregnancy/health-assessments/:conditionSlug` validates and persists answers, setting `in_progress` or `completed`.
- The four seeded conditions match the Health Management assessment domains. Their assessment score is not computed; `result_status` stays `pending` and `score` stays `null`.
- The patient is resolved from the authenticated user and must have a current pregnancy.

### 4J implementation update

- Assessment answer objects now reject unknown nested properties at both the request validator and service boundary.
- Offline Node tests cover completed/partial answers, optional/inactive questions, unknown/duplicate questions, type/option validation, and request shape.
- No new assessment model or duplicate endpoint was added.
- **Deferred TODO:** Health Check/condition-summary percentages and labels such as `Stable` or `At Risk` require an approved clinical scoring rule. Until then, return/use `result_status: "pending"` and `score: null`; do not calculate or infer a status.
- **Open design discrepancy:** The Gestational Diabetes export includes “How do you see things?” but the seeded assessment does not. This question was not added because its relevance and intended answer values need confirmation. Keep this discrepancy visible for later review.
- Provider instructions and provider matching are separate upcoming provider-domain work; do not create fake instructions in the patient assessment API.

### Required 4J workflow
1. Treat the current code and individual exports as the implementation baseline.
2. Keep existing condition and assessment APIs; do not duplicate the domain.
3. Keep clinical summary calculation deferred until a scoring rule is approved.
4. Resolve the open Gestational Diabetes question discrepancy before adding it.
5. Test changes offline unless a dedicated non-production MongoDB test database is configured.
6. Update this handoff and API JSON if contracts change.

Do not confuse:
- health-condition catalogue
- patient-selected pregnancy health conditions
- health-assessment questions/answers/status/result
- Health Management landing/details/Health Check aggregation

Related concepts do not automatically need duplicate models or records.

### 4K — Provider Instructions implementation update (2026-10-14)

The Ready-for-Dev provider exports were reviewed under `designs/providers ui/`.
The relevant patient flow is in `patients/`: provider patient roster, patient details,
previous-provider instructions, and the Add Instruction & Prescription form. Patient
instruction screens are in `designs/patients_dashboard/dashboard/`. Doctors use the
existing `provider` role; do not introduce a separate doctor actor or role.

- `ProviderProfile.user` links provider-specific profile/approval data to the central
  `User` identity. Provider profession choices match the exported registration UI.
- Admin/super-admin review changes are recorded in the profile's approval history.
- `ProviderSubscription` now links a `ProviderProfile`, `PatientProfile`, and exactly
  one `ProviderService`; it stores the paid period, immutable price/cadence snapshot,
  renewal policy state and trusted payment lifecycle implemented in 4M.
- A provider must have an approved profile and a currently active provider subscription
  to list a patient's instruction history or send a new instruction.
- Providers can list prior instructions in an active patient's history, as shown in
  the provider UI. Patients can read their own instruction history after subscription
  expiry. Instructions are append-only in 4K.
- `ProviderInstruction` stores provider/patient profile references, a provider name and
  profession snapshot, instruction text, optional prescription text, and timestamps.
- The `Live Healthy` hero is separate content; no image or article fields were added to
  provider instructions.
- Postman guide: `docs/provider-instructions-api.md`. API JSON: `getTreat-api.json`.
- Unit/policy and Mongoose schema validation tests are in
  `tests/provider-instructions.*.test.js`.
- Local MongoDB was unavailable (`mongod` is not installed). Do not inspect or reuse
  the project `.env` URI for test data; it may point to a shared/production database.
  Postman write testing requires a dedicated non-production DB. 4M creates
  subscriptions through its trusted checkout/payment flow; do not insert manual active
  fixtures or use the existing `.env` database URI for billing tests.

### 4L — Provider registration, approval, offerings (2026-10-14)

- Provider registration now stores professional field and optional "Others" label, years
  of experience, bio (300 characters), country/state/address, optional profile image,
  three explicit consents with acceptance timestamp, and credential metadata.
- Higher Institution Certificate, NYSC Certificate/Letter of Exemption, and Medical
  License are required credentials before admin approval, following the exported admin
  application screen and the user's explicit medical-license requirement.
  Profile photos accept JPG/PNG; credentials accept JPG/PNG/PDF, max 8MB each.
- Provider credential assets are uploaded to Cloudinary using authenticated delivery.
  API responses create signed download URLs with a 10-minute expiry; do not log/share.
- Admin approval is blocked until registration fields, consent, and all three credential
  types exist. Updating core registration/profile fields after review returns the
  application to pending. The registration message-to-GetTreat action remains unmapped
  because no support ticket/clarification API contract exists.
- `ProviderService` is a provider-owned offering model, separate from global `Service`
  and `System.platform_subscription`. Providers can manage title, original NGN rate,
  optional percent discount, and monthly/quarterly/yearly cadence; the API calculates
  discounted price and soft-archives removed offerings.
- Patient discovery lists active offerings from verified, active, approved providers,
  with search, profession, discount, and pagination filters. It does not purchase or
  activate subscriptions. It currently enforces patient authentication but not the
  patient's GetTreat platform-subscription entitlement because the 4O subscription
  record/gate is not implemented; connect that gate before production release.
- This is registration and provider-offering groundwork, not completion of every
  provider dashboard domain in the exports. Appointments, availability, messaging,
  patient uploads/calls, posts/community/articles/reviews, notifications, transactions,
  and settings still need their own mapped requirements/roadmap steps.
- API docs: `docs/provider-instructions-api.md`; route reference: `getTreat-api.json`.
- Tests: `tests/provider-registration.policy.test.js`,
  `tests/provider-service.policy.test.js`, and expanded
  `tests/provider-instructions.validation.test.js`.
- Validation is offline; local MongoDB is unavailable and Cloudinary writes were not
  attempted. Postman integration requires a dedicated non-production database and
  configured Cloudinary test credentials.

### 4R — Admin and Super Admin foundation (2026-10-14)

- Actor mapping confirmed by the user: Control Admin = `admin`; Medical Staff Admin / doctor
  = `provider`; Super Admin = `super_admin`. Providers retain profession in `ProviderProfile`;
  no separate Medical Staff Admin role is introduced.
- Added `AdminProfile` linked to `User`, with `admin_type: control_admin` and explicit
  boolean permission scopes. `manage_admins` is stored as a future scope; account-management
  routes remain super-admin-only.
- Added operator-controlled `npm run bootstrap:super-admin`. It requires explicit
  environment authorization, refuses to elevate existing accounts, and does not alter
  an existing super admin. Point `MONGO_URI` to a dedicated non-production database for
  local testing.
- Super-admin-only routes are mounted at `/api/super-admin`: create/list/update Control
  Admin accounts. New admin accounts require email verification. Public signup still
  cannot create `admin` or `super_admin` accounts.
- Admin and super-admin password sign-in now requires a separate email OTP at
  `POST /api/auth/admin/2fa/verify`; codes expire according to configured OTP lifetime,
  attempts are capped, and resend is limited to once per minute. Tokens are issued only
  after successful OTP verification.
- Provider approval now requires an admin `manage_providers` permission; admin health
  condition configuration requires `manage_assessments`. Super admins bypass these scopes.
- Provider registration requires the three listed credentials, each JPG/PNG/PDF up to
  8 MB: higher institution certificate, NYSC certificate/exemption, and medical license.
- API guide: `docs/admin-management-api.md`; provider guide updated at
  `docs/provider-instructions-api.md`; `getTreat-api.json` updated.
- Tests: `tests/admin-management.policy.test.js`, `tests/admin-auth-2fa.test.js`, and
  `tests/provider-registration.policy.test.js`.
- Still outstanding in 4R: patient/provider moderation and detail domains, dashboard
  aggregates, content, notifications, support tickets, community moderation, reports,
  transactions, settings, admin audit log, and API-level integration against an isolated
  MongoDB and Cloudinary test configuration. These should be mapped to the corresponding
  design exports before their entities/routes are added.
- Admin Figma also includes a Medical License document action, now reflected in the
  provider registration contract. Other document requirements should remain limited to
  the approved screen and later confirmed requirements.

---

## 11. API documentation JSON

The previous conversation generated:
`getTreat-frontend-api-reference-2026-10-03-complete.json`

Previous file path:
`/mnt/data/getTreat-frontend-api-reference-2026-10-03-complete.json`

It contains 12 groups:
1. Authentication
2. Current User & Patient Dashboard
3. Pregnancy
4. Health Condition Catalogue
5. Pregnancy Health Assessments
6. Patient Pregnancy Health Conditions
7. My Baby
8. My Vitals
9. My Baby Progress
10. Service Catalogue
11. System Configuration
12. Admin Health Conditions

Caveat: this JSON was assembled from the then-current code snapshot and handoff, then updated to reflect the Vitals validator fix. It is a frontend reference, **not a substitute for verifying current route mounts and serializers in the actual code**. If repo and JSON differ, correct the JSON from code and document the discrepancy.

---

## 12. Code provenance and stale-snapshot warning

A previous working snapshot was `getTreat(2).zip`, SHA-256:
`2d9a46e5cbe982c20125b19a4e8efe3ef9ffb8f489aaef470d941126ce4aeb26`

This is a historical snapshot and may not contain the latest local validator fix or any later changes. Do not treat it as guaranteed current code.

Earlier generated reference `getTreat-frontend-api-reference-2026-10-02-latest-codebase.json` was superseded by the 2026-10-03 complete JSON.

The Vitals mount discrepancy is specifically unresolved from the old ZIP versus the user's latest working local state. Inspect current files before making a definitive claim.

---

## 13. Test and completion standard

For every feature, test:

**Happy path**
- authenticated valid request
- expected HTTP status and response
- expected persistence/update

**Validation**
- missing required values
- wrong types
- invalid enums
- malformed nested objects
- invalid numbers/negative values where applicable
- unknown request fields
- malformed IDs
- invalid dates/ranges

**Security**
- unauthenticated request
- wrong role
- another patient's record
- client-supplied ownership/internal/protected fields
- sensitive fields do not leak

**Domain-specific**
- empty states
- compatibility with old records
- date filtering
- no invented medical interpretation
- no duplicate/orphan records
- consistent error contract

Do not claim tests passed unless actually run or the user confirms. Distinguish automated tests, manual Postman/Insomnia tests, and inferred behavior.

---

## 14. Frontend integration conventions

- Use `Authorization: Bearer <access_token>` for protected endpoints when consistent with the current auth contract.
- JSON for normal API bodies.
- Use `multipart/form-data` for documented uploads; let the client library set the boundary.
- Respect `success`, `msg`, `data`, and `errors`.
- Respect ID/timestamp serialization.
- On supported history/report endpoints, use either `date` or `from` + `to`, not both.
- Never send client-selected ownership IDs as proof of ownership.
- Treat `null`, empty arrays, `pending`, and reference-data placeholders as meaningful states.
- Do not turn placeholder percentiles/milestones into fabricated estimates.

---

## 15. User preferences and workflow

- User is a solo developer and wants continuity across long-running work.
- Prefers direct, clear, production-focused, copy/paste-ready guidance.
- Wants one feature implemented and tested before moving to the next.
- Does not want completed features restarted because context was lost.
- Uses **Windows CMD**, not PowerShell. Give CMD-friendly commands by default.
- The user may switch ChatGPT/Codex accounts; do not assume the new account has the old account's conversation history or machine state.
- Codex tasks should be bounded, one at a time, with constraints, files to inspect, acceptance criteria, and tests.
- Avoid large refactors when a targeted fix is enough.

---

## 16. How the next AI should start

1. Read this handoff completely.
2. Have the user open the **current GetTreat project folder** in the new Codex account, or provide the latest ZIP if direct code inspection is needed.
3. Inspect actual files before asserting route mounts/contracts.
4. Confirm **4J/4K/4L/4M implementation status** from current code and tests.
5. Deploy and verify the 4M Render Cron Job after the user signs into Render and
   enters its secrets, keeping platform subscription access state (4O) separate;
   then continue to 4N Transactions.
6. Report **already implemented / missing / uncertain**, then give a bounded implementation/test plan.
7. Ask for clarification when clinical/product requirements are ambiguous.
8. After every completed feature, update this handoff and API JSON.

**Do not rebuild authentication, pregnancy, health assessments, My Baby, Vitals, Baby Progress, Health Management, provider instructions, provider registration/offering work, or 4M. Deploy the prepared Render Cron Job after authenticated access and direct secret entry, verify it processes the queued webhook, then continue to 4N Transactions.**
