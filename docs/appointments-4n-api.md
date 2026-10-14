# 4N Provider Appointments and Payment API

## Product contract and scope

This slice implements digital appointments. A patient must have an active provider
service subscription for the selected provider. The provider publishes weekly hours,
date exceptions, duration and appointment fee. The appointment type comes from the
managed catalogue (`Consultation` and `Nutrition Plan` are seeded from the approved
screens). In-person appointments remain unavailable because the design labels them
“Coming soon”.

Checkout is paid first through Paystack. A verified payment changes the appointment
from `pending_payment` to `pending`; only the provider can then accept or decline it.
The platform commission percent is snapshotted when checkout starts. Provider and
platform shares are posted once to the 4N ledger after verified payment. A provider
decline or patient cancellation/reschedule requests a full Paystack refund. Rescheduling
means refunding the old appointment, then making and paying for a new booking. Refunds
remain `refund_pending` until Paystack confirms by webhook; appointment refund events
are handled inline by the signed webhook route, independently of the deferred renewal
worker. A failed refund API request restores the payment attempt to success and records
the failure for admin follow-up.

No card number or CVV is stored. The patient completes payment on Paystack Checkout.
Appointment payment attempts are separate from recurring provider-service payment
attempts but appear in the same patient/provider/admin transaction history. No reminder
scheduler is introduced here; the design's 24-hour reminder requires a later notification
worker.

## API conventions

Protected requests send:

```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

Every new checkout also requires:

```http
Idempotency-Key: appointment-<unique-attempt-token>
```

Use a new random key for a new intended booking. Reuse the same key only to safely retry
the identical checkout request. A key cannot be reused for another slot, provider, type,
reason or digital option. API responses follow `{ "success": true, "msg": "...", "data": ... }`.

## Discovery and schedule

| Method | Route | Access |
| --- | --- | --- |
| GET | `/api/appointments/types` | Public |
| GET | `/api/appointments/providers/:providerProfileId/availability` | Public, approved provider only |
| GET | `/api/provider/me/availability` | Authenticated approved provider |
| PUT | `/api/provider/me/availability` | Authenticated approved provider |

Set the provider's weekly availability and date exceptions:

```json
{
  "timezone": "Africa/Lagos",
  "duration_minutes": 30,
  "fee_amount": 1500,
  "weekly_schedule": [
    { "weekday": 1, "windows": [{ "start": "09:00", "end": "12:00" }, { "start": "14:00", "end": "17:00" }] },
    { "weekday": 3, "windows": [{ "start": "09:00", "end": "12:00" }] }
  ],
  "exceptions": [
    { "date": "2026-11-02", "unavailable": true, "windows": [] },
    { "date": "2026-11-09", "unavailable": false, "windows": [{ "start": "10:00", "end": "13:00" }] }
  ]
}
```

`weekday` uses 0 for Sunday through 6 for Saturday. All local times use the supplied
IANA timezone. Durations are 15, 30, 60 or 120 minutes. Appointment fees are positive
NGN amounts with at most two decimal places. Date exceptions replace the weekly hours
for that local calendar date. Windows must be non-overlapping and end after they start.
The selected slot must start on the provider's duration interval and fit inside a
published window. Availability responses expose fee, duration, timezone, schedule and
exceptions; they do not expose private provider or patient details.

## Patient booking, payment and history

| Method | Route | Access |
| --- | --- | --- |
| GET | `/api/user/me/appointments?page=1&limit=20&filter=all` | Patient |
| POST | `/api/user/me/appointments` | Patient + `Idempotency-Key` |
| POST | `/api/user/me/appointments/:appointmentId/verify-payment` | Owning patient |
| POST | `/api/user/me/appointments/:appointmentId/cancel` | Owning patient |

Supported `filter` values are `all`, `upcoming`, `recently_booked`, `completed` and
`missed`. Booking request:

```json
{
  "provider_profile_id": "<approved-provider-profile-id>",
  "appointment_type_id": "<active-appointment-type-id>",
  "starts_at": "2026-11-09T10:00:00.000Z",
  "digital_option": "video_call",
  "reason": "I would like to discuss my care plan."
}
```

`digital_option` is `video_call`, `audio_call` or `message`. `starts_at` is an ISO
date-time with timezone. The server derives end time, fee, currency, provider relationship,
commission and payment state. The client cannot supply any of those values. A successful
new checkout returns HTTP 201 and `data.appointment.payment.authorization_url` for the
Paystack redirect. Repeating the same key and body returns HTTP 200 with the existing
checkout. An active provider subscription and free slot are required; overlapping/past
slots, unapproved providers, inactive types and duplicate/conflicting requests fail.

After returning from Paystack, verify using:

```json
{ "reference": "<reference-from-checkout-response>" }
```

Paystack is queried server-side. A verified success returns
`data.payment_status: "success"` and appointment status `pending`. Pending/processing
payments remain pending; failed or abandoned payments release the slot. Never use a
frontend redirect result as payment proof.

Cancellation request:

```json
{ "reason": "patient_cancelled" }
```

For rescheduling, use `reason: "rescheduled"`, wait for/track the old appointment's
refund, and create a new checkout for the new slot. Accepted and pending paid
appointments receive a full refund request. The appointment remains `cancelled` or
`declined` while its separate payment attempt is `refund_pending`. The response returns
the Paystack refund reference where available; a signed `refund.processed` webhook
changes the payment attempt to `refunded` and reverses both ledger shares.
If Paystack reports `refund.failed`, the payment attempt becomes `refund_failed`; no
ledger reversal is posted because Paystack says the refund did not complete. Admin
follow-up is required for this exception.

## Provider appointment management

| Method | Route | Access |
| --- | --- | --- |
| GET | `/api/provider/me/appointments?page=1&limit=20&filter=all` | Owning approved provider |
| PATCH | `/api/provider/me/appointments/:appointmentId/decision` | Owning approved provider |

Decision request:

```json
{ "decision": "accept" }
```

or:

```json
{ "decision": "decline", "reason": "Unable to attend at the selected time." }
```

Only paid `pending` appointments can be decided. Acceptance sets status `accepted`.
Decline sets it to `declined` and immediately requests a full refund. The payment attempt
remains in refund-pending state until Paystack confirms; the appointment history retains
the declined status.

## Transaction history and commission

The existing patient, provider and admin transaction list/detail routes now include
appointment attempts. Filter `purpose=appointment` to see only appointment payments;
`purpose=all` includes appointment and provider-service transactions. Provider/admin
responses include `commission_rate_percent`, `platform_fee` and `provider_net`. Patient
responses omit provider earnings breakdowns. Ledger posting and reversal are
idempotency-keyed and audited.

## Status codes and Postman

- `200`: existing checkout retry, successful read/update/decision/payment verification.
- `201`: appointment checkout initialized.
- `400`: malformed IDs, body, query, timezone, schedule, or missing/invalid idempotency key.
- `401` / `403`: missing authentication, wrong role, unapproved provider, or no active provider subscription.
- `404`: appointment, provider, availability owner, or active appointment type not found.
- `409`: slot conflict, unavailable time, duplicate active booking, invalid state transition, or idempotency-key reuse.
- `422` / `502` / `503`: invalid stored fee, Paystack mismatch/upstream failure, or payments not configured.

Postman setup: define `API_BASE_URL`, `ACCESS_TOKEN`, `PROVIDER_PROFILE_ID`,
`APPOINTMENT_TYPE_ID`, `APPOINTMENT_ID`, `PAYSTACK_REFERENCE`, and a newly generated
`IDEMPOTENCY_KEY`. Add Bearer Auth and `Content-Type: application/json`; add
`Idempotency-Key: {{IDEMPOTENCY_KEY}}` only to `POST /api/user/me/appointments`.

## Catalogue seed and known follow-up

Run `npm run seed:appointment-types` once per environment. It inserts approved design
types only if they do not exist and will not overwrite later edits. Run
`CREATE_APPOINTMENT_INDEXES=true npm run migrate:appointment-indexes` against the intended MongoDB deployment before
serving production appointment requests; it creates provider slot uniqueness and
payment idempotency indexes and was not run against a database during this task. Admin
appointment moderation/management routes are not mounted until the authorized staff
permission for appointment screens is confirmed. Appointment payment/refund events are
processed inline by the signed webhook handler; the 24-hour reminder still requires
resuming the deferred billing/notification worker.
