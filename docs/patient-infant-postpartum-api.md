# Patient Infant Consent and Birth Confirmation API

These changes implement the patient My Baby exports for guardian attestation, birth confirmation, delivery mode and access to baby records attached to completed pregnancies. They preserve the embedded `PatientProfile.pregnancies[].babies[]` design.

## Authentication and Postman setup

- Set `baseUrl` to the API origin (for example, `http://localhost:7700`).
- Sign in as a patient with an active GetTreat platform subscription.
- Set `accessToken` to the returned bearer access token.
- Send `Authorization: Bearer {{accessToken}}` and `Content-Type: application/json`.
- The pregnancy and baby routes enforce patient role, account state, and the authenticated patient's profile. Do not send a user/profile ID to claim ownership.

## Confirm whether a birth occurred

`POST /api/user/me/pregnancy/birth-confirmation`

Use this for the design's “Have you delivered your baby yet?” step. If `delivered` is `false`, the current pregnancy remains active. If true, provide the selected delivery mode; the pregnancy is marked completed, removed from current-pregnancy status, and retained in pregnancy history. Repeating the same confirmed mode is idempotent when the same owned `pregnancy_id` is supplied; a conflicting mode returns `409`. The general pregnancy `PATCH` accepts `active` or `ended`; `completed` is reserved for this birth-confirmation workflow.

Not delivered:

```http
POST {{baseUrl}}/api/user/me/pregnancy/birth-confirmation
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```

```json
{ "pregnancy_id": "6ad055cabe3df71cab97d1d0", "delivered": false }
```

Delivered:

```json
{
  "pregnancy_id": "6ad055cabe3df71cab97d1d0",
  "delivered": true,
  "delivery_mode": "vaginal_birth"
}
```

`pregnancy_id` is optional while confirming the current pregnancy and recommended on every request; if supplied, it must belong to the authenticated patient. It makes retries unambiguous. `delivery_mode` supports `vaginal_birth` (design: Vaginal Birth) or `cesarean_section` (design: Cesarean Section). The server stores the confirmation timestamp, not a patient-supplied clinical delivery date. The response is the standard `{ success, msg, data }` envelope; `data` contains `delivered` and the pregnancy object. Expected errors: `400` invalid body/mode/ID, `401` unauthenticated, `403` role/platform entitlement/account restriction, `404` no current or owned pregnancy, `409` already confirmed or lifecycle conflict.

## Create a baby record with guardian attestation

`POST /api/user/me/babies` (canonical)  
`POST /api/user/babies` (existing compatibility mount)

The design's consent checkbox must be explicitly checked. The server records `infant-health-data-v1`, acceptance timestamp, authenticated user, and `child_health_data` scope. This is an attestation only; it does not independently verify guardian identity or establish legal compliance in every deployment jurisdiction. Existing legacy baby records are not assigned consent retroactively.

For a baby under the current pregnancy, `pregnancy_id` can be omitted. For a baby after birth confirmation, use the pregnancy ID returned by `GET /api/user/me/pregnancies`; the server verifies that it belongs to the authenticated patient's own profile and that birth was confirmed.

```http
POST {{baseUrl}}/api/user/me/babies
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```

```json
{
  "pregnancy_id": "6ad055cabe3df71cab97d1d0",
  "guardian_consent": true,
  "full_name": "Baby Henderson",
  "date_of_birth": "2026-10-14",
  "gender": "female",
  "weight": { "value": 3.2, "unit": "kg" },
  "length": { "value": 49, "unit": "cm" },
  "head_circumference": { "value": 34, "unit": "cm" }
}
```

`pregnancy_id`, `weight`, `length`, and `head_circumference` are optional; name, date of birth, gender, and `guardian_consent: true` are required. The response is `201` with the baby object and a consent summary (`version`, `accepted_at`, `scope`); the accepting user's ID is not returned. Expected errors: `400` invalid/missing consent or fields, `401` unauthenticated, `403` role/platform entitlement/account restriction, `404` pregnancy/profile not found, `409` pregnancy is not current or birth-confirmed.

## Historical baby access

`GET /api/user/me/babies`, `GET/PATCH/DELETE /api/user/me/babies/:babyId`, photo routes, and growth/progress routes now resolve baby IDs across the authenticated patient's full embedded pregnancy history, including completed pregnancies. A baby ID from another patient's profile still returns `404`. The list includes each baby’s `pregnancy_id` and `pregnancy_status`.

## Clinical and legal boundaries

- A birth confirmation is a patient-reported lifecycle event, not independent clinical verification.
- Child-data consent law and identity/guardian verification requirements vary by jurisdiction. The product still needs target-market privacy/legal review and an approved verification process.
- These routes retain the existing active platform-subscription middleware. Access to historical baby/health data after platform-subscription expiry remains a product-policy decision to review; this change does not bypass entitlement checks.
- No postnatal diagnosis, child-development diagnosis, growth percentile, or medical recommendation is calculated by these routes.
