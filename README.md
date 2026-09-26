# EVE Healthcare — Backend Engineering System

A production-ready, modular JavaScript backend built with **Node.js, Express, PostgreSQL, and Prisma ORM** for diagnostic centre test management, appointment slot booking, and simulated payment processing with robust webhook idempotency and database-enforced concurrency safety.

---

## Table of Contents

1. [Architecture & Design Philosophy](#architecture--design-philosophy)
2. [Tech Stack](#tech-stack)
3. [Key Engineering Decisions & Assumptions](#key-engineering-decisions--assumptions)
4. [Database Schema & Entity Relations](#database-schema--entity-relations)
5. [Concurrency Safety & Slot Model](#concurrency-safety--slot-model)
6. [Booking State Machine](#booking-state-machine)
7. [Payment Flow & Webhook Idempotency](#payment-flow--webhook-idempotency)
8. [API Reference](#api-reference)
9. [Error Handling Strategy](#error-handling-strategy)
10. [Environment Configuration](#environment-configuration)
11. [Setup & Running Locally](#setup--running-locally)
12. [Running with Docker](#running-with-docker)
13. [Testing Guide](#testing-guide)
14. [Security Audit](#security-audit)
15. [Tradeoffs & Future Improvements](#tradeoffs--future-improvements)

---

## Architecture & Design Philosophy

The system is structured as a **Modular Monolith** using Express and Prisma, optimized for maintainability, explainability, and testability.

```
src/
├── app.js                  # Express application factory, middleware, & route mounting
├── server.js               # Server entrypoint with graceful shutdown
├── config/
│   └── env.js              # Centralized environment variable validation (Zod)
├── db/
│   └── prisma.js           # Prisma client singleton
├── plugins/
│   ├── auth.js             # Express JWT authentication middleware
│   ├── error-handler.js    # Express 4-argument centralized error middleware
│   └── swagger.js          # Swagger UI integration via swagger-ui-express & swagger-jsdoc (/docs)
├── common/
│   ├── errors/             # Domain error classes (NotFoundError, ConflictError, etc.)
│   ├── security/           # Isolated Argon2 password hashing & jose JWT signing/verification
│   └── utils/              # Minimal utilities (asyncHandler)
└── modules/
    ├── auth/               # User signup, login, auth repository & service
    ├── centres/            # Diagnostic centres, centre repository & service
    ├── tests/              # Diagnostic test catalogue, test repository & service
    ├── bookings/           # Appointment slot bookings, booking state machine & repository
    └── payments/           # Payment execution, webhook idempotency, payment repository
```

### Layer Responsibilities (4-Tier Architecture)

```
Express Route  ──>  Service Layer  ──>  Repository Layer  ──>  Prisma Client  ──>  PostgreSQL
```

- **Routes (`*.route.js`)**: Express routers handling HTTP parsing, payload validation with Zod schemas, auth middleware invocation, and response serialization via `asyncHandler`.
- **Services (`*.service.js`)**: Pure business logic, authorization rules, orchestration across repositories, transaction lifecycle management (`prisma.$transaction`), and error mapping. Services contain zero direct database queries.
- **Repositories (`*.repository.js`)**: Concrete data access layer containing explicit, encapsulated Prisma queries. Every repository method supports optional transaction clients (`db = prisma`) to enable multi-step ACID transactions across services.
- **Security (`src/common/security/`)**: Dedicated cryptographic modules isolating password hashing (`password.js` using Argon2) and token management (`jwt.js` using jose).
- **State Machines (`booking.state.js`)**: Centralized state transition table and transition validator for booking lifecycles (`PENDING` -> `CONFIRMED` / `FAILED` / `CANCELLED`).
- **Prisma Client (`src/db/prisma.js`)**: Relational database query engine and connection pool manager.

---

## Tech Stack

| Technology | Role |
| :--- | :--- |
| **Node.js** (v20+) | JavaScript runtime (ES Modules) |
| **Express** | HTTP web framework |
| **PostgreSQL** | Primary relational database |
| **Prisma ORM** | Schema migrations and transactional database queries |
| **Zod** | Runtime input validation and environment parsing |
| **Argon2** | Secure password hashing (Argon2id) |
| **jose** | Standards-compliant JWT signing and verification |
| **Helmet & CORS** | HTTP security headers and cross-origin resource sharing |
| **Pino & Pino-HTTP** | Structured request/response logging |
| **Swagger UI Express** | Interactive OpenAPI documentation (`/docs`) |
| **Vitest & Supertest** | Automated unit and integration testing suite |
| **Docker & Docker Compose** | Containerized deployment |

---

## Key Engineering Decisions & Assumptions

1. **User = Patient**: The `User` model represents both the authenticated account and the patient.
2. **Historical Price Snapshot**: The `Booking.amount` is explicitly captured at creation time from `CentreTest.price`. Historical bookings never reference dynamic centre prices to prevent price drift if a centre updates test pricing later.
3. **Appointment Slot Model**:
   - `appointmentAt` is an exact ISO 8601 timestamp representing the appointment schedule.
   - A single centre can run multiple *different* tests simultaneously (e.g. an MRI and a Blood Test at 10:00 AM).
   - However, a centre cannot run the *same* test at the same timestamp twice.
   - The active slot uniqueness is scoped to `(centreId, testId, appointmentAt)` for bookings with status `PENDING` or `CONFIRMED`.
4. **Monetary Precision**: All currency amounts use PostgreSQL `DECIMAL(10, 2)` (Prisma `Decimal`). Floating-point arithmetic is strictly avoided for money.

---

## Database Schema & Entity Relations

```mermaid
erDiagram
    USER ||--o{ BOOKING : places
    DIAGNOSTIC_CENTRE ||--o{ CENTRE_TEST : offers
    DIAGNOSTIC_TEST ||--o{ CENTRE_TEST : categorized
    DIAGNOSTIC_CENTRE ||--o{ BOOKING : hosts
    DIAGNOSTIC_TEST ||--o{ BOOKING : performs
    BOOKING ||--o| PAYMENT : pays
    PAYMENT_WEBHOOK_EVENT

    USER {
        string id PK
        string email UK
        string passwordHash
        datetime createdAt
        datetime updatedAt
    }

    DIAGNOSTIC_CENTRE {
        string id PK
        string name
        string location
        datetime createdAt
        datetime updatedAt
    }

    DIAGNOSTIC_TEST {
        string id PK
        string name
        string description
        datetime createdAt
        datetime updatedAt
    }

    CENTRE_TEST {
        string id PK
        string centreId FK
        string testId FK
        decimal price
        datetime createdAt
        datetime updatedAt
    }

    BOOKING {
        string id PK
        string userId FK
        string centreId FK
        string testId FK
        datetime appointmentAt
        decimal amount
        enum status
        datetime createdAt
        datetime updatedAt
    }

    PAYMENT {
        string id PK
        string bookingId FK,UK
        string providerPaymentId UK
        enum status
        decimal amount
        datetime createdAt
        datetime updatedAt
    }

    PAYMENT_WEBHOOK_EVENT {
        string id PK
        string providerEventId UK
        string eventType
        datetime processedAt
        datetime createdAt
    }
```

---

## Concurrency Safety & Slot Model

Concurrency safety is enforced at the database engine level using a **PostgreSQL Partial Unique Index**:

```sql
CREATE UNIQUE INDEX "unique_active_booking_slot" 
ON "bookings"("centreId", "testId", "appointmentAt") 
WHERE "status" IN ('PENDING', 'CONFIRMED');
```

- When Request A and Request B race for the same slot:
  - Request A inserts successfully (`201 Created`).
  - Request B triggers a unique constraint violation (`P2002`), which is caught and returned as a clean `409 Conflict` (`BOOKING_SLOT_UNAVAILABLE`).
- If a booking is `CANCELLED` or `FAILED`, the slot becomes immediately available for other users to book because the partial index only locks `PENDING` and `CONFIRMED` rows.

---

## Booking State Machine

```mermaid
stateDiagram-v2
    [*] --> PENDING : POST /bookings

    PENDING --> CONFIRMED : Payment SUCCESS (Client / Webhook)
    PENDING --> FAILED : Payment FAILED (Client / Webhook)
    PENDING --> CANCELLED : POST /bookings/:id/cancel (User Action)

    CONFIRMED --> [*]
    FAILED --> [*]
    CANCELLED --> [*]
```

### Transition Rules

- `PENDING -> CANCELLED`: Triggerable by the booking owner via `POST /bookings/:id/cancel`.
- `PENDING -> CONFIRMED`: Triggerable only via successful payment or webhook event.
- `PENDING -> FAILED`: Triggerable only via failed payment or webhook event.
- Invalid transitions (e.g. attempting to cancel a `CONFIRMED` or `CANCELLED` booking, or applying payment to a `CANCELLED` booking) immediately reject with `409 Conflict` (`INVALID_BOOKING_STATE`).

### Concurrency Safety on State Transitions (Optimistic Locking / Conditional Updates)
To prevent race conditions between simultaneous payment processing and cancellation requests:
- State transitions are executed via atomic conditional updates (`UPDATE bookings SET status = $target WHERE id = $id AND status = 'PENDING'`).
- The repository layer executes this atomically (`BookingRepository.transitionStatus`), verifying that `affectedRows === 1`.
- If a simultaneous cancel and payment request arrive, exactly one will update the row; the losing request observes `affectedRows === 0` and is cleanly aborted with `409 Conflict` (`INVALID_BOOKING_STATE`), preventing any invalid dual state.

---

## Payment Flow & Webhook Idempotency

### 1. Simulated Client Payments (`POST /payments`)

- Authenticated patient submits `bookingId` and `providerPaymentId`.
- Amount is automatically pulled from the booking snapshot (cannot be altered by client).
- Ownership is verified (`booking.userId === req.user.id`).
- Within a Prisma transaction, creates the payment record and transitions booking to `CONFIRMED` or `FAILED`.

### 2. Provider Webhook Handling (`POST /payments/webhook`)

1. **Atomic Deduplication**: `PaymentWebhookEvent.providerEventId` has a unique constraint.
2. **Idempotent Acknowledgment**:
   - First delivery: records event, verifies booking, creates payment, updates booking status within an atomic transaction, returning `{ received: true, status: "processed" }`.
   - Repeated delivery: acknowledges immediately with `200 OK` and `{ received: true, status: "already_processed" }`.
   - Concurrent delivery: database uniqueness resolves race safely, exactly 1 payment created, both return `200 OK`.
3. **Conflict Detection**: Conflicting statuses return `409 Conflict` (`PAYMENT_CONFLICT`).

---

## API Reference

Interactive Swagger documentation is available at `http://localhost:3000/docs`.

### Authentication

| Method | Endpoint | Description | Auth |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/signup` | Register a new user account | Public |
| `POST` | `/auth/login` | Authenticate and receive JWT token | Public |
| `GET` | `/auth/me` | Retrieve authenticated user profile | Bearer JWT |

### Diagnostic Centres & Tests

| Method | Endpoint | Description | Auth |
| :--- | :--- | :--- | :--- |
| `POST` | `/centres` | Create diagnostic centre | ADMIN (Bearer JWT) |
| `GET` | `/centres` | List diagnostic centres (paginated: `?page=1&limit=20`) | Public |
| `GET` | `/centres/:id` | Get centre details with available tests & pricing | Public |
| `POST` | `/tests` | Create diagnostic test | ADMIN (Bearer JWT) |
| `GET` | `/tests` | List diagnostic tests (paginated) | Public |
| `GET` | `/tests/:id` | Get test details with offering centres | Public |
| `POST` | `/centres/:id/tests` | Assign test to centre with centre-specific price | ADMIN (Bearer JWT) |
| `GET` | `/centres/:id/tests` | List all tests offered by a centre | Public |

### Bookings

| Method | Endpoint | Description | Auth |
| :--- | :--- | :--- | :--- |
| `POST` | `/bookings` | Book an appointment slot | Bearer JWT |
| `GET` | `/bookings` | List authenticated user's bookings (`?page=1&limit=20&status=PENDING`) | Bearer JWT |
| `GET` | `/bookings/:id` | Get booking details (owner only) | Bearer JWT |
| `POST` | `/bookings/:id/cancel` | Cancel a pending booking (owner only) | Bearer JWT |

### Payments

| Method | Endpoint | Description | Auth |
| :--- | :--- | :--- | :--- |
| `POST` | `/payments` | Process simulated payment for a booking | Bearer JWT |
| `GET` | `/payments/booking/:id` | View payment details for a booking (owner only) | Bearer JWT |
| `POST` | `/payments/webhook` | Handle payment gateway webhook event | Public (Idempotent) |

---

## Error Handling Strategy

All errors follow a unified, predictable JSON envelope:

```json
{
  "error": {
    "code": "BOOKING_SLOT_UNAVAILABLE",
    "message": "The selected appointment slot is already booked"
  }
}
```

---

## Setup & Running Locally

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

### 3. Run Database Migrations

```bash
npm run prisma:migrate
```

### 4. Start Development Server

```bash
npm run dev
```

The server will start at `http://localhost:3000`. Swagger API docs are available at `http://localhost:3000/docs`.

---

## Running with Docker

```bash
docker compose up -d --build
```

---

## Testing Guide

```bash
# Run all unit and integration tests
npm test

# Run isolated unit tests only (instant, no DB required)
npx vitest run tests/unit
```

### Complete Test Matrix

```
Test Files  8 passed (8)
     Tests  69 passed (69)

Unit Test Suites:
✓ tests/unit/booking.state.test.js        (4 tests)  — State machine transitions & invariants
✓ tests/unit/payment.service.test.js      (6 tests)  — Payment amount, ownership & repository mocks
✓ tests/unit/booking.service.test.js      (4 tests)  — Slot checking, pricing & tenant isolation
✓ tests/unit/auth.service.test.js         (3 tests)  — Argon2 hashing & jose JWT cryptographic signing

Integration Test Suites (Live Database):
✓ tests/integration/payments.test.js      (14 tests) — Webhook replay (10x), 3x concurrent webhooks, race conditions
✓ tests/integration/bookings.test.js      (14 tests) — Concurrency slot lock, state transitions, tenant isolation
✓ tests/integration/centres-tests.test.js (17 tests) — RBAC permissions, ADMIN vs USER, pricing catalog
✓ tests/integration/auth.test.js          (7 tests)  — Signup, login, invalid credentials, JWT middleware
```

---

## Edge Cases Tested & Manual Verification Guide

This section provides copy-paste `curl` commands to manually verify the core architectural edge cases handled by the system.

### 1. Authentication & RBAC (Admin Self-Elevation Prevention)

Public signups cannot self-elevate to `ADMIN`. Submitting a `role: "ADMIN"` field during public registration is strictly ignored and forced to `USER`.

#### Attempting Role Elevation:
```bash
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "hacker@example.com",
    "password": "password123",
    "role": "ADMIN"
  }'
```
**Response (`201 Created`):**
```json
{
  "user": {
    "id": "...",
    "email": "hacker@example.com",
    "role": "USER",
    "createdAt": "..."
  },
  "accessToken": "..."
}
```
*Notice that `role` is forced to `USER`.*

#### Attempting to Create a Diagnostic Centre with a `USER` Token:
```bash
curl -X POST http://localhost:3000/centres \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <USER_TOKEN>" \
  -d '{
    "name": "Unauthorized Diagnostic Centre",
    "location": "Bangalore"
  }'
```
**Response (`403 Forbidden`):**
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to perform this action"
  }
}
```

---

### 2. Booking Concurrency & Slot Double-Booking Prevention

When two patients race to book the exact same slot `(centreId, testId, appointmentAt)` at the exact same millisecond:

```bash
# Request A:
curl -X POST http://localhost:3000/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <USER_A_TOKEN>" \
  -d '{
    "centreId": "<CENTRE_ID>",
    "testId": "<TEST_ID>",
    "appointmentAt": "2026-10-15T10:00:00.000Z"
  }'

# Request B (Simultaneous):
curl -X POST http://localhost:3000/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <USER_B_TOKEN>" \
  -d '{
    "centreId": "<CENTRE_ID>",
    "testId": "<TEST_ID>",
    "appointmentAt": "2026-10-15T10:00:00.000Z"
  }'
```

- **First request to commit**: Returns `201 Created` with status `PENDING`.
- **Second request**: PostgreSQL partial unique index (`unique_active_booking_slot`) rejects the insert atomically. The server catches `P2002` and returns `409 Conflict`:
```json
{
  "error": {
    "code": "BOOKING_SLOT_UNAVAILABLE",
    "message": "The selected appointment slot is already booked"
  }
}
```

---

### 3. Webhook Idempotency & Replay Handling

Webhooks may be retried or duplicated across unstable networks. The system tracks `providerEventId` inside an ACID transaction to guarantee at-most-once processing.

#### First Webhook Delivery:
```bash
curl -X POST http://localhost:3000/payments/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "evt_gateway_1001",
    "eventType": "payment.succeeded",
    "data": {
      "bookingId": "<BOOKING_ID>",
      "providerPaymentId": "pay_gw_1001",
      "status": "SUCCESS"
    }
  }'
```
**Response (`200 OK`):**
```json
{
  "received": true,
  "status": "processed",
  "eventId": "evt_gateway_1001",
  "paymentId": "...",
  "bookingId": "...",
  "bookingStatus": "CONFIRMED"
}
```

#### Second Repeated Delivery (Same payload):
```bash
curl -X POST http://localhost:3000/payments/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "evt_gateway_1001",
    "eventType": "payment.succeeded",
    "data": {
      "bookingId": "<BOOKING_ID>",
      "providerPaymentId": "pay_gw_1001",
      "status": "SUCCESS"
    }
  }'
```
**Response (`200 OK` - Idempotent, zero duplicate payments):**
```json
{
  "received": true,
  "status": "already_processed",
  "eventId": "evt_gateway_1001",
  "paymentId": "..."
}
```

---

### 4. Payment vs Cancellation Race Conditions

If a patient attempts to cancel a booking while a payment gateway webhook arrives concurrently:
- State transitions execute via atomic conditional updates (`UPDATE bookings SET status = $target WHERE id = $id AND status = 'PENDING'`).
- Exactly one operation transitions the booking; the losing operation observes `affectedRows === 0` and is safely aborted with `409 Conflict` (`INVALID_BOOKING_STATE`), preventing any invalid dual state.
