# 4N Transactions API

## Scope and design mapping

The 4N transaction slice exposes history/details for provider-service subscription
attempts in `ProviderPaymentAttempt` and appointment attempts in
`AppointmentPaymentAttempt`, plus commission snapshots, ledger posting/reversals,
provider earnings and Paystack payout processing. It covers
the transaction history/detail views for patients, providers, and admins using the
screens in:

- `designs/patients_dashboard/Transactions/Patients Transactions History.png`
- `designs/patients_dashboard/Transactions/Patients transactions details.png`
- `designs/patients_dashboard/Transactions/Transaction history.png`
- `designs/patients_dashboard/Transactions/Transaction details.png`
- `designs/providers ui/transactions/7.0 Provider's Transaction.png`
- `designs/providers ui/transactions/7.1 Provider's Transaction History.png`
- `designs/providers ui/transactions/7.2 Provider's Transaction details.png`
- `designs/admin/patients/Control Admin- Transactions.png`
- `designs/admin/patients/Control Admin- Transaction details.png`
- `designs/super admin/patients/Admin- patients(Transactions).png`
- `designs/super admin/patients/Admin- patients(Transaction details).png`
- `designs/super admin/providers/Admin- view provider (Transaction).png`

The two transaction records keep their separate business lifecycles and appear together
in transaction history. Their provider, patient and subscription/appointment references
supply the relevant actor context. The authenticated patient sees their own attempts, a
provider sees attempts tied to their own provider profile, and an admin with
`manage_transactions` or a super admin sees platform-wide attempts.

The transaction history endpoints remain read-only. Verified payment/webhook handling
posts commission and provider earnings to the ledger; confirmed refunds/reversals reverse
both ledger shares. Appointment booking is documented in
[`appointments-4n-api.md`](appointments-4n-api.md). Payout operations are documented in
[`financial-4n-api.md`](financial-4n-api.md). Platform-subscription records (phase 4O),
platform-subscription records (phase 4O), receipts, and summary analytics are not implemented here.
Ads are not part of the product scope.

## Routes

All routes are read-only and require `Authorization: Bearer <access_token>`.

| Method | Route | Actor and access |
| --- | --- | --- |
| `GET` | `/api/user/me/transactions` | Patient's own provider-service and appointment payment attempts |
| `GET` | `/api/user/me/transactions/:transactionId` | One attempt owned by the patient |
| `GET` | `/api/provider/me/transactions` | Provider's own service subscription and appointment payment attempts |
| `GET` | `/api/provider/me/transactions/:transactionId` | One attempt tied to the provider's profile |
| `GET` | `/api/admin/transactions` | Admin with `manage_transactions`; super admin allowed |
| `GET` | `/api/admin/transactions/:transactionId` | Same admin authorization |

No request body or additional headers are required. The admin endpoints are protected
by `requireAdminPermission("manage_transactions")`; super admins bypass admin scopes.

## List query parameters

```text
?page=1&limit=20&status=all&purpose=all&sort=newest&search=
```

- `page`: positive integer, default `1`.
- `limit`: integer `1..100`, default `20`.
- `status`: `all`, `initializing`, `pending`, `success`, `failed`, `refund_pending`, `refund_failed`, `reversed`, or `refunded`; default `all`.
- `purpose`: `all`, `initial`, `renewal`, or `appointment`; default `all`.
- `sort`: `newest`, `oldest`, `highest`, or `lowest`; default `newest`.
- `search`: optional text up to 100 characters; searches the provider transaction reference and Paystack transaction ID.

Example:

```http
GET /api/user/me/transactions?page=1&limit=20&status=success&purpose=initial&sort=newest
Authorization: Bearer <patient_access_token>
```

## Response

The list uses the standard paginated response envelope. Fields are audience-scoped:
patients receive the provider, providers receive the patient, and admins receive both.
Email addresses, billing email, idempotency keys, Paystack access codes, authorization
data, and internal failure messages are never returned.

```json
{
  "success": true,
  "msg": "Transactions retrieved successfully",
  "data": {
    "items": [
      {
        "id": "<payment-attempt-id>",
        "transaction_reference": "gt4m<reference>",
        "status": "success",
        "purpose": "initial",
        "amount_minor": 135000,
        "amount": 1350,
        "currency": "NGN",
        "created_at": "2026-10-14T06:03:16.839Z",
        "verified_at": "2026-10-14T06:08:49.287Z",
        "provider_service": {
          "id": "<provider-service-id>",
          "title": "Pregnancy care subscription",
          "billing_cycle": "monthly"
        },
        "provider_subscription_id": "<provider-subscription-id>",
        "provider": { "id": "<provider-profile-id>", "fullname": "Alex Henderson" }
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 1, "pages": 1 }
  }
}
```

The provider-scoped representation uses the same transaction fields and includes
`patient: { id, fullname }` instead of `provider`. Admin results include both actor
objects. `amount_minor` is the persisted integer amount in kobo; `amount` is its NGN
display value. Transaction `status` is payment-attempt state, not provider-subscription
entitlement state.

Detail request:

```http
GET /api/user/me/transactions/<payment-attempt-id>
Authorization: Bearer <patient_access_token>
```

The detail response is `{ "success": true, "msg": "Transaction retrieved successfully", "data": <same transaction object> }`.
An unknown or out-of-scope transaction returns `404`. Invalid IDs, filters, or pagination
return `400`; missing authentication returns `401`; forbidden roles or admin permission
failures return `403`.

Example not-found response:

```json
{
  "success": false,
  "msg": "Transaction not found",
  "data": null
}
```

## Validation and operational behavior

- The list endpoint accepts only the documented query parameters and bounded pagination.
- `transactionId` must be a valid MongoDB ObjectId.
- Reads are scoped by the authenticated actor's resolved profile; client-supplied profile/user IDs are not accepted.
- No notification, upload, payment gateway request, database write, or status side effect occurs.
- Records are ordered by creation date or persisted amount; pagination is applied in MongoDB.
- Payment-method display, fee breakdown, timeline events, receipt generation, and refund actions are unavailable until their underlying data and requirements are approved.

## Current gaps for later 4N work

## Confirmed next-stage financial requirements (2026-10-14)

The user has confirmed the following requirements for the next 4N slices:

- Provider-service subscription charges and the patient's GetTreat platform
  subscription are separate payment domains. Platform subscription remains phase 4O.
- No ads transaction type or ads billing workflow is in scope, even if an export
  contains a mock row labelled “Getreat ads”.
- Paystack remains the payment gateway. GetTreat must not store patient card details.
- The owner must be able to configure the platform commission percentage in the
  singleton `System` configuration. The current displayed/configured target is 15%.
- Commission is deducted from provider earnings, not added to the patient's charge.
  For provider-service subscription payments it is accounted for only after a payment
  succeeds. The provider's resulting share accrues to a provider balance.
- The same commission applies to successful paid provider appointments.
- A transaction snapshots the configured commission percentage when checkout is
  initialized, so changing the system setting does not alter an in-progress purchase.
- A confirmed refund or reversal reverses both the provider share and platform fee in
  the ledger. If the provider share has already been paid out, the resulting negative
  provider balance is recorded as recoverable and offsets future earnings.
- Providers request withdrawals; an admin reviews/processes the request to the
  provider's bank through Paystack. Do not treat a displayed balance as a mutable
  number without auditable ledger entries.
- Payment/transaction state changes (including pending, success and failure) and
  sensitive actor actions require audit trails.
- Appointment booking is intended to be paid through GetTreat and appear in
  transaction history. Appointment APIs/payment records do not exist yet; map that
  workflow before adding appointment charge endpoints.

The commission, earnings ledger, bank setup and payout routes are implemented as
documented in [`financial-4n-api.md`](financial-4n-api.md). Appointment earnings and
platform-subscription transactions still require their respective domains.
