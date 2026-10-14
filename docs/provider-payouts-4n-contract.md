# 4N Provider Payout Contract

## Status

This file records the product contract that informed implementation. Provider payout,
bank-account and ledger endpoints are now implemented and mounted. For the current
route list, Postman examples, migration steps and limitations, see
[`financial-4n-api.md`](financial-4n-api.md).

The core contract remains: providers request withdrawals from available earnings;
admins with `manage_transactions` process them through Paystack; raw account digits and
transfer OTPs are not stored; payout and transfer changes are audited; signed transfer
webhooks settle funds idempotently. Appointment payments remain deferred until an
appointment payment domain exists, and platform subscription billing remains phase 4O.
