# Render provider billing cron job

The billing worker is a one-shot process. Render Cron starts it every ten minutes, it
processes up to one queued Paystack webhook event and one due subscription renewal,
then exits. The small batch bounds Paystack requests and runtime per scheduled run;
backlogs are drained over subsequent runs.
It is separate from the GetTreat API web service; the API service and database remain
unchanged.

## Deployment configuration

The repository's `render.yaml` defines the service:

- **Name:** `gettreat-provider-billing`
- **Runtime:** Node
- **Build command:** `npm ci`
- **Command:** `npm run worker:provider-billing`
- **Schedule:** every ten minutes (UTC)
- **Plan:** Render's smallest cron compute plan, `0.5c-512mb`
- **Batch:** at most one webhook event and one renewal candidate per run

The user authorized up to **$2/month** for this cron service. Render currently lists
the smallest Cron plan at `$0.00016/minute`, with a `$1/month` minimum per Cron service.
At every ten minutes there are at most 4,464 scheduled runs in a 31-day month. If each
run averages 60 seconds, estimated service cost is about `$1.71/month` (`$1` minimum
plus `$0.71` runtime). At 75 seconds per run, the estimate is about `$1.89/month`.
Render does not provide a hard monthly compute-spend cap for Cron runtime, so this is
an operating estimate rather than a guaranteed billing ceiling. Check the service's
usage in Render billing and suspend the cron if it approaches `$2`.

To create it in Render, use **New + → Blueprint**, select this repository on `main`,
review the `gettreat-provider-billing` cron service, and provide the three secret values
when prompted. This creates a second Render service; it does not replace or modify the
existing API service. Never paste secret values into chat, code, or Git.

## Environment variables

Set these on the cron service (do not commit their values):

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` (already in `render.yaml`) |
| `MONGO_URI` | The same database URI used by the production GetTreat API service |
| `PAYSTACK_SECRET_KEY` | The Paystack **test** secret key while testing; use the live key only after an explicit production launch decision |
| `PAYMENT_TOKEN_ENCRYPTION_KEY` | The same stable encryption key configured for the API; 32 bytes encoded as 64 hex characters or Base64 |

The billing worker does not need JWT or Cloudinary credentials. `PROVIDER_BILLING_WORKER`
is set by the worker entry point before loading application configuration.

## First run and monitoring

After deployment, allow its first scheduled run to execute. A successful run logs a
line such as:

```text
Provider billing worker completed: 1 webhook events, 0 renewal attempts
```

Subsequent scheduled runs process future events and due renewals automatically. If a
webhook stays pending, inspect its `last_error` and the cron run logs. Render guarantees
that only one run of this cron service executes at a time.

The billing worker performs renewal charges as well as webhook processing. Keep
`PAYSTACK_SECRET_KEY` in test mode until the test payment, webhook, renewal and reversal
flows have been verified.
