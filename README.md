# Webhook Reliability Gateway

A small production-style backend service built with **TypeScript and NestJS** that makes webhook ingestion and delivery safer.

## Problem

Webhook systems often fail in predictable ways:

- the same event is delivered multiple times
- downstream services return temporary failures
- permanent failures are retried unnecessarily
- teams cannot easily inspect delivery history
- failed events are difficult to replay safely

This project provides a simple reliability layer between webhook producers and downstream consumers.

## What It Does

- verifies HMAC-SHA256 webhook signatures
- rejects duplicate `eventId` values
- stores webhook events and delivery attempts
- retries `408`, `429`, and `5xx` responses
- uses exponential backoff for temporary failures
- moves permanent or exhausted failures to a dead-letter state
- exposes a manual replay endpoint
- documents the API with Swagger

## Architecture

```text
Webhook Producer
       |
       v
POST /api/v1/webhooks
       |
       +--> Verify HMAC signature
       +--> Reject duplicate eventId
       +--> Persist event
       |
       v
Delivery Attempt API
       |
       +--> 2xx       -> DELIVERED
       +--> 408/429/5xx -> RETRYING
       +--> 4xx       -> DEAD_LETTER
       +--> max attempts reached -> DEAD_LETTER
```

The current MVP uses an in-memory repository to keep setup simple. The service boundary is intentionally small so PostgreSQL, Redis, BullMQ, or Kafka can be introduced later without changing the public API.

## Tech Stack

- TypeScript
- NestJS
- class-validator
- Swagger/OpenAPI
- Jest
- Docker
- GitHub Actions

## Run Locally

```bash
npm install
npm run start:dev
```

Swagger UI:

```text
http://localhost:3000/docs
```

## Generate a Test Signature

The default local secret is:

```text
local-development-secret
```

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

## Record a Delivery Attempt

```bash
curl -X POST http://localhost:3000/api/v1/webhooks/<id>/attempts \
  -H "Content-Type: application/json" \
  -d '{"statusCode":503,"error":"Downstream unavailable"}'
```

Temporary failures return `RETRYING` with a calculated `nextRetryAt` value.

## Replay a Failed Event

```bash
curl -X POST http://localhost:3000/api/v1/webhooks/<id>/replay
```

## Reliability Decisions

- **HMAC verification** prevents unauthenticated webhook injection.
- **Unique event IDs** provide idempotent ingestion.
- **Status-aware retries** avoid retrying permanent client errors.
- **Exponential backoff** reduces pressure on unhealthy downstream systems.
- **Dead-letter state** makes failures visible instead of silently dropping them.
- **Attempt history** helps operators understand what happened.

## Tests

```bash
npm test
```

The tests cover signed ingestion, duplicate detection, temporary retries, and dead-letter behavior.

## Docker

```bash
docker build -t webhook-reliability-gateway .
docker run -p 3000:3000 webhook-reliability-gateway
```

## Next Improvements

- PostgreSQL persistence
- Redis deduplication with TTL
- BullMQ delivery worker
- real outbound HTTP delivery
- configurable retry policies per destination
- encrypted destination secrets
- metrics for success rate and retry backlog
- dead-letter dashboard
- Testcontainers integration tests

## Why This Project

This repository demonstrates practical backend concerns that appear in payments, ordering, integrations, and distributed systems: authentication, idempotency, retries, failure classification, observability, and replay safety.
