# NeoClarity — Core API (Spring Boot)

Auth, accounts, goals, recommendations, and resilience score endpoints.
Backed by PostgreSQL. Calls the FastAPI agent layer (Week 5) via REST.

## Stack

- Java 21, Spring Boot 3.3
- Spring Security + JWT (stateless)
- Spring Data JPA + PostgreSQL 16
- Flyway for schema migrations
- Lombok

## Quick start (Docker)

```bash
docker compose up --build
```

This starts PostgreSQL (port 5432) and the API (port 8080).
On first boot, Flyway runs `V1__init_schema.sql` and a demo customer is seeded automatically.

## Quick start (local, no Docker)

1. Start PostgreSQL locally and create the database:
   ```sql
   CREATE DATABASE neoclarity;
   CREATE USER neoclarity WITH PASSWORD 'neoclarity_dev';
   GRANT ALL PRIVILEGES ON DATABASE neoclarity TO neoclarity;
   ```
2. Run:
   ```bash
   mvn spring-boot:run
   ```

## Demo credentials (seeded automatically)

```
email:    demo@neoclarity.app
password: Password123!
MFA code: 123456   (shown in the /login response as demoHint)
```

This demo customer has:
- 3 linked accounts (Chase Checking, Ally Savings, Chase Credit) — net worth $5,610
- 3 goals (Emergency Fund, Vacation, College) matching the UX prototype
- A Resilience Score of 68 with full component breakdown + 30-day history
- A pending HIGH-priority Next Best Action (Increase Emergency Fund Savings)
- 2 secondary pending recommendations (Dining, College Fund)
- An unconfirmed Yellowstone Vacation life event ($4,200, 87% confidence)
- A confirmed Soccer Season life event

## API walkthrough

```bash
# 1. Login (returns MFA challenge)
curl -X POST localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@neoclarity.app","password":"Password123!"}'
# => { "mfaRequired": true, "mfaToken": "...", "demoHint": "Demo MFA code: 123456" }

# 2. Verify MFA -> get JWT
curl -X POST localhost:8080/api/auth/verify-mfa \
  -H "Content-Type: application/json" \
  -d '{"mfaToken":"<from step 1>","code":"123456"}'
# => { "token": "<JWT>", "tokenType": "Bearer", ... }

# 3. Use the token
TOKEN="<JWT from step 2>"

curl localhost:8080/api/dashboard/resilience-score -H "Authorization: Bearer $TOKEN"
curl localhost:8080/api/recommendations/next-best-action -H "Authorization: Bearer $TOKEN"
curl localhost:8080/api/goals -H "Authorization: Bearer $TOKEN"
curl localhost:8080/api/accounts -H "Authorization: Bearer $TOKEN"
curl localhost:8080/api/accounts/net-worth -H "Authorization: Bearer $TOKEN"

# 4. Approve the Next Best Action
curl -X PATCH localhost:8080/api/recommendations/<recommendationId> \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"response":"APPROVED"}'
```

## Endpoint summary

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | /api/auth/register | No | FR-1.1 |
| POST | /api/auth/login | No | Returns MFA challenge (FR-1.5, simulated) |
| POST | /api/auth/verify-mfa | No | Returns JWT |
| GET | /api/auth/me | Yes | Current customer summary |
| PUT | /api/auth/consent | Yes | FR-2.1/2.3 — consent toggle |
| GET | /api/accounts | Yes | FR-3.1 |
| GET | /api/accounts/net-worth | Yes | Sum of active balances |
| GET | /api/goals | Yes | FR-7.2 |
| POST | /api/goals | Yes | FR-7.1 |
| PUT | /api/goals/{goalId} | Yes | FR-7.4 |
| PATCH | /api/goals/{goalId}/pause | Yes | |
| PATCH | /api/goals/{goalId}/resume | Yes | |
| GET | /api/dashboard/resilience-score | Yes | FR-5.1–5.4 |
| GET | /api/dashboard/resilience-score/history | Yes | FR-5.5 |
| GET | /api/recommendations | Yes | FR-8.5 |
| GET | /api/recommendations/next-best-action | Yes | FR-9.3 — dashboard hero card |
| PATCH | /api/recommendations/{id} | Yes | FR-10.1–10.3 — Approve/Dismiss/Remind |

## What's stubbed for Week 5

- `/api/agent/analyze` call to FastAPI is **not yet wired** — `RecommendationService.respond()`
  has a TODO marking where the Twin update call goes once the agent layer exists.
- Neo4j dual-write (`transactions.neo4j_synced` flag) exists in the schema but the sync
  job itself is part of the FastAPI ingestion work (Week 4–5).
- Mock Open Banking ingestion endpoint (FR-3.1–3.4) is not yet built — current demo data
  is seeded directly via `DemoDataSeeder`.

## Next (Week 2 remainder / Week 3)

- Mock Open Banking ingestion endpoint + transaction generator
- Dockerfile is ready for ECS Fargate — push to ECR per frozen architecture Section 4

## Open Banking endpoints (NEW)

| Method | Path | Notes |
|---|---|---|
| GET | /api/open-banking/institutions | Browse provider catalog (Chase, Ally, BofA, Wells, Capital One, Amex) |
| GET | /api/open-banking/institutions/{id} | Preview accounts for consent screen |
| POST | /api/open-banking/link | Grant consent + link accounts + generate 90-day transactions |

Linking a credit account auto-injects the Yellowstone vacation cluster (4 transactions)
that the Event Intelligence Agent detects. Linking a checking account seeds biweekly
salary deposits (income detection) plus recurring + discretionary spend.

## Consent & data-lifecycle endpoints (NEW)

| Method | Path | Notes |
|---|---|---|
| POST | /api/accounts/{accountId}/disconnect | FR-2.3 — SOFT deactivate, retains transactions for audit |
| POST | /api/accounts/{accountId}/reconnect | Reverses a disconnect |
| DELETE | /api/consent/my-data?confirm=DELETE | FR-2.4 — HARD delete all financial data (requires confirm=DELETE) |

**Disconnect vs Delete:**
- *Disconnect* sets `is_active=false`. The account stops counting toward net worth and the
  Resilience Score, future ingestion halts, but historical transactions and recommendations
  are retained — mirroring how regulated institutions handle consent revocation.
- *Delete My Data* removes accounts, transactions, goals, scores, events, recommendations,
  and context labels. The customer login is retained so they can start fresh. Requires the
  `confirm=DELETE` query param server-side, plus a typed "DELETE" confirmation client-side.
