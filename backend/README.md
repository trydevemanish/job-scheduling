# Job scheduling backend

This backend demonstrates a small asynchronous job system. It uses PostgreSQL as the source of truth, RabbitMQ to deliver work to a separate worker process, and a transactional outbox so a committed job is not lost if the API goes down before publishing its message.

## What counts as a job?

A job is a named unit of deferred work. The API accepts a `jobType` and a JSON `payload`; the worker maps each supported type to a handler. The included examples are:

| Type | Example payload | Demo behavior |
| --- | --- | --- |
| `send_order_confirmation_email` | `{"customerEmail":"demo@example.com","orderId":"A-1001"}` | Produces a demo result; does not send an email |
| `password_reset_email` | `{"userId":"user-42","email":"alice@example.com"}` | Produces a demo result; does not send an email |
| `generate_report` | `{"reportType":"daily-sales","date":"2026-10-16"}` | Produces demo report metadata |

Add a job type in `shared/job-types.ts` and implement its handler in `src/worker.ts`. A payload should contain only the data that handler needs; do not put secrets or large files in it.

## PostgreSQL schema

`src/db/schema.sql` creates:

- `jobs`: job input, status, priority, retry settings, timestamps, result/failure, and an optional unique idempotency key.
- `job_events`: append-only status/activity history.
- `job_outbox`: rows awaiting confirmed publication to RabbitMQ.

The schema uses UUIDs for job IDs, `JSONB` for flexible payload/result data, checks for status/priority, and indexes for common filters. `priority` ranges from 1 (highest) to 5 (lowest); the API maps this convention to RabbitMQ's inverse numeric priority. Sample rows make the listing endpoint useful immediately.

## Run locally

From this directory, copy `.env.example` to `.env`, then start the dependencies:

```sh
docker compose up -d
npm install
```

Initialize the database from PowerShell:

```powershell
Get-Content .\src\db\schema.sql | docker compose exec -T postgres psql -U app -d jobs_db
```

Or run the SQL file with `psql` installed locally:

```sh
psql "$POSTGRES_URL" -f src/db/schema.sql
```

Run the API and worker in separate terminals:

```sh
npm run dev
npm run worker
```

The demo handlers return simulated results; real email delivery/report generation should be implemented by replacing them with service-specific integrations.

## API

### Create a job

```sh
curl -X POST http://localhost:4000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{"name":"Confirm order A-1001","jobType":"send_order_confirmation_email","payload":{"customerEmail":"demo@example.com","orderId":"A-1001"},"priority":3,"maxRetries":3,"idempotencyKey":"order-confirmation-A-1001"}'
```

Repeating a request with the same `idempotencyKey` returns the existing job instead of creating another one. The equivalent JSON body is:

```json
{
  "name": "Confirm order A-1001",
  "jobType": "send_order_confirmation_email",
  "payload": { "customerEmail": "demo@example.com", "orderId": "A-1001" },
  "priority": 3,
  "maxRetries": 3,
  "idempotencyKey": "order-confirmation-A-1001"
}
```

### Other endpoints

- `GET /health` — checks PostgreSQL connectivity.
- `GET /api/jobs?page=1&limit=20&status=pending&jobType=generate_report&from=2026-10-01&to=2026-10-31` — filtered, paginated jobs; filters are optional.
- `GET /api/jobs/:id` — job details.
- `POST /api/jobs/:id/cancel` — cancels a pending or processing job; terminal jobs return `409`.
- `GET /api/metrics` — counts of completed, failed, and active jobs plus success/failure rates.

## Current limits

The included worker demonstrates status transitions, duplicate-delivery protection, retries, and a `jobs.dead` queue. Retry attempts are immediate in this starter implementation. The worker can re-claim a message redelivered by RabbitMQ after a crash; external side effects should also use provider-side idempotency keys because a database transaction cannot make an external API call exactly-once. Handlers are simulations; add an email/report provider, delayed backoff, and real integration tests before production use.
