# 4M Provider-Service Subscription and Paystack Contract

Status: **implemented and mounted**
Last mapped: 2026-10-14

## Feature mapping

- **Domain:** patient purchase of one provider-owned service, access period, and optional recurring renewal.
- **Actor:** authenticated patient. Paystack calls the webhook as an external payment provider.
- **Design references:**
  - `designs/patients_dashboard/Providers/Patients providers details(About).png` — provider detail and Subscribe action.
  - `designs/patients_dashboard/Providers/Patients porviders details(Subscribed).png` — subscribed provider state.
  - `designs/patients_dashboard/Transactions/Patients Transactions History.png` and `Patients transactions details.png` — patient transaction history/detail.
- **Existing entities:** `User`, `PatientProfile`, `ProviderProfile`, and provider-owned `ProviderService`.
- **New business records required:** a provider-service subscription, payment attempt/transaction, and Paystack reusable authorization reference when the patient opts into auto-renew.
- **Relationship:** each subscription references one `ProviderService`, one `ProviderProfile`, and one `PatientProfile`. The provider and patient references are resolved by the server. A subscription grants entitlement only to that service relationship; it never covers every offering from the same provider.
- **Authentication/authorization:** patient bearer token for patient endpoints; resolve the patient profile from the authenticated user. Check provider/service eligibility and subscription ownership on every request. Webhook authentication is Paystack HMAC-SHA512 signature validation over the raw request body.
- **Inputs:** client sends the provider service ID and optional auto-renew consent. Client never supplies identity/profile IDs, price, discount, currency, period dates, payment result, or entitlement status.
- **Trusted price and side effects:** server reads the active service price and billing cycle, snapshots them on the purchase, converts NGN to integer kobo, records a pending payment attempt, initializes Paystack-hosted checkout, and returns its redirect URL. Payment confirmation activates the subscription only after server verification.
- **Notifications/uploads:** no upload is involved. Payment and renewal notifications are not specified in the mapped screens and need their own notification requirements.
- **Failure/edge cases:** idempotent purchase initialization; duplicate webhooks; wrong amount/currency/email/reference; inactive service or unapproved/inactive provider; abandoned, pending, failed, reversed, refunded or charged-back payments; duplicate active periods; failed renewal; Paystack timeouts; and auto-renew toggles without a reusable authorization.
- **Admin workflow:** provider approval already gates provider service discovery/management. Transaction review, refund tooling, chargeback review and subscription intervention belong to later admin/transaction workflows and must be mapped before implementation.

## Patient endpoints

All are mounted:

```http
POST  /api/user/me/provider-subscriptions
GET   /api/user/me/provider-subscriptions?page=1&limit=20&status=active
GET   /api/user/me/provider-subscriptions/:subscriptionId
PATCH /api/user/me/provider-subscriptions/:subscriptionId/auto-renew
POST  /api/user/me/provider-subscriptions/:subscriptionId/verify-payment
POST  /api/payments/paystack/webhook
```

Start checkout:

```http
POST /api/user/me/provider-subscriptions
Authorization: Bearer <patient_access_token>
Idempotency-Key: <unique purchase attempt key>
Content-Type: application/json
```

```json
{
  "provider_service_id": "<provider-service-id>",
  "auto_renew": false
}
```

The response is a pending subscription plus Paystack checkout URL and a server-generated payment reference. No access is granted yet. The browser redirect is not payment proof.

Disable renewal:

```http
PATCH /api/user/me/provider-subscriptions/<subscription-id>/auto-renew
Authorization: Bearer <patient_access_token>
Content-Type: application/json
```

```json
{ "enabled": false }
```

Disabling renewal keeps existing paid access through `ends_at`. Enabling requires explicit patient consent and a valid reusable authorization. If no authorization exists, the API must require the approved authorization collection flow.

Verify after checkout redirect:

```http
POST /api/user/me/provider-subscriptions/<subscription-id>/verify-payment
Authorization: Bearer <patient_access_token>
Content-Type: application/json
```

```json
{ "reference": "<server-generated-reference>" }
```

The reference must belong to this patient and subscription. The backend verifies it against Paystack and checks the expected reference, success status, amount, currency, customer email, and purchase metadata. A pending, failed, abandoned, or reversed payment does not grant access.

## Paystack and payment safety

- Use Paystack's backend transaction initialize endpoint and redirect the patient to the returned hosted checkout URL. Never expose the secret key in the client.
- Confirm payment with Paystack's transaction verify endpoint and process signed webhook events. Both paths must be idempotent and converge on one fulfillment operation.
- Require an idempotency key for purchase initialization and unique server-generated transaction references. Enforce unique event/reference processing in the database so retries cannot create a second charge or grant a second period.
- Webhook route must receive the raw payload bytes and compare the `x-paystack-signature` HMAC-SHA512 value using a timing-safe comparison.
- Paystack amounts are integer subunits: NGN amounts are converted to kobo by the backend using the snapshotted price.
- Store no card number, CVV, expiration date, or raw card data. For auto-renew, Paystack returns a reusable authorization token after the customer completes an eligible checkout. Encrypt that token at rest, restrict reads, and never include it in API responses or logs. Retain the authorization email needed by Paystack so an email change on GetTreat does not silently break renewal.
- Do not activate or extend access from a checkout redirect, frontend status, or an unverified provider response.
- A failed attempt creates no entitlement and does not need a refund. Confirmed reversal/refund/chargeback revokes access immediately, as confirmed by the product owner.
- Recurring charges need a durable scheduled worker, not an in-memory timer tied to one Express process. Each scheduled renewal needs its own unique reference and must extend access only after verification.
- Concurrent checkout starts for the same patient/service are blocked by a unique pending/active subscription index. If a recurring charge outcome is uncertain, keep the attempt pending and reconcile the same reference instead of retrying a second charge.
- Auto-renew defaults off. When enabled, attempt the charge on the due date and retry on days 3 and 6. Preserve access through the 7-day grace period, then expire if all attempts fail.

## Confirmed policy choices

1. Auto-renew opt-in is available during the first checkout; a patient may also enable it later when a valid reusable authorization is already stored.
2. A confirmed payment reversal, refund, or chargeback revokes the service subscription immediately.
3. Renewal has three total attempts: at the due date, day 3, and day 6. Access continues until the end of day 7.
4. Turning auto-renew off preserves access through the paid-through date. Separate refund/proration workflows remain part of the later transaction/admin domain.

## Paystack references

- [Transaction API: initialize, verify and charge authorization](https://paystack.com/docs/api/transaction/)
- [Recurring charges and reusable authorization](https://paystack.com/docs/payments/recurring-charges/)
- [Payment verification](https://paystack.com/docs/payments/verify-payments/)
- [Webhook signature verification](https://paystack.com/docs/payments/webhooks/)

The mounted 4M routes are recorded under the `4M Patient-to-Provider-Service Subscriptions and Paystack` group in `getTreat-api.json`. Postman setup examples are in `provider-subscriptions-4m-api.md`.
