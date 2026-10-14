# 4M Patient-to-Provider-Service Subscriptions API

4M is implemented and mounted and uses Paystack for hosted checkout. A subscription always belongs to
one provider offering (`ProviderService`); buying one service does not grant access to
every service from that provider. Platform subscriptions remain a separate domain.

## Configure Paystack

Add these environment variables to the backend deployment. Keep the secret key and
encryption key out of Git and out of the frontend:

```env
PAYSTACK_SECRET_KEY=sk_test_...
PAYSTACK_CALLBACK_URL=https://your-frontend.example/payment/callback
PAYMENT_TOKEN_ENCRYPTION_KEY=<32 random bytes encoded as 64 hex characters>
```

`PAYMENT_TOKEN_ENCRYPTION_KEY` is required when a patient opts into auto-renew. It
encrypts Paystack's reusable authorization token with AES-256-GCM. Do not rotate or
replace the key without first decrypting and re-encrypting stored authorizations.
The backend does not store card number, CVV, or expiry date. The Paystack webhook URL
to configure in the Paystack dashboard is:

```text
https://<your-api-host>/api/payments/paystack/webhook
```

The webhook validates `x-paystack-signature` against the raw request body using the
Paystack secret key, stores a minimal event record, and returns promptly. The worker
processes queued events and scheduled renewals. Configure a durable scheduler to run:

```sh
npm run worker:provider-billing
```

Run it every few minutes. It is safe to run on multiple instances: webhook events,
renewal attempts, and payment references use database uniqueness/claim rules. A payment
with an uncertain outcome is verified against Paystack before another charge is tried.

Production disables Mongoose automatic index creation. Before enabling checkout,
create the new model indexes with the explicit migration command after pointing
`MONGO_URI` at the intended non-production database and setting the guard:

```sh
CREATE_PROVIDER_BILLING_INDEXES=true npm run migrate:provider-billing-indexes
```

Review the output and indexes in MongoDB before deploying the same migration to
production. This command creates indexes; it does not alter subscription documents.
The unique patient/service index covers both `pending_payment` and `active`, so
simultaneous checkouts cannot create two payable subscriptions for the same offering.
If the database already contains duplicate pending or active records, index creation
will fail safely; inspect and reconcile those records before rerunning the migration.

## 1. Start checkout for one provider service

```http
POST {{base_url}}/api/user/me/provider-subscriptions
Authorization: Bearer {{patient_access_token}}
Idempotency-Key: {{unique_purchase_attempt_key}}
Content-Type: application/json
```

The idempotency key must contain 8–128 letters, digits, dots, underscores, colons, or
hyphens. Reuse the same key when retrying the same request after a network error.

```json
{
  "provider_service_id": "<provider-service-id>",
  "auto_renew": false
}
```

`auto_renew` is optional and defaults to `false`. Setting it to `true` is explicit
consent for recurring charges. Paystack checkout is then restricted to card so the
successful transaction can return a reusable authorization. The patient can later
disable auto-renew while retaining access through the paid-through date.

The backend validates the patient and provider accounts and reads the price, discount,
NGN currency and billing cadence from the active provider service. It snapshots those
values, converts the final NGN price to integer kobo, creates a pending payment attempt,
and initializes Paystack checkout.

Example response:

```json
{
  "success": true,
  "msg": "Provider service checkout initialized successfully",
  "data": {
    "id": "<subscription-id>",
    "provider_service_id": "<provider-service-id>",
    "provider_profile_id": "<provider-profile-id>",
    "patient_profile_id": "<patient-profile-id>",
    "service": {
      "title": "Pregnancy care subscription",
      "original_price": 1500,
      "discount_percent": 10,
      "discounted_price": 1350,
      "currency": "NGN",
      "billing_cycle": "monthly"
    },
    "status": "pending_payment",
    "auto_renew": false,
    "payment": {
      "reference": "<server-generated-paystack-reference>",
      "status": "pending",
      "authorization_url": "https://checkout.paystack.com/<checkout-token>",
      "access_code": "<paystack-access-code>"
    }
  }
}
```

Redirect the patient to `data.payment.authorization_url`. Do not activate access from
the redirect or a client-reported status. A repeated request with the same idempotency
key returns the existing attempt. An unfinished checkout for the same patient/service
is reused instead of opening a second charge attempt.

## 2. Verify payment after the checkout return

The frontend receives the Paystack reference at its callback. Send it to the backend;
the backend checks that the reference belongs to the authenticated patient and the
given subscription, then verifies it directly with Paystack:

```http
POST {{base_url}}/api/user/me/provider-subscriptions/<subscription-id>/verify-payment
Authorization: Bearer {{patient_access_token}}
Content-Type: application/json
```

```json
{ "reference": "<server-generated-paystack-reference>" }
```

Only verified success with the expected reference, metadata, amount, NGN currency and
billing email activates the subscription. Pending, failed and abandoned payments grant
no access. Confirmed reversals revoke access. Calling this endpoint repeatedly is safe.

## 3. List and read the patient's subscriptions

```http
GET {{base_url}}/api/user/me/provider-subscriptions?page=1&limit=20&status=all
Authorization: Bearer {{patient_access_token}}
```

`status` accepts `all`, `pending_payment`, `active`, `expired`, `revoked`, and
`payment_failed`. Page size is 1–100.

```http
GET {{base_url}}/api/user/me/provider-subscriptions/<subscription-id>
Authorization: Bearer {{patient_access_token}}
```

Both routes are scoped to the authenticated patient's profile. Supplying another
patient's subscription ID returns not found.

## 4. Change auto-renew

```http
PATCH {{base_url}}/api/user/me/provider-subscriptions/<subscription-id>/auto-renew
Authorization: Bearer {{patient_access_token}}
Content-Type: application/json
```

```json
{ "enabled": false }
```

Disabling stops future attempts and preserves current access through `ends_at`. A
renewal request already submitted to Paystack may still complete and cannot be
cancelled in flight. To
enable renewal, the patient must have completed a Paystack checkout that supplied a
reusable authorization. The authorization token is encrypted at rest and is never
returned to the frontend. If no reusable authorization exists, the API returns `409`.

## 5. Auto-renew schedule and payment reversals

Renewal is attempted at the paid-through date, then on day 3 and day 6. The grace
period ends on day 7. Patients retain service access through the grace period. A
verified renewal extends the existing service subscription from its previous
paid-through date, keeping its provider, patient, service and pricing relationship.
After the final unsuccessful attempt, access ends when grace expires.

If a renewal request times out or Paystack has not exposed its result yet, the worker
keeps the same payment reference and checks Paystack again; it does not count an
inconclusive `404` verification response as a failed charge or launch another charge.
This avoids charging twice when Paystack processed a request but its response was
lost. Such an unresolved attempt can require support/reconciliation and will not be
retried automatically while its outcome remains uncertain. Webhook `charge.success` events are
verified and fulfilled idempotently. Confirmed `refund.processed` and
`charge.dispute.create` events revoke that service subscription. Historical patient
instructions remain readable under the existing 4K policy.

Paystack returns `200 OK` after a verified webhook event is durably queued. Ensure
`npm run worker:provider-billing` is scheduled; otherwise queued webhooks and renewal
attempts will not be processed. A public webhook cannot be reached at localhost; use a
reachable test deployment or a webhook forwarding tool for integration tests.

## Current scope and limits

- Provider service subscriptions and their payment attempts are separate from the
  platform subscription in `System`.
- Patient/admin/provider transaction history, refunds administration, and transaction
  screens remain phase 4N work.
- Patient cancellation is currently “turn off auto-renew”; no separate refund or
  prorated cancellation endpoint is exposed.
- Test the checkout and webhook only with Paystack test keys and a dedicated
  non-production MongoDB database. Do not import active fixtures or run billing tests
  against production data.
