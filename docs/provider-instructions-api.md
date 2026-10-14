# Provider APIs — 4K Instructions, 4L Registration, and Provider Offerings

In GetTreat, a **doctor is a provider**. Provider identities and patient identities
remain `User` accounts with role-specific profiles linked to them. This guide covers
4L provider registration and admin approval, 4K patient/provider instructions and
relationship roster, and the provider-specific service catalogue. Paid provider
subscriptions and their trusted payment lifecycle remain separate from GetTreat's
platform subscription.

Use a non-production database and Postman environment. Set `{{base_url}}` and the
bearer tokens for an active provider, admin, and patient. All JSON requests use
`Content-Type: application/json`.

## 1. Submit provider registration (4L)

After provider signup, email verification, and signin, submit provider registration as
`multipart/form-data`. The server creates a linked `ProviderProfile` with
`approval_status: "pending"`. The provider cannot approve themselves. All profile
fields and three consent checks are required. All three required credentials must be
submitted on first registration; profile image is optional.

```http
PUT {{base_url}}/api/provider/me/profile
Authorization: Bearer {{provider_access_token}}
```

In Postman select Body → form-data. Postman generates the multipart `Content-Type`
header and boundary; do not set that header manually. The three credential file fields
must be included in the first submission; subsequent updates may retain existing
credentials and replace any one.

| Key | Type | Example |
| --- | --- | --- |
| `professional_field` | Text | `gynecology` |
| `professional_field_other` | Text | `Doula` (required only for `others`) |
| `years_experience` | Text | `4` (integer 0–80) |
| `bio` | Text | Provider bio, up to 300 characters |
| `country` | Text | `Nigeria` |
| `state` | Text | `Lagos` |
| `address` | Text | Provider address |
| `credentials_valid` | Text | `true` |
| `regulations_agreed` | Text | `true` |
| `professional_data_consent` | Text | `true` |
| `profile_image` | File | Optional JPG/PNG, max 8 MB |
| `higher_institution_certificate` | File | Required JPG/PNG/PDF, max 8 MB |
| `nysc_certificate` | File | Required certificate/exemption JPG/PNG/PDF, max 8 MB |
| `medical_license` | File | Required JPG/PNG/PDF, max 8 MB |

Allowed values are `gynecology`, `physiotherapist`, `food_nutrition`, and `others`.
The provider profile route requires an authenticated, email-verified, active account
with role `provider`.
Credential files use Cloudinary authenticated delivery; responses contain signed
download links that expire after 10 minutes. Do not log or share those links.

Read the submitted profile:

```http
GET {{base_url}}/api/provider/me/profile
Authorization: Bearer {{provider_access_token}}
```

## 2. Admin review

List pending profiles (the default filter):

```http
GET {{base_url}}/api/admin/providers?page=1&limit=20
Authorization: Bearer {{admin_access_token}}
```

Filter with `approval_status=pending|approved|rejected|all`. Admins with the
`manage_providers` permission and super admins can approve or reject. Each status
change is recorded in the provider profile's
`approval_history` with the acting user and timestamp. Approval returns `409` until
profile fields, all consents, and all three credential files are present. Changing profile
details, profession, photo, or credentials after approval returns the application to
`pending`.

```http
PATCH {{base_url}}/api/admin/providers/{{provider_profile_id}}/approval
Authorization: Bearer {{admin_access_token}}
Content-Type: application/json
```

```json
{
  "approval_status": "approved"
}
```

Valid decisions are `approved` and `rejected`. Only approved provider profiles can
access provider-patient routes. Changing a provider's professional field sends the
profile back to pending review.

## 3. Provider patient list

The provider's patient roster is scoped to subscription records belonging to that
provider. Each patient appears once with the newest relationship's derived status.
This endpoint returns only patient ID, name, profile image, and subscription dates.

```http
GET {{base_url}}/api/provider/me/patients?status=all&page=1&limit=20
Authorization: Bearer {{provider_access_token}}
```

`status` accepts `all`, `active`, or `expired`; page size is 1–100. Use the returned
`patient_id` in the instruction routes below.

## 4. Subscription access prerequisite

4K's provider/patient access relationship is now created by the trusted 4M purchase
workflow. A subscription references one specific `ProviderService`, and the server
resolves provider and patient profiles from that service and the authenticated user.
For a provider, any active service subscription to that provider appears in the patient
roster; service purchase entitlement remains scoped to its specific service.

Do not manually import an active subscription fixture. Use the patient checkout route
in [provider-subscriptions-4m-api.md](provider-subscriptions-4m-api.md) against an
isolated non-production database and Paystack test keys.

## 5. Send an instruction and prescription

Only an approved provider with a currently active subscription to the target patient
can send a new instruction. The patient ID comes from the route and is checked against
the provider's subscription; do not send a provider ID in the request body.

```http
POST {{base_url}}/api/provider/patients/{{patient_id}}/instructions
Authorization: Bearer {{provider_access_token}}
Content-Type: application/json
```

```json
{
  "instruction": "Please follow the care instructions discussed with your provider.",
  "prescription": "1. Example item\n2. Another example item"
}
```

`prescription` is optional plain text, matching the two text areas in the provider
screen. Use actual provider-authored content; the example is only a request-shape
example. Records are append-only in this phase; there are no update/delete routes.

Successful creation returns `201`:

```json
{
  "success": true,
  "msg": "Provider instruction sent successfully",
  "data": {
    "id": "<instruction-id>",
    "doctor": {
      "id": "<provider-profile-id>",
      "name": "Provider Name",
      "profession": "Gynecology"
    },
    "instruction": "Please follow the care instructions discussed with your provider.",
    "prescription": "1. Example item\n2. Another example item",
    "created_at": "<ISO-8601 timestamp>"
  }
}
```

## 6. Read instructions

An approved provider can read the selected patient's instruction history while their
subscription to that patient is active. This includes prior providers' instructions,
as shown by the provider patient-detail design:

```http
GET {{base_url}}/api/provider/patients/{{patient_id}}/instructions?page=1&limit=20
Authorization: Bearer {{provider_access_token}}
```

The patient can read their own instruction history and one instruction at any time,
including after the provider subscription expires:

```http
GET {{base_url}}/api/user/me/provider-instructions?page=1&limit=20
Authorization: Bearer {{patient_access_token}}
```

```http
GET {{base_url}}/api/user/me/provider-instructions/{{instruction_id}}
Authorization: Bearer {{patient_access_token}}
```

List responses use `data.items` and `data.pagination`. Results are newest first.
Patient ownership is resolved from the authenticated token; no patient ID is accepted
on patient self-service routes.

## Common errors

- `400` — invalid ID, malformed body, unknown input property, or invalid query value.
- `401` — missing or invalid bearer token.
- `403` — wrong role, provider profile not approved, or provider has no active
  subscription to the selected patient.
- `404` — profile, patient, or patient-owned instruction not found.
- `409` — provider account is not verified/active for admin review.

The patient-dashboard `Live Healthy` hero/banner is separate content. 4K stores the
doctor-authored instruction and prescription text only; it does not add banner,
article, clinical advice, or image-upload fields.

## 7. Manage provider offerings

Approved providers manage their own catalogue. Create an offering:

```http
POST {{base_url}}/api/provider/me/services
Authorization: Bearer {{provider_access_token}}
Content-Type: application/json
```

```json
{
  "title": "Pregnancy care subscription",
  "original_price": 1500,
  "discount_percent": 10,
  "billing_cycle": "monthly"
}
```

`discount_percent` is optional and defaults to `0`. The server calculates
`discounted_price`; clients cannot submit a final price, currency, or active status.
Price is stored/displayed in NGN, matching the Nigerian design example. Supported
provider service cadences are `monthly`, `quarterly`, and `yearly`.

```http
GET {{base_url}}/api/provider/me/services
Authorization: Bearer {{provider_access_token}}
```

Update selected fields with `PATCH /api/provider/me/services/{{service_id}}`. Archive
an offering with `DELETE /api/provider/me/services/{{service_id}}`; the record is
soft-disabled and removed from patient discovery. Providers can only modify offerings
under their own approved provider profile.

Patients browse active offerings by title/provider name and filter by profession or
discount:

```http
GET {{base_url}}/api/providers/services?search=nutrition&professional_field=food_nutrition&discount_only=true&page=1&limit=20
Authorization: Bearer {{patient_access_token}}
```

These routes currently enforce patient authentication and provider visibility, but do
not yet check a patient's active GetTreat platform subscription. The platform
subscription entitlement record/gate is a separate roadmap phase (4O); do not treat
provider discovery as production-ready access enforcement until that gate is connected.

For a single provider, use `GET /api/providers/{{provider_profile_id}}/services` with
the same query options. Only approved providers with verified active accounts appear.
Responses include provider identity, title, original price, discount percent,
server-calculated discounted price, currency, and billing cadence.

## 8. Provider subscription and payment scope

Provider subscription is separate from GetTreat's platform subscription. Provider
screens show patient browsing/searching, provider subscription state, provider service
price, cadence, and discount offers. The 4M purchase, Paystack payment and renewal
routes are documented in
[provider-subscriptions-4m-api.md](provider-subscriptions-4m-api.md). The current
`Service` catalogue and platform `System` subscription configuration remain separate.

The registration screens also show a “Message GetTreat” action after rejection. The
backend has no confirmed support-ticket/clarification API contract, so this action is
not exposed here; connect it through the approved support workflow when that domain is
mapped.
