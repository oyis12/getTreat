# 4N Provider Bank Accounts and Payouts Contract

## Status

Product direction and Paystack integration flow mapped on 2026-10-14. **No payout,
bank-account, balance, ledger, or transfer endpoints are implemented yet.** This is a
contract for the next implementation slice, not a description of currently mounted
routes.

## Product and actor rules

- Provider service subscription earnings and paid provider appointment earnings are
  collected through GetTreat. Platform subscription payments are separate (4O).
- The owner-configurable platform commission is currently 15%, deducted from successful
  provider earnings; it is never added to the patient's charge. The commission rate is
  snapshotted when checkout is initialized.
- Providers request withdrawal of their available balance. An admin with
  `manage_transactions` reviews and processes it. Super admins retain their existing
  permission bypass.
- Payment lifecycle changes and sensitive actions must create audit records. This
  includes bank-recipient changes, payout request/review/transfer actions, and payment,
  refund, reversal, transfer pending/success/failure/reversal changes.
- No ads transaction domain is in scope. GetTreat platform subscription billing stays
  in phase 4O.

## Paystack bank-account setup

Use Paystack as the source of bank lists and account verification:

1. Fetch Nigerian banks using `GET /bank?country=nigeria&currency=NGN` and present
   supported bank names/codes.
2. The provider submits bank code and account number over HTTPS to a protected GetTreat
   endpoint. Do not log the body or persist the raw account number.
3. Resolve the account with Paystack `GET /bank/resolve?account_number=...&bank_code=...`.
   Return the resolved account name for provider confirmation before creating a
   recipient.
4. Create a Paystack transfer recipient with type `nuban`, the resolved account name,
   account number, bank code and `NGN` currency.
5. Persist the Paystack `recipient_code`, bank code/name, resolved account name, and
   last four account digits. Do not persist the full bank account number locally.
   Support multiple saved recipients as shown by the provider settings screen, with at
   most one selected default payout method per provider.

Suggested authenticated provider operations (not yet mounted):

```text
GET    /api/provider/me/payout-methods
POST   /api/provider/me/payout-methods
PATCH  /api/provider/me/payout-methods/:methodId/default
DELETE /api/provider/me/payout-methods/:methodId
```

Example body for `PUT`:

```json
{
  "bank_code": "058",
  "account_number": "0001234567"
}
```

Never return the submitted account number. Return the masked last four digits and
verified bank/account name. The transfer recipient code and account details are
private server-side data and must not be exposed in ordinary API responses.

## Provider earnings ledger and withdrawal lifecycle

Use an immutable ledger rather than trusting a mutable cached balance:

- On each successful provider-service or appointment charge, atomically record gross
  payment, commission percentage snapshot, commission amount, and provider net amount.
- Derive available balance from posted provider credits minus payout reservations and
  completed payouts. Keep amounts as integer NGN kobo.
- At withdrawal request, validate a positive amount within available balance and place
  an idempotent hold so concurrent requests cannot overspend. Record an auditable
  `requested` payout state.
- Admin may approve or reject the request. Rejection releases the hold. Approval
  initiates one Paystack transfer using the stored recipient code, NGN amount in kobo,
  and a unique server-generated transfer reference.
- Keep the hold while Paystack reports a non-final state such as `pending`, `otp`, or
  `received`. Mark `success` and post the payout debit only after a verified
  `transfer.success` webhook (or trusted server-side verification). On final
  `failed`, `reversed`, `abandoned`, or `rejected`, release the hold and allow an
  audited retry with a new reference. Never create a second active transfer for the
  same payout request.
- If a payment is refunded or reversed, reverse both provider and platform ledger
  shares. If the provider has already withdrawn that amount, record a recoverable
  negative provider balance and offset it against future provider earnings; do not
  silently overdraw a different provider or the platform ledger.
- Paystack transfers debit the GetTreat Paystack balance, so the admin interface must
  show transfer state and operational failures without claiming that a payout is
  complete merely because initiation returned successfully.

Suggested provider routes (not yet mounted):

```text
GET  /api/provider/me/earnings
GET  /api/provider/me/payouts
POST /api/provider/me/payouts
GET  /api/provider/me/payouts/:payoutId
```

Example request:

```http
POST /api/provider/me/payouts
Authorization: Bearer <provider_access_token>
Idempotency-Key: <unique-payout-request-key>
Content-Type: application/json
```

```json
{ "amount": 25000 }
```

`amount` is NGN major units in the public contract; the server validates precision and
converts it to integer kobo. An optional `payout_method_id` selects one of the
provider's own saved recipients; if omitted, the default is used. A missing or
unavailable method prevents request creation. The payout response must distinguish `requested`,
`approved`, `processing`, `otp_required`, `paid`, `rejected`, `failed`, and `reversed`
states as applicable. It must include the available/pending amounts and masked payout
destination, but no recipient code, OTP, or bank account number.

Suggested admin operations (not yet mounted):

```text
GET  /api/admin/payouts
GET  /api/admin/payouts/:payoutId
POST /api/admin/payouts/:payoutId/approve
POST /api/admin/payouts/:payoutId/reject
POST /api/admin/payouts/:payoutId/retry
POST /api/admin/payouts/:payoutId/finalize-transfer
```

Admin review and transfer initiation require `manage_transactions`; every decision
records actor, payout, prior/new state, timestamp, transfer reference, and a bounded
reason where supplied. Never write Paystack OTPs, secrets, or full bank account numbers
to logs or audit documents. If Paystack responds that OTP approval is required, keep
the transfer in `otp_required`; accept the OTP only for immediate Paystack finalization
and do not persist it.

## Paystack transfer integration and webhook handling

The current integration only initializes and verifies checkout payments. The payout
implementation needs separate transfer methods; do not reuse checkout helpers with
different semantics.

Paystack transfer flow:

```text
GET  /bank?country=nigeria&currency=NGN
GET  /bank/resolve?account_number={number}&bank_code={code}
POST /transferrecipient
POST /transfer
POST /transfer/finalize_transfer   (only when Paystack requires OTP)
```

For `POST /transfer`, use `source: "balance"`, integer kobo, the saved
`recipient_code`, and the persisted unique reference. Verify the signed raw-body
webhook and process `transfer.success`, `transfer.failed`, and `transfer.reversed`
idempotently. Pending transfers are not success. Reconcile an uncertain transfer by
the same reference before attempting another transfer; only retry after a conclusive
failure/reversal and use a new attempt/reference linked to the same payout request.

The existing Paystack webhook URL can receive these events, but current webhook code
only recognizes provider subscription charge/refund/dispute events. Extend its event
dispatcher with separate transfer handling and idempotent event records; never route a
transfer event into subscription entitlement logic.

## Audit and verification expectations

Use immutable audit events with actor, action, resource type/id, timestamp, request or
gateway correlation/reference, prior/new status, and safe metadata. Do not duplicate
medical payloads or secrets into audit records. Record each state transition once,
even when Paystack retries a webhook. Test duplicate requests/events, unauthorized
roles/permissions, insufficient balance, concurrent requests, OTP required/invalid,
pending transfer, successful transfer, failed/reversed transfer, retries, and refund
after the provider has withdrawn.

## Official Paystack references

- [Create and manage transfer recipients](https://paystack.com/docs/transfers/creating-transfer-recipients/)
- [Resolve bank account numbers](https://paystack.com/docs/identity-verification/verify-account-number/)
- [Single transfers and transfer webhooks](https://paystack.com/docs/transfers/single-transfers/)
- [Transfer approval and status lifecycle](https://paystack.com/docs/transfers/how-transfers-work/)
- [Transfer API and OTP finalization](https://paystack.com/docs/api/transfer/)

