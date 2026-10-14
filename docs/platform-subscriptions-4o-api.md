# 4O GetTreat Platform Subscription API

## Scope and rules

This is the patient's subscription to GetTreat itself. It is separate from provider
service subscriptions and does not create provider earnings or platform commission.
The plan amount is copied into the subscription and payment attempt at checkout, so a
later pricing change affects future purchases only. Initial checkout is hosted by
Paystack; GetTreat stores no card number, CVV, or expiry. When auto-renew is requested,
the checkout asks Paystack for a reusable authorization; if Paystack does not return a
reusable authorization, the subscription remains active but auto-renew is disabled.

Default editable NGN prices are ₦555 monthly, ₦1,500 quarterly and ₦5,500 yearly. These
are placeholders chosen for development and can be changed by a super admin. Patients
without an active subscription (or inside the approved seven-day renewal grace period)
cannot use subscription-gated patient features. Auth, `/api/user/me`, platform billing,
and transaction history remain available so a patient can manage or renew access.
Provider, admin and super-admin routes are not gated by the patient subscription.

The existing billing worker handles queued webhook reconciliation and optional renewal
charges. Its hosting remains paused; one-off checkout, direct verification, and the
signed webhook's inline platform payment handling do not require the worker.

## Patient routes

All requests require `Authorization: Bearer <patient_access_token>` and JSON requests
use `Content-Type: application/json`.

### Get subscription status and history

```http
GET /api/user/me/platform-subscription
```

Returns `200` with `data.current` (active subscription or `null`) and the most recent
20 records in `data.items`. It does not reveal authorization tokens, email, or internal
Mongo fields.

### Start Paystack checkout

Use a unique random key for each intended purchase. Reuse that same key only when
retrying the same request after a timeout.

```http
POST /api/user/me/platform-subscription
Authorization: Bearer <patient_access_token>
Content-Type: application/json
Idempotency-Key: platform-purchase-<random-unique-token>

{
  "billing_cycle": "monthly",
  "auto_renew": false
}
```

`billing_cycle` is `monthly`, `quarterly`, or `yearly`; `auto_renew` is optional and
defaults to `false`. Response is `201` for a new checkout or `200` when the identical
idempotency key is reused. The response contains `data.payment.authorization_url`;
open that hosted Paystack URL for the patient. A pending or failed payment grants no
access. A second pending or active purchase returns `409`.

### Verify a payment after checkout

```http
POST /api/user/me/platform-subscription/<SUBSCRIPTION_ID>/verify-payment
Authorization: Bearer <patient_access_token>
Content-Type: application/json

{ "reference": "SERVER_GENERATED_PAYSTACK_REFERENCE" }
```

Returns `200` and `data.payment_status` (`success`, `pending`, `failed`, `reversed`, or
`refunded`). The reference must belong to this patient's subscription. The backend
queries Paystack and checks reference, amount, currency, customer email and metadata;
never treat the browser redirect as proof of payment.

### Enable or disable auto-renew

```http
PATCH /api/user/me/platform-subscription/<SUBSCRIPTION_ID>/auto-renew
Authorization: Bearer <patient_access_token>
Content-Type: application/json

{ "enabled": false }
```

Returns `200`. Enabling requires a reusable authorization previously captured after an
explicit auto-renew checkout; otherwise returns `409`. Disabling does not shorten the
paid period. Paystack authorization data is encrypted at rest and can be revoked by the
patient's auto-renew choice; card details are never saved.

## Super-admin plan configuration

The super admin must provide `Authorization: Bearer <super_admin_access_token>`.
`GET /api/system/subscriptions` is public and returns current enabled state and plans.
It also retains the legacy monthly `billing_cycle` and `amount` fields for existing clients.

```http
PATCH /api/super-admin/platform-subscription-settings
Authorization: Bearer <super_admin_access_token>
Content-Type: application/json

{
  "enabled": true,
  "plans": [
    { "billing_cycle": "monthly", "amount": 555, "active": true },
    { "billing_cycle": "quarterly", "amount": 1500, "active": true },
    { "billing_cycle": "yearly", "amount": 5500, "active": true }
  ]
}
```

All three unique plans are required; prices are NGN naira amounts from ₦1 to ₦100M.
Returns `200`. Each update is audit logged. Invalid or unknown fields return `400`.

## Webhook, transactions and errors

Use the existing endpoint configured in Paystack:

```http
POST /api/payments/paystack/webhook
x-paystack-signature: <Paystack HMAC-SHA512 signature>
Content-Type: application/json
```

The webhook is durably deduplicated by the existing Paystack event store. A signed
`charge.success` is independently verified before access is granted. Confirmed refunds
and disputes revoke the platform subscription. Invalid signatures return `401`.

Platform payment attempts appear in patient and admin transaction history as
`purpose=platform_subscription`; they do not appear in provider history. The patient
can use `/api/user/me/transactions?purpose=platform_subscription` while expired.
Typical responses: `401` missing/invalid authentication, `403` feature access requires
an active subscription, `404` missing owned subscription/reference or unavailable plan,
`409` duplicate active/pending purchase or unavailable reusable authorization, `422`
invalid Paystack amount, `503` billing disabled/unconfigured, `502` Paystack/network
failure. All responses use the existing `{success,msg,data}` API envelope.

## Index migration

Before production checkout, review the target database and then run:

```powershell
$env:CREATE_PLATFORM_SUBSCRIPTION_INDEXES="true"
npm run migrate:platform-subscription-indexes
```

This migration is intentionally not run automatically against a configured database.
The regular seed inserts the default plans and only fills plans on an existing legacy
singleton when that plans array is absent; it preserves configured plan values.
