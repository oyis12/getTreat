# 4N Commission, Provider Balance and Payout API

## Status and scope

This implementation adds owner-managed provider commission configuration, provider
service subscription commission snapshots, immutable provider/platform ledger entries,
masked Paystack payout methods, provider earnings and withdrawal requests, admin payout
review/transfer actions, audit timelines, and Paystack transfer webhook handling.

Paid appointment checkout is not implemented because the appointment domain/payment
records do not exist. Appointment payments must use the same ledger/commission helper
when that feature is built. GetTreat platform subscriptions stay in 4O. Ads and patient
wallet/deposit features are out of scope. No card details are stored.

All protected requests use:

```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

All responses use the standard `{ success, msg, data }` contract.

## Commission setting (super admin only)

| Method | Route | Access |
| --- | --- | --- |
| `GET` | `/api/super-admin/platform-financial-settings` | `super_admin` |
| `PATCH` | `/api/super-admin/platform-financial-settings` | `super_admin` |

Request:

```json
{ "platform_fee_percent": 15 }
```

The rate must be numeric, from 0 through 100, with at most two decimal places. The
default is 15%. A change applies to checkouts initialized after the setting change;
each provider-service payment attempt stores its rate and calculated amounts in kobo.
The change and its audit event are written in one database transaction.

## Provider payout methods

| Method | Route | Access |
| --- | --- | --- |
| `GET` | `/api/provider/me/payout-methods/banks` | `provider` |
| `POST` | `/api/provider/me/payout-methods/resolve` | `provider` |
| `GET` | `/api/provider/me/payout-methods` | `provider` |
| `POST` | `/api/provider/me/payout-methods` | `provider` |
| `PATCH` | `/api/provider/me/payout-methods/:methodId/default` | `provider` |
| `DELETE` | `/api/provider/me/payout-methods/:methodId` | `provider` |

`GET banks` returns Paystack's supported Nigerian bank names/codes. Resolve request:

```json
{ "bank_code": "058", "account_number": "0001234567" }
```

The resolve response contains the verified account name and bank code. After showing
that account name for confirmation, add the method:

```json
{
  "bank_code": "058",
  "account_number": "0001234567",
  "confirmed_account_name": "Jane Doe"
}
```

Paystack resolves the account again before creating a NUBAN transfer recipient. GetTreat
stores the Paystack recipient code, verified account name, bank code/name and last four
digits. It does not store or return the full account number. Providers can keep multiple
methods and one active default; removing a default selects the most recently added
remaining active method.

## Provider earnings and payout requests

| Method | Route | Access |
| --- | --- | --- |
| `GET` | `/api/provider/me/earnings` | `provider` |
| `GET` | `/api/provider/me/payouts?page=1&limit=20&status=all` | `provider` |
| `POST` | `/api/provider/me/payouts` | `provider` |
| `GET` | `/api/provider/me/payouts/:payoutId` | `provider`, owner only |

Payout creation requires an idempotency key:

```http
POST /api/provider/me/payouts
Authorization: Bearer <provider_access_token>
Idempotency-Key: payout-request-20261014-001
Content-Type: application/json
```

```json
{
  "amount": 25000,
  "payout_method_id": "<optional-owned-method-id>"
}
```

`amount` is NGN major units, with at most two decimal places; the server converts it to
integer kobo. If `payout_method_id` is omitted, the provider's default is used. A
database transaction checks/debits available balance, reserves the amount, creates the
payout request, and records the ledger/audit entries. A repeated key with the same body
returns the existing request; reuse with different values returns `409`.

The response includes the payout and updated balance. `available_minor` and
`reserved_minor` are kobo. A negative available balance represents recoverable provider
earnings after a refund/reversal of funds already paid out; future earnings offset it.

## Admin payout review and Paystack transfer

All admin payout endpoints require `manage_transactions`; super admins bypass this
permission as in other admin transaction routes.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/admin/payouts?page=1&limit=20&status=requested` | List payout requests |
| `GET` | `/api/admin/payouts/:payoutId` | Details and audit timeline |
| `POST` | `/api/admin/payouts/:payoutId/approve` | Start one Paystack transfer |
| `POST` | `/api/admin/payouts/:payoutId/reject` | Reject and release held balance |
| `POST` | `/api/admin/payouts/:payoutId/retry` | Retry after a conclusive failed/reversed transfer |
| `POST` | `/api/admin/payouts/:payoutId/finalize-transfer` | Submit Paystack OTP when required |
| `POST` | `/api/admin/payouts/:payoutId/reconcile-transfer` | Verify uncertain transfer by reference |

Approve/reject accept an optional audit reason:

```json
{ "reason": "Reviewed provider payout request" }
```

If Paystack returns `otp`, payout stays `otp_required`; submit:

```json
{ "otp": "123456" }
```

The OTP is sent directly to Paystack and is never persisted or logged. Paystack
transfers use integer kobo, the provider's private recipient code, `source: "balance"`,
and a unique server-generated reference. A successful initiation response does not by
itself mark the payout paid. Funds remain reserved while the transfer is pending. The
signed `transfer.success`, `transfer.failed`, and `transfer.reversed` events determine
the final state. Transfer webhooks are signature-checked, amount/currency/reference
matched, and processed idempotently. A final failure releases the hold; a retry uses a
new transfer reference after checking available balance.

## Payment transaction history additions

Existing provider/admin transaction list and detail endpoints now expose
`commission_rate_percent`, `platform_fee`, `platform_fee_minor`, `provider_net`, and
`provider_net_minor`. Patient transaction responses show the gross amount only because
the patient does not pay the provider commission. Detail responses include a safe
`audit_timeline` of status transitions without internal failure messages or secrets.

Successful provider-service payments post the provider net and platform commission
ledger entries in the same MongoDB transaction that activates the provider subscription.
Refund/reversal events reverse both ledger shares and revoke service access. The
provider's available balance may become negative if funds have already been paid out.

## Required database commands

Set `MONGO_URI` to the intended database first. Ensure there are no duplicate active
default payout methods before creating the unique index.

```cmd
set CREATE_PROVIDER_PAYOUT_INDEXES=true
npm run migrate:provider-payout-indexes
```

Before enabling payouts in an existing database, review historical successful provider
payments. The explicit backfill below applies the currently configured fee to successful
records without an earlier fee snapshot, then creates matching ledger/balance/audit
entries. It is idempotent and should be run once against the intended database:

```cmd
set APPLY_PROVIDER_EARNINGS_BACKFILL=true
npm run backfill:provider-earnings
```

Do not run either command until the target database and backfill rate are confirmed.
No database migration/backfill or live Paystack transfer was run during this code
change.

## Operational limitations

- Paystack transfers debit the GetTreat Paystack balance; the account must be funded.
- Bank account raw digits are passed to Paystack over HTTPS for verification/recipient
  creation, but are not stored by GetTreat.
- Provider service subscription payments are ledger-integrated. Appointment payment
  integration waits for the appointment domain.
- Platform subscription charging/access remains phase 4O.
- The existing 4M scheduled worker remains hosted-paused at the user's request. Transfer
  webhook events are processed inline after signature validation; failed database
  processing remains queued for worker retry.
- Unit tests use mocked Paystack requests and schema/policy checks. They do not prove a
  live MongoDB transaction or live Paystack payout.
