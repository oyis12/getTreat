# GetTreat --- Master Development Handoff

**Document:** `GETREAT_MASTER_HANDOFF_2026-09-25.md`\
**Project:** GetTreat\
**Last updated:** 2026-09-25\
**Purpose:** Persistent source of truth for continuing GetTreat
development across new ChatGPT conversations and coding agents.

> **Current continuation point:** Patient Dashboard → Vitals → **4H-2
> --- Record Vital**

------------------------------------------------------------------------

## 1. How to use this document

This file is the project's continuity layer.

When a conversation reaches the ChatGPT conversation-length limit, start
a new chat inside the GetTreat Project and instruct the assistant/agent:

> Continue GetTreat from `GETREAT_MASTER_HANDOFF_2026-09-25.md`. Read
> the handoff first. The current task is **4H-2 --- Record Vital**.
> Preserve completed work, do not redesign working architecture, and
> verify uncertain details against the project files/code before
> implementing.

Update this document whenever a feature is completed, an API contract
changes, a model changes, or a new implementation decision is confirmed.

**Important:** This document deliberately distinguishes confirmed facts
from items that still need code/Figma verification. Do not turn an
unverified item into an implementation assumption.

------------------------------------------------------------------------

# 2. Product Context

GetTreat is a medical-support platform focused on pregnant patients and
related healthcare workflows.

Primary actors:

-   `patient`
-   `provider`
-   `admin`
-   `super_admin`

Sensitive health information is involved. Therefore:

-   least privilege is mandatory;
-   authentication is not authorization;
-   role checks are not sufficient for patient-data access;
-   ownership/relationship checks are required;
-   never expose unnecessary health information;
-   never invent clinical rules or medical calculations;
-   backend state is authoritative for protected workflows.

------------------------------------------------------------------------

# 3. Source of Truth / Design

Approved Figma blueprint:

-   File key: `2U1jhBMyf73OjRQpCoB14V`
-   Node: `1669:162202`
-   Top-level page observed: `Figma Basics`

Figma is a product/design source, not a database schema.

Rules:

1.  Identify features by labels, actions, fields, relationships and user
    flow.
2.  Do not assume canvas position means architectural grouping.
3.  Do not create one database model per screen.
4.  A screen may represent a state, modal, responsive variation or
    reusable component rather than a separate route.
5.  Do not invent clinical fields, provider qualifications, permissions
    or medical workflows.
6.  When exact fields are uncertain, inspect the relevant
    screenshot/Figma export before coding.

Figma MCP previously reached the Starter-plan tool-call limit. When
exact screen inspection is unavailable, use confirmed project artifacts
and do not claim an individual screen was fully inspected.

------------------------------------------------------------------------

# 4. Technology / Architecture

Required backend stack:

-   Node.js
-   Express.js
-   MongoDB
-   Mongoose
-   native ES modules (`"type": "module"`)
-   Cloudinary
-   multer
-   `multer-storage-cloudinary`
-   bcryptjs
-   dotenv
-   configured transactional email provider (Resend or Brevo)

Do not introduce:

-   Prisma
-   PostgreSQL
-   another ORM
-   another database

unless explicitly approved.

Architecture:

``` text
Request
  ↓
Route
  ↓
Middleware
  ↓
Validation
  ↓
Controller
  ↓
Service
  ↓
Model / External Service
  ↓
Response
```

Preferred project organization:

``` text
config/
controllers/
middlewares/
models/
routes/
services/
validators/
utils/
```

Controllers should stay thin. Business logic belongs in services.

------------------------------------------------------------------------

# 5. API Response Contract

Successful response:

``` json
{
  "success": true,
  "msg": "Human-readable outcome",
  "data": {}
}
```

Failure response:

``` json
{
  "success": false,
  "msg": "Human-readable error",
  "data": null,
  "errors": [
    {
      "field": "email",
      "message": "A valid email is required"
    }
  ]
}
```

Serialization conventions:

``` text
_id       → id
createdAt → created_at
updatedAt → modified_at
```

Never expose:

-   passwords/password hashes
-   OTP secrets
-   raw refresh tokens
-   JWT secrets
-   Cloudinary secrets
-   email API keys
-   unnecessary internal MongoDB details
-   internal Google OAuth identifiers in ordinary public serialization

------------------------------------------------------------------------

# 6. Authentication --- Confirmed Foundation

Authentication foundation is implemented and tested through the earlier
phases.

Core routes:

``` text
POST /api/auth/signup
POST /api/auth/signin
POST /api/auth/verify
POST /api/auth/resend
POST /api/auth/forgot-password
POST /api/auth/new-password
POST /api/auth/complete-profile
```

Compatibility spelling exists historically:

``` text
/auth/forget-password
```

Canonical spelling:

``` text
/auth/forgot-password
```

Only retain compatibility aliases when the existing frontend actually
requires them.

Authentication capabilities already implemented:

-   signup
-   signin
-   email verification
-   resend verification
-   forgot password
-   password reset
-   access tokens
-   refresh tokens
-   refresh rotation
-   logout/revocation
-   authentication middleware
-   role middleware
-   validation
-   global error handling
-   email integration

Refresh-token design includes secure server-side session state, rotation
and revocation.

------------------------------------------------------------------------

# 7. Signup / Onboarding Page State

The client requires persistent onboarding state so a user can close the
app and later resume at the correct onboarding step.

Approved flow:

``` text
Signup
  ↓
Verify OTP
  ↓
Complete Profile
  ↓
Choose Preferences
  ↓
Dashboard
```

Backend page values:

``` text
verify
complete_profile
preferences
dashboard
```

Expected progression:

``` text
Signup succeeds
  → page = "verify"

OTP verification succeeds
  → page = "complete_profile"

Profile completion succeeds
  → page = "preferences"

Preference completion succeeds
  → page = "dashboard"
```

Rules:

-   `page` is backend-authoritative.
-   Client must not mass-assign `page`.
-   Backend advances the value only after the corresponding server
    operation succeeds.
-   Signin should return the sanitized current `page`.
-   Do not create arbitrary page values for UI screens.

**Status:** The requirement was agreed and has been part of the active
implementation work. Verify the current User/auth code before making
further changes because the older handoff marked this as pending.

------------------------------------------------------------------------

# 8. User / Identity Model

`User` represents identity/authentication, not the entire patient
domain.

Roles:

``` text
patient
provider
admin
super_admin
```

Account statuses:

``` text
pending
active
suspended
deactivated
```

Authentication providers include:

``` text
local
google
```

Current identity fields include:

``` text
fullname
email
password (select false)
role
auth.providers.local.enabled
auth.providers.google.enabled
auth.providers.google.googleId
emailVerified
accountStatus
lastLoginAt
createdAt
modifiedAt
```

Unique email and sparse unique Google ID indexing are part of the
design.

------------------------------------------------------------------------

# 9. Google OAuth --- Current State

Google OAuth has been implemented and successfully tested in the
deployed GetTreat backend.

Observed successful result:

-   user role: `patient`
-   `emailVerified: true`
-   patient profile is created/available
-   Google authentication is working

The Google OAuth flow uses Passport and the existing User identity
boundary.

Important behavior:

### Google gender

Google OAuth does **not** provide a reliable application-level gender
value for this workflow.

Therefore:

``` text
PatientProfile.gender
```

may remain:

``` text
null
```

after Google signup/login.

Do not infer gender from a person's name, email address or Google
account.

Gender should be collected through the approved GetTreat
profile/onboarding flow.

### Google profile image

Automatic Google profile-image population was intentionally deferred.

**Current decision:** leave `profileImage` handling for later rather
than changing the working profile-image architecture.

### Existing local account + Google sign-in

Account-linking/sign-in behavior for a user who originally registered
with email/password and later chooses Google was being discussed.

Before changing it:

1.  locate the current Passport Google strategy;
2.  inspect how users are looked up by email and Google ID;
3.  preserve unique identity constraints;
4.  prevent accidental duplicate users;
5.  explicitly link Google to the existing account only when the
    security rules allow it;
6.  do not automatically merge unrelated accounts based only on an
    unverified email.

The exact currently deployed callback path should be confirmed from the
code rather than guessed.

------------------------------------------------------------------------

# 10. Patient Domain Boundary

Canonical architecture:

``` text
User
 │
 ├── PatientProfile
 │      ├── Pregnancy
 │      ├── Baby
 │      ├── PregnancyRecords
 │      ├── Appointments
 │      └── Transactions
 │
 ├── ProviderProfile
 │      ├── Verification
 │      ├── Services
 │      └── Availability
 │
 └── Admin / Super Admin domains
```

This is a domain boundary, not a statement that every child model is
already implemented.

Do not put pregnancy/medical data back onto `User`.

------------------------------------------------------------------------

# 11. PatientProfile --- Completed

One-to-one relationship:

``` text
User 1 ─── 1 PatientProfile
```

Fields:

``` text
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

``` text
country
city
state
zip
house_no
```

Canonical field name:

``` text
address
```

Do not restore the old `addr` structure.

Profile completion uses:

-   phone number
-   birth date
-   gender
-   address country
-   address state
-   address city

Patient profile service contains functionality equivalent to:

``` text
buildAddress
calculateProfileCompleted
sanitizePatientProfile
ensurePatientUser
createPatientProfile
getPatientProfile
updatePatientProfile
completePatientProfile
updatePatientProfileImage
```

------------------------------------------------------------------------

# 12. Patient Profile Routes --- Completed

``` text
GET   /api/patient/profile
PATCH /api/patient/profile
POST  /api/patient/profile/image
```

Protected by authentication and patient authorization.

------------------------------------------------------------------------

# 13. Patient Profile Image --- Completed and Tested

Cloudinary is used for managed storage.

Controlled folder:

``` text
gettreat/patient-profiles
```

Allowed formats:

``` text
JPG / JPEG
PNG
WebP
```

Allowed MIME types:

``` text
image/jpeg
image/png
image/webp
```

Maximum size:

``` text
5 MB
```

Upload field:

``` text
profile_image
```

Transformation:

``` text
width: 800
height: 800
crop: limit
quality: auto
fetch_format: auto
```

Stored metadata:

``` text
profileImage
profileImagePublicId
```

Replacement behavior:

1.  persist the new image;
2.  then delete the previous Cloudinary asset where appropriate.

The user tested the full profile-image flow successfully.

------------------------------------------------------------------------

# 14. Pregnancy --- Current Domain

Pregnancy became the active patient domain after the foundation/profile
phases.

The work progressed beyond the original handoff's simple "Pregnancy
model next" state.

The current project context indicates:

-   pregnancy/health assessment implementation has been tested;
-   `/api/user/me` returned an active current pregnancy;
-   the returned pregnancy had an EDD of `2027-06-12`;
-   the current pregnancy was in trimester 1;
-   the response showed approximately 2 weeks gone and 38 weeks
    remaining;
-   a Gestational Diabetes condition/assessment was present;
-   assessment state was:
    -   `result_status: "pending"`
    -   `score: null`

### Clinical-data rule

Do not invent medical scoring formulas.

If an assessment result is:

``` text
result_status = "pending"
score = null
```

preserve that state.

Do not calculate or fabricate a clinical score merely to make the UI
look complete.

### Current pregnancy duplication

The project context showed the current pregnancy represented in both:

``` text
pregnancy
pregnancy_history
```

Treat this as an existing implementation/data shape that must be
understood before refactoring.

Do not blindly remove or duplicate records.

------------------------------------------------------------------------

# 15. Patient Dashboard --- Current Product Structure

The patient dashboard has been broken down into functional areas rather
than treating every Figma frame as a separate backend route.

Known dashboard areas:

``` text
Dashboard
Get Started / onboarding
My Baby
My Vitals
Appointments
Transactions
Providers
Payments
Profile / Settings
```

Important Figma interpretation:

-   frames can be screens;
-   states can be modals;
-   responsive variants are not automatically new routes;
-   reusable components should remain reusable.

------------------------------------------------------------------------

# 16. My Baby --- Product Interpretation

My Baby was analyzed as a patient feature with areas around:

-   baby overview
-   baby profile/details
-   health/development information
-   relevant content
-   add/edit/save states
-   confirmation states

Likely frontend organization was discussed around:

``` text
/pages/patient/my-baby
```

with reusable components.

**Important:** Baby is a separate domain and should not be implemented
prematurely when the active task is Record Vital.

------------------------------------------------------------------------

# 17. My Vitals --- Current Feature

My Vitals was interpreted as a patient health-recording feature
containing:

-   vitals overview
-   vital history
-   chart/history visualization
-   record/update vital
-   vital detail states

Frontend component concepts previously discussed include:

``` text
VitalsSummary
VitalsHistory
VitalsChart
RecordVitalModal
```

The exact backend schema and endpoint must follow the approved
implementation already being developed, not be invented from these UI
names.

------------------------------------------------------------------------

# 18. CURRENT TASK --- 4H-2 Record Vital

**This is the current continuation point.**

Path:

``` text
GetTreat
  → Patient Dashboard
    → Vitals
      → 4H-2 — Record Vital
```

The objective is to implement the patient's ability to record a vital
measurement while preserving the existing pregnancy/patient
architecture.

### Required implementation discipline

Before modifying code:

1.  inspect the existing pregnancy/vitals models;
2.  inspect existing pregnancy service/controller/routes;
3.  inspect the current `/api/user/me` or equivalent current-patient
    aggregation;
4.  inspect any existing vitals-related model/route/service;
5.  inspect the approved Record Vital UI/screenshot if exact fields are
    needed;
6.  identify whether a vital is:
    -   one measurement;
    -   a set of measurements recorded together;
    -   tied to the current pregnancy;
    -   tied directly to PatientProfile;
    -   historical and immutable;
    -   editable under an approved workflow;
7.  preserve existing response contracts.

### Do not invent clinical fields

Only implement fields confirmed by:

-   existing working code;
-   approved Figma/product requirements;
-   explicit user instruction.

Potential vital categories must not be assumed merely because they are
common medical vitals.

If the UI explicitly confirms fields such as blood pressure,
temperature, weight or another measurement, map those exact fields and
units. Do not silently add additional clinical measurements.

### Ownership

A patient must only be able to create/read/update records belonging to
the authenticated patient and the appropriate pregnancy context.

Never accept:

``` text
patientId
userId
```

from the client as proof of ownership.

Derive ownership from authenticated identity and server-side
relationships.

### Current status

**4H-2 is the next implementation step.**

The exact final Record Vital schema, endpoint path, request payload and
validation rules should be verified from the current code/design before
being recorded as completed facts.

------------------------------------------------------------------------

# 19. Authorization Model

Use layered authorization:

``` text
Authentication
  ↓
Role permission
  ↓
Account/provider status
  ↓
Resource ownership / relationship
  ↓
Action permission
```

Patient:

-   accesses their own private resources.

Provider:

-   does not automatically access every patient.

Admin:

-   uses assigned permissions.

Super admin:

-   uses approved platform-wide permissions.

Never trust:

-   frontend route visibility;
-   hidden UI controls;
-   client-supplied patient IDs;
-   client-supplied ownership identifiers.

------------------------------------------------------------------------

# 20. Validation

Validate every client-controlled field:

-   required values
-   data types
-   string lengths
-   enums
-   dates
-   Mongo IDs
-   nested objects
-   numeric ranges where explicitly approved
-   pagination
-   filters
-   uploads
-   authorization-sensitive fields

Protected fields must not be mass-assigned:

``` text
role
accountStatus
verification state
permissions
password hash
internal IDs
administrative flags
ownership fields
```

------------------------------------------------------------------------

# 21. Testing Standard

Every major feature must test:

### Happy path

-   valid authenticated request
-   valid data
-   expected database state
-   expected response

### Validation

-   missing required values
-   invalid types
-   invalid enum values
-   invalid dates
-   invalid numeric values
-   malformed IDs

### Authentication

-   missing token
-   invalid token
-   expired token where applicable

### Authorization

-   wrong role
-   wrong ownership
-   inactive/suspended account where applicable

### Resource handling

-   not found
-   duplicate/conflict
-   stale/invalid references

### Security

-   sensitive fields are not exposed
-   client cannot override ownership
-   client cannot elevate role/permissions
-   clinical data is not exposed outside approved relationships

------------------------------------------------------------------------

# 22. Production Rules

Use environment variables for:

``` text
database
JWT
Cloudinary
email
application URLs
external APIs
```

Never commit:

``` text
.env
private keys
service-account credentials
Cloudinary secrets
email API keys
JWT secrets
database passwords
```

Production should:

-   use secure CORS;
-   use security headers;
-   enforce request limits;
-   enforce upload limits;
-   avoid verbose internal errors;
-   avoid sensitive logging;
-   use production database credentials;
-   use strong JWT secrets;
-   avoid exposing development-only OTP information.

------------------------------------------------------------------------

# 23. Frontend Compatibility

Known historical compatibility spellings:

``` text
/auth/forget-password
/system/prefered-choice
```

Canonical forms:

``` text
/auth/forgot-password
/system/preferred-choice
```

Do not propagate frontend typos into backend model/service names.

Preserve established contracts unless a deliberate migration is being
made.

------------------------------------------------------------------------

# 24. Later Domains

Not the current task:

``` text
Baby
Pregnancy Records
Appointments
Transactions
Provider
Provider Registration
Provider Profile
Provider Verification
Doctor Discovery
Community
Explore / Content
Notifications
Subscriptions
Payments
Admin
Super Admin
Control Admin
Trash / Archive
Audit
```

Do not jump to these while completing 4H-2.

------------------------------------------------------------------------

# 25. Historical Roadmap

Earlier roadmap:

``` text
Phase 1 — Foundation / Authentication       DONE
Phase 2 — PatientProfile                    DONE
Phase 3 — Patient Profile Image             DONE / TESTED
Phase 4 — Pregnancy                         IN PROGRESS
Phase 5 — Baby                              NOT STARTED
Phase 6 — Pregnancy Records                 NOT STARTED
Phase 7 — Appointments                      NOT STARTED
Phase 8 — Transactions                      NOT STARTED
```

The old handoff listed Pregnancy as the next domain. That is now
historical. The project has progressed into the patient-dashboard
health/vitals implementation.

------------------------------------------------------------------------

# 26. Important Historical Decisions

### Do not restore old User architecture

Old architecture placed patient data directly on `User`.

Current architecture:

``` text
User
  → identity/authentication

PatientProfile
  → patient profile data

Pregnancy
  → pregnancy domain

Vitals / health records
  → appropriate patient/pregnancy health domain
```

Do not put medical data back on User merely because it is convenient.

### Do not create models from screens

Avoid:

``` text
DashboardModel
VitalsScreenModel
ProfileScreenModel
```

Instead model real business entities.

### Do not invent clinical logic

If requirements do not define a medical formula, score or
interpretation:

``` text
store/display approved state
```

rather than inventing clinical logic.

------------------------------------------------------------------------

# 27. Current Known State Snapshot

``` text
GETTREAT

Backend foundation
  ✓ Node / Express
  ✓ MongoDB / Mongoose
  ✓ ES modules
  ✓ MVC
  ✓ Services
  ✓ Validators
  ✓ Response contract
  ✓ Global errors

Authentication
  ✓ Signup
  ✓ Signin
  ✓ Email verification
  ✓ Resend
  ✓ Forgot password
  ✓ Password reset
  ✓ Access tokens
  ✓ Refresh tokens
  ✓ Rotation
  ✓ Logout/revocation
  ✓ Role protection
  ✓ Google OAuth working
  ⚠ Google gender intentionally not inferred
  ⚠ Google profileImage deferred
  ⚠ Existing-account Google linking behavior must be preserved/verified
  ⚠ Onboarding page-state implementation should be verified against current code

Patient
  ✓ User identity separation
  ✓ PatientProfile
  ✓ Patient profile service
  ✓ Profile endpoints
  ✓ Profile completion
  ✓ Legacy migration

Profile image
  ✓ Cloudinary
  ✓ Multer
  ✓ JPG/PNG/WebP validation
  ✓ 5MB limit
  ✓ Upload
  ✓ Replacement
  ✓ Previous asset deletion
  ✓ Profile response
  ✓ Full scenario tested

Pregnancy / health
  ✓ Current pregnancy data is available
  ✓ Health assessment implementation tested
  ✓ /api/user/me exposes current-pregnancy information
  ✓ Current pregnancy / pregnancy-history representation exists
  ⚠ Do not invent assessment scoring
  ⚠ Preserve pending/null assessment state when returned

Patient dashboard
  ✓ Dashboard areas analyzed
  ✓ My Baby analyzed
  ✓ My Vitals analyzed

CURRENT
  → 4H-2 — Record Vital
```

------------------------------------------------------------------------

# 28. Exact Continuation Instructions

When continuing this project:

``` text
1. Read this file first.
2. Inspect the current code before modifying it.
3. Treat working code as authoritative over stale conversation notes.
4. Treat approved Figma/product requirements as authoritative for UI fields.
5. Do not invent medical rules.
6. Do not redesign completed authentication/profile infrastructure.
7. Do not create duplicate models/routes because a conversation forgot prior work.
8. Keep controllers thin.
9. Keep business logic in services.
10. Validate server-side.
11. Enforce ownership server-side.
12. Test the feature before calling it complete.
13. Update this handoff after meaningful milestones.
```

------------------------------------------------------------------------

# 29. Handoff Update Template

After completing a feature, add:

``` md
## [DATE] — [FEATURE]

Status: COMPLETED / IN PROGRESS / BLOCKED

Implemented:
- ...

Files:
- ...

Routes:
- ...

Request:
```json
{}
```

Response:

``` json
{}
```

Database: - ...

Validation: - ...

Authorization: - ...

Tests: - ...

Known limitations: - ...

Next step: - ... \`\`\`

------------------------------------------------------------------------

# 30. Non-Negotiable Project Rule

> Build GetTreat as a secure, production-ready Node.js/Express/MongoDB
> backend around real business domains and approved product flows, not
> individual screens, while preserving working code, API compatibility,
> privacy, authorization and the agreed step-by-step roadmap.

**Inspect → design → implement → test → confirm → update handoff →
advance.**

Do not jump steps. Do not invent requirements. Do not destroy working
code to solve a context problem.
