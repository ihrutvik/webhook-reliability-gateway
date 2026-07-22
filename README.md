# Webhook Reliability Gateway

A production-style backend service built with **TypeScript and NestJS** that accepts signed webhooks and delivers them reliably to downstream services.

## Problem

Webhook delivery commonly fails because events are duplicated, consumers are temporarily unavailable, permanent errors are retried blindly, and failed deliveries are difficult to inspect or replay.

This project provides a small reliability layer between webhook producers and downstream consumers.

## Features

- HMAC-SHA256 signature verification
- duplicate prevention using a unique `eventId`
- durable local JSON persistence across restarts
- automatic background HTTP delivery
- configurable delivery timeout and polling interval
- retries for `408`, `429`, and `5xx` responses
- exponential backoff
- dead-letter state after permanent or exhausted failures
- complete delivery-attempt history
- manual replay endpoint
- Swagger/OpenAPI documentation
- Jest tests, Docker, and GitHub Actions CI

## Architecture

```text
Webhook Producer
      |
      v
POST /api/v1/webhooks
      |
      +--> Verify HMAC signature
      +--> Reject duplicate eventId
      +--> Persist event to durable store
      |
      v
Background Delivery Worker
      |
      +--> POST payload to destination URL
      +--> 2xx          -> DELIVERED
      +--> 408/429/5xx  -> RETRYING with backoff
      +--> other 4xx    -> DEAD_LETTER
      +--> max attempts -> DEAD_LETTER
```

The current implementation uses a file-backed repository to stay easy to run while still surviving process restarts. `WebhookStore` provides a clear boundary for replacing it with PostgreSQL or another durable database later.

## Tech Stack

- TypeScript
- NestJS
- Node.js native `fetch`
- class-validator
- Swagger/OpenAPI
- Jest
- Docker
- GitHub Actions

## Run Locally

```bash
cp .env.example .env
npm install
npm run start:dev
```

Swagger UI:

```text
http://localhost:3000/docs
```

Webhook events are stored by default in:

```text
data/webhooks.json
```

## Generate a Test Signature

```bash
node -e "const c=require('crypto'); const p={orderId:'order-101',status:'paid'}; console.log(c.createHmac('sha256','local-development-secret').update(JSON.stringify(p)).digest('hex'))"
```

## Receive a Webhook

```bash
curl -X POST http://localhost:3000/api/v1/webhooks \
  -H "Content-Type: application/json" \
  -H "x-webhook-signature: <generated-signature>" \
  -d '{
    "eventId": "evt-101",
    "eventType": "order.paid",
    "destinationUrl": "http://localhost:4000/webhooks",
    "payload": {
      "orderId": "order-101",
      "status": "paid"
    }
  }'
```

The event is persisted immediately. The background worker then attempts delivery to `destinationUrl`.

## Inspect an Event

```bash
curl http://localhost:3000/api/v1/webhooks/<id>
```

The response includes the current state and every delivery attempt.

## Replay a Failed Event

```bash
curl -X POST http://localhost:3000/api/v1/webhooks/<id>/replay
```

Replay moves the event back to `PENDING`; the worker picks it up automatically.

## Configuration

| Variable | Default | Purpose |
|---|---:|---|
| `WEBHOOK_SECRET` | `local-development-secret` | HMAC signing secret |
| `WEBHOOK_DATA_FILE` | `data/webhooks.json` | Durable event-store location |
| `DELIVERY_POLL_INTERVAL_MS` | `2000` | Worker polling interval |
| `DELIVERY_TIMEOUT_MS` | `5000` | Outbound request timeout |
| `MAX_DELIVERY_ATTEMPTS` | `5` | Maximum attempts before dead-lettering |

## Reliability Decisions

- Signature verification prevents unauthenticated event injection.
- Unique event IDs provide idempotent ingestion.
- Persist-before-deliver prevents accepted events from disappearing on restart.
- A single guarded worker loop prevents overlapping scans inside one process.
- Status-aware retries avoid repeatedly sending permanent client failures.
- Exponential backoff reduces pressure on unhealthy consumers.
- Dead-letter state and attempt history make failures visible and replayable.

## Tests

```bash
npm test
```

Tests use isolated temporary durable stores and cover signed ingestion, duplicate detection, retry behavior, and dead-letter handling.

## Docker

```bash
docker build -t webhook-reliability-gateway .
docker run -p 3000:3000 -v webhook-data:/app/data webhook-reliability-gateway
```

The volume preserves webhook data when the container is recreated.

## Next Improvements

- PostgreSQL persistence with unique constraints
- Redis distributed locking and deduplication TTL
- BullMQ for horizontally scalable workers
- per-destination retry policies
- outbound webhook signatures
- encrypted destination credentials
- Prometheus delivery metrics
- Testcontainers integration tests

## Why This Project

This repository demonstrates practical backend concerns found in payments, ordering, partner integrations, and distributed systems: authentication, idempotency, durable state, retries, timeouts, failure classification, background processing, observability, and safe replay.
