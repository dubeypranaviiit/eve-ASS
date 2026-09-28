# EVE Healthcare — Complete API Documentation & Route Reference

Base URL (Local Development): `http://localhost:3000`

---

## Quick Navigation Table

| Category | HTTP Method | Full Path URL | Auth Required | Description |
| :--- | :--- | :--- | :--- | :--- |
| **System** | `GET` | `http://localhost:3000/health` | Public | Server health and uptime check |
| **Documentation** | `GET` | `http://localhost:3000/docs` | Public | Interactive Swagger OpenAPI UI |
| **Authentication** | `POST` | `http://localhost:3000/auth/signup` | Public | Register new patient account (USER role) |
| **Authentication** | `POST` | `http://localhost:3000/auth/login` | Public | Authenticate user credentials & receive JWT token |
| **Authentication** | `GET` | `http://localhost:3000/auth/me` | Bearer JWT | Fetch authenticated user profile & role |
| **Diagnostic Centres** | `POST` | `http://localhost:3000/centres` | ADMIN (JWT) | Create a diagnostic centre |
| **Diagnostic Centres** | `GET` | `http://localhost:3000/centres` | Public | List diagnostic centres (paginated) |
| **Diagnostic Centres** | `GET` | `http://localhost:3000/centres/:id` | Public | Get centre details with tests & pricing |
| **Diagnostic Centres** | `POST` | `http://localhost:3000/centres/:id/tests` | ADMIN (JWT) | Link diagnostic test with centre-specific price |
| **Diagnostic Centres** | `GET` | `http://localhost:3000/centres/:id/tests` | Public | List all tests available at a centre |
| **Diagnostic Tests** | `POST` | `http://localhost:3000/tests` | ADMIN (JWT) | Create a diagnostic test catalogue entry |
| **Diagnostic Tests** | `GET` | `http://localhost:3000/tests` | Public | List all diagnostic tests (paginated) |
| **Diagnostic Tests** | `GET` | `http://localhost:3000/tests/:id` | Public | Get test details with offering centres |
| **Bookings** | `POST` | `http://localhost:3000/bookings` | Bearer JWT | Book an appointment slot |
| **Bookings** | `GET` | `http://localhost:3000/bookings` | Bearer JWT | List patient's bookings (paginated, filterable) |
| **Bookings** | `GET` | `http://localhost:3000/bookings/:id` | Bearer JWT | Get booking details (owner only) |
| **Bookings** | `POST` | `http://localhost:3000/bookings/:id/cancel` | Bearer JWT | Cancel a pending booking (owner only) |
| **Payments** | `POST` | `http://localhost:3000/payments` | Bearer JWT | Process simulated client payment |
| **Payments** | `GET` | `http://localhost:3000/payments/booking/:id` | Bearer JWT | View payment details for a booking (owner only) |
| **Payments / Webhook**| `POST` | `http://localhost:3000/payments/webhook` | Public | Payment gateway webhook receiver (Idempotent) |

---

## 1. System & Health

### 1.1 Health Check
- **Endpoint**: `GET http://localhost:3000/health`
- **Authentication**: None (Public)
- **What It Does**: Verifies that the Express application is running and responsive.

#### Example Request:
```bash
curl -X GET http://localhost:3000/health
```

#### Example Response (`200 OK`):
```json
{
  "status": "healthy",
  "timestamp": "2026-09-26T10:50:00.000Z"
}
```

---

## 2. Authentication Module

### 2.1 User Signup
- **Endpoint**: `POST http://localhost:3000/auth/signup`
- **Authentication**: None (Public)
- **Rate Limit**: 15 requests per 15 minutes
- **What It Does**: Registers a new user account with an email and password. All public signups are assigned the `USER` role. Passwords are securely hashed with Argon2id. Returns the user record and a signed JWT access token.

#### Example Request:
```bash
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "patient@example.com",
    "password": "SecurePassword123"
  }'
```

#### Example Response (`201 Created`):
```json
{
  "user": {
    "id": "c3d5267b-1fc6-4b2a-8dc4-9a1bfcb2d54e",
    "email": "patient@example.com",
    "role": "USER",
    "createdAt": "2026-09-26T10:50:00.000Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### 2.2 User Login
- **Endpoint**: `POST http://localhost:3000/auth/login`
- **Authentication**: None (Public)
- **Rate Limit**: 15 requests per 15 minutes (Brute-force protection)
- **What It Does**: Verifies email and Argon2id password hash. Returns user profile details and an access token.

#### Example Request:
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "patient@example.com",
    "password": "SecurePassword123"
  }'
```

#### Example Response (`200 OK`):
```json
{
  "user": {
    "id": "c3d5267b-1fc6-4b2a-8dc4-9a1bfcb2d54e",
    "email": "patient@example.com",
    "role": "USER",
    "createdAt": "2026-09-26T10:50:00.000Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### 2.3 Get Current User Profile
- **Endpoint**: `GET http://localhost:3000/auth/me`
- **Authentication**: `Bearer <JWT_TOKEN>`
- **What It Does**: Extracts user credentials and role from the verified JWT payload and returns the active identity.

#### Example Request:
```bash
curl -X GET http://localhost:3000/auth/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

#### Example Response (`200 OK`):
```json
{
  "user": {
    "id": "c3d5267b-1fc6-4b2a-8dc4-9a1bfcb2d54e",
    "email": "patient@example.com",
    "role": "USER"
  }
}
```

---

## 3. Diagnostic Centres Module

### 3.1 Create Diagnostic Centre
- **Endpoint**: `POST http://localhost:3000/centres`
- **Authentication**: `Bearer <ADMIN_JWT_TOKEN>` (ADMIN role required)
- **What It Does**: Adds a new diagnostic facility to the system.

#### Example Request:
```bash
curl -X POST http://localhost:3000/centres \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -d '{
    "name": "Apollo Diagnostics Koramangala",
    "location": "Bangalore, Karnataka"
  }'
```

#### Example Response (`201 Created`):
```json
{
  "id": "8f887556-9fc2-46a2-93ad-c58be30aaef7",
  "name": "Apollo Diagnostics Koramangala",
  "location": "Bangalore, Karnataka",
  "createdAt": "2026-09-26T10:51:00.000Z",
  "updatedAt": "2026-09-26T10:51:00.000Z"
}
```

---

### 3.2 List Diagnostic Centres
- **Endpoint**: `GET http://localhost:3000/centres?page=1&limit=20`
- **Authentication**: None (Public)
- **What It Does**: Retrieves paginated list of diagnostic centres.

#### Example Request:
```bash
curl -X GET "http://localhost:3000/centres?page=1&limit=10"
```

#### Example Response (`200 OK`):
```json
{
  "data": [
    {
      "id": "8f887556-9fc2-46a2-93ad-c58be30aaef7",
      "name": "Apollo Diagnostics Koramangala",
      "location": "Bangalore, Karnataka",
      "createdAt": "2026-09-26T10:51:00.000Z",
      "updatedAt": "2026-09-26T10:51:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

---

### 3.3 Get Centre by ID (With Offered Tests & Pricing)
- **Endpoint**: `GET http://localhost:3000/centres/:id`
- **Authentication**: None (Public)
- **What It Does**: Returns diagnostic centre details alongside all tests offered by this centre and their centre-specific prices.

#### Example Request:
```bash
curl -X GET http://localhost:3000/centres/8f887556-9fc2-46a2-93ad-c58be30aaef7
```

#### Example Response (`200 OK`):
```json
{
  "id": "8f887556-9fc2-46a2-93ad-c58be30aaef7",
  "name": "Apollo Diagnostics Koramangala",
  "location": "Bangalore, Karnataka",
  "tests": [
    {
      "testId": "d14f48b9-8736-4e0d-b1aa-e25f778a6311",
      "name": "Complete Blood Count (CBC)",
      "description": "Measures white blood cells, red blood cells, and platelets.",
      "price": 450.0
    }
  ],
  "createdAt": "2026-09-26T10:51:00.000Z",
  "updatedAt": "2026-09-26T10:51:00.000Z"
}
```

---

### 3.4 Link Test to Centre with Custom Price
- **Endpoint**: `POST http://localhost:3000/centres/:id/tests`
- **Authentication**: `Bearer <ADMIN_JWT_TOKEN>` (ADMIN role required)
- **What It Does**: Links a catalogue test to a diagnostic centre with a custom price snapshot. Enforces unique relationship `(centreId, testId)`.

#### Example Request:
```bash
curl -X POST http://localhost:3000/centres/8f887556-9fc2-46a2-93ad-c58be30aaef7/tests \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -d '{
    "testId": "d14f48b9-8736-4e0d-b1aa-e25f778a6311",
    "price": 450.00
  }'
```

#### Example Response (`201 Created`):
```json
{
  "id": "e98e29a3-568b-4b2a-8cb9-994c5021e1bb",
  "centreId": "8f887556-9fc2-46a2-93ad-c58be30aaef7",
  "testId": "d14f48b9-8736-4e0d-b1aa-e25f778a6311",
  "price": 450.0,
  "createdAt": "2026-09-26T10:52:00.000Z",
  "updatedAt": "2026-09-26T10:52:00.000Z"
}
```

---

### 3.5 List Tests Offered by a Centre
- **Endpoint**: `GET http://localhost:3000/centres/:id/tests`
- **Authentication**: None (Public)
- **What It Does**: Lists all tests available at a specific centre.

#### Example Request:
```bash
curl -X GET http://localhost:3000/centres/8f887556-9fc2-46a2-93ad-c58be30aaef7/tests
```

#### Example Response (`200 OK`):
```json
[
  {
    "testId": "d14f48b9-8736-4e0d-b1aa-e25f778a6311",
    "name": "Complete Blood Count (CBC)",
    "description": "Measures white blood cells, red blood cells, and platelets.",
    "price": 450.0
  }
]
```

---

## 4. Diagnostic Tests Module

### 4.1 Create Diagnostic Test
- **Endpoint**: `POST http://localhost:3000/tests`
- **Authentication**: `Bearer <ADMIN_JWT_TOKEN>` (ADMIN role required)
- **What It Does**: Adds a new diagnostic test definition to the global test catalogue.

#### Example Request:
```bash
curl -X POST http://localhost:3000/tests \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -d '{
    "name": "Complete Blood Count (CBC)",
    "description": "Comprehensive blood examination measuring RBC, WBC, and platelets."
  }'
```

#### Example Response (`201 Created`):
```json
{
  "id": "d14f48b9-8736-4e0d-b1aa-e25f778a6311",
  "name": "Complete Blood Count (CBC)",
  "description": "Comprehensive blood examination measuring RBC, WBC, and platelets.",
  "createdAt": "2026-09-26T10:51:00.000Z",
  "updatedAt": "2026-09-26T10:51:00.000Z"
}
```

---

### 4.2 List Diagnostic Tests
- **Endpoint**: `GET http://localhost:3000/tests?page=1&limit=20`
- **Authentication**: None (Public)
- **What It Does**: Retrieves paginated list of all diagnostic tests in the catalogue.

#### Example Request:
```bash
curl -X GET "http://localhost:3000/tests?page=1&limit=10"
```

#### Example Response (`200 OK`):
```json
{
  "data": [
    {
      "id": "d14f48b9-8736-4e0d-b1aa-e25f778a6311",
      "name": "Complete Blood Count (CBC)",
      "description": "Comprehensive blood examination measuring RBC, WBC, and platelets.",
      "createdAt": "2026-09-26T10:51:00.000Z",
      "updatedAt": "2026-09-26T10:51:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

---

### 4.3 Get Test Details with Offering Centres
- **Endpoint**: `GET http://localhost:3000/tests/:id`
- **Authentication**: None (Public)
- **What It Does**: Returns test details and lists all diagnostic centres that offer this test with their prices.

#### Example Request:
```bash
curl -X GET http://localhost:3000/tests/d14f48b9-8736-4e0d-b1aa-e25f778a6311
```

#### Example Response (`200 OK`):
```json
{
  "id": "d14f48b9-8736-4e0d-b1aa-e25f778a6311",
  "name": "Complete Blood Count (CBC)",
  "description": "Comprehensive blood examination measuring RBC, WBC, and platelets.",
  "centres": [
    {
      "centreId": "8f887556-9fc2-46a2-93ad-c58be30aaef7",
      "name": "Apollo Diagnostics Koramangala",
      "location": "Bangalore, Karnataka",
      "price": 450.0
    }
  ],
  "createdAt": "2026-09-26T10:51:00.000Z",
  "updatedAt": "2026-09-26T10:51:00.000Z"
}
```

---

## 5. Bookings Module

### 5.1 Create Booking (Appointment Slot)
- **Endpoint**: `POST http://localhost:3000/bookings`
- **Authentication**: `Bearer <USER_JWT_TOKEN>`
- **What It Does**:
  1. Validates future appointment timestamp (`appointmentAt`).
  2. Verifies the test is offered at the centre.
  3. Snapshots the price at creation time into `Booking.amount`.
  4. Enforces slot concurrency lock at database engine level (`unique_active_booking_slot` partial unique index).
  5. Sets initial status to `PENDING`.

#### Example Request:
```bash
curl -X POST http://localhost:3000/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <USER_TOKEN>" \
  -d '{
    "centreId": "8f887556-9fc2-46a2-93ad-c58be30aaef7",
    "testId": "d14f48b9-8736-4e0d-b1aa-e25f778a6311",
    "appointmentAt": "2026-10-15T10:00:00.000Z"
  }'
```

#### Example Response (`201 Created`):
```json
{
  "id": "713e2bb9-2e11-419b-a01b-bf42b322a450",
  "userId": "c3d5267b-1fc6-4b2a-8dc4-9a1bfcb2d54e",
  "centreId": "8f887556-9fc2-46a2-93ad-c58be30aaef7",
  "centreName": "Apollo Diagnostics Koramangala",
  "testId": "d14f48b9-8736-4e0d-b1aa-e25f778a6311",
  "testName": "Complete Blood Count (CBC)",
  "appointmentAt": "2026-10-15T10:00:00.000Z",
  "amount": 450.0,
  "status": "PENDING",
  "createdAt": "2026-09-26T10:53:00.000Z",
  "updatedAt": "2026-09-26T10:53:00.000Z"
}
```

---

### 5.2 List User Bookings
- **Endpoint**: `GET http://localhost:3000/bookings?page=1&limit=20&status=PENDING`
- **Authentication**: `Bearer <USER_JWT_TOKEN>`
- **What It Does**: Retrieves paginated list of bookings owned by the authenticated patient. Allows optional filtering by `status` (`PENDING`, `CONFIRMED`, `CANCELLED`, `FAILED`).

#### Example Request:
```bash
curl -X GET "http://localhost:3000/bookings?page=1&limit=10&status=PENDING" \
  -H "Authorization: Bearer <USER_TOKEN>"
```

#### Example Response (`200 OK`):
```json
{
  "data": [
    {
      "id": "713e2bb9-2e11-419b-a01b-bf42b322a450",
      "userId": "c3d5267b-1fc6-4b2a-8dc4-9a1bfcb2d54e",
      "centreId": "8f887556-9fc2-46a2-93ad-c58be30aaef7",
      "centreName": "Apollo Diagnostics Koramangala",
      "testId": "d14f48b9-8736-4e0d-b1aa-e25f778a6311",
      "testName": "Complete Blood Count (CBC)",
      "appointmentAt": "2026-10-15T10:00:00.000Z",
      "amount": 450.0,
      "status": "PENDING",
      "paymentStatus": null,
      "createdAt": "2026-09-26T10:53:00.000Z",
      "updatedAt": "2026-09-26T10:53:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

---

### 5.3 Get Booking by ID
- **Endpoint**: `GET http://localhost:3000/bookings/:id`
- **Authentication**: `Bearer <USER_JWT_TOKEN>` (Tenant owner isolation)
- **What It Does**: Returns details of a specific booking. Enforces tenant authorization (patients cannot access other patients' bookings, returning `403 Forbidden`).

#### Example Request:
```bash
curl -X GET http://localhost:3000/bookings/713e2bb9-2e11-419b-a01b-bf42b322a450 \
  -H "Authorization: Bearer <USER_TOKEN>"
```

#### Example Response (`200 OK`):
```json
{
  "id": "713e2bb9-2e11-419b-a01b-bf42b322a450",
  "userId": "c3d5267b-1fc6-4b2a-8dc4-9a1bfcb2d54e",
  "centreId": "8f887556-9fc2-46a2-93ad-c58be30aaef7",
  "centreName": "Apollo Diagnostics Koramangala",
  "testId": "d14f48b9-8736-4e0d-b1aa-e25f778a6311",
  "testName": "Complete Blood Count (CBC)",
  "appointmentAt": "2026-10-15T10:00:00.000Z",
  "amount": 450.0,
  "status": "PENDING",
  "createdAt": "2026-09-26T10:53:00.000Z",
  "updatedAt": "2026-09-26T10:53:00.000Z"
}
```

---

### 5.4 Cancel Booking
- **Endpoint**: `POST http://localhost:3000/bookings/:id/cancel`
- **Authentication**: `Bearer <USER_JWT_TOKEN>` (Owner only)
- **What It Does**:
  1. Verifies booking ownership.
  2. Executes atomic conditional update (`UPDATE bookings SET status = 'CANCELLED' WHERE id = :id AND status = 'PENDING'`).
  3. Automatically frees the appointment slot for other users because the partial index only locks `PENDING` and `CONFIRMED` statuses.

#### Example Request:
```bash
curl -X POST http://localhost:3000/bookings/713e2bb9-2e11-419b-a01b-bf42b322a450/cancel \
  -H "Authorization: Bearer <USER_TOKEN>"
```

#### Example Response (`200 OK`):
```json
{
  "id": "713e2bb9-2e11-419b-a01b-bf42b322a450",
  "userId": "c3d5267b-1fc6-4b2a-8dc4-9a1bfcb2d54e",
  "centreId": "8f887556-9fc2-46a2-93ad-c58be30aaef7",
  "centreName": "Apollo Diagnostics Koramangala",
  "testId": "d14f48b9-8736-4e0d-b1aa-e25f778a6311",
  "testName": "Complete Blood Count (CBC)",
  "appointmentAt": "2026-10-15T10:00:00.000Z",
  "amount": 450.0,
  "status": "CANCELLED",
  "createdAt": "2026-09-26T10:53:00.000Z",
  "updatedAt": "2026-09-26T10:54:00.000Z"
}
```

---

## 6. Payments & Webhooks Module

### 6.1 Process Client Payment (Simulated)
- **Endpoint**: `POST http://localhost:3000/payments`
- **Authentication**: `Bearer <USER_JWT_TOKEN>` (Owner only)
- **What It Does**:
  1. Verifies ownership of the booking.
  2. Pulls the exact monetary amount from the `Booking.amount` snapshot (client cannot manipulate price).
  3. Inside a database transaction, creates a `Payment` record and atomically transitions the booking to `CONFIRMED` (if `status: SUCCESS`) or `FAILED` (if `status: FAILED`).

#### Example Request:
```bash
curl -X POST http://localhost:3000/payments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <USER_TOKEN>" \
  -d '{
    "bookingId": "713e2bb9-2e11-419b-a01b-bf42b322a450",
    "providerPaymentId": "pay_stripe_sim_90124",
    "status": "SUCCESS"
  }'
```

#### Example Response (`201 Created`):
```json
{
  "id": "a45f9e21-50e3-4c91-b1e0-08d132a76f23",
  "bookingId": "713e2bb9-2e11-419b-a01b-bf42b322a450",
  "providerPaymentId": "pay_stripe_sim_90124",
  "amount": 450.0,
  "status": "SUCCESS",
  "bookingStatus": "CONFIRMED",
  "createdAt": "2026-09-26T10:55:00.000Z",
  "updatedAt": "2026-09-26T10:55:00.000Z"
}
```

---

### 6.2 Get Payment Details for Booking
- **Endpoint**: `GET http://localhost:3000/payments/booking/:id`
- **Authentication**: `Bearer <USER_JWT_TOKEN>` (Owner only)
- **What It Does**: Retrieves payment transaction details for a given booking ID.

#### Example Request:
```bash
curl -X GET http://localhost:3000/payments/booking/713e2bb9-2e11-419b-a01b-bf42b322a450 \
  -H "Authorization: Bearer <USER_TOKEN>"
```

#### Example Response (`200 OK`):
```json
{
  "id": "a45f9e21-50e3-4c91-b1e0-08d132a76f23",
  "bookingId": "713e2bb9-2e11-419b-a01b-bf42b322a450",
  "providerPaymentId": "pay_stripe_sim_90124",
  "amount": 450.0,
  "status": "SUCCESS",
  "createdAt": "2026-09-26T10:55:00.000Z",
  "updatedAt": "2026-09-26T10:55:00.000Z"
}
```

---

### 6.3 Payment Gateway Webhook Receiver (Idempotent)
- **Endpoint**: `POST http://localhost:3000/payments/webhook`
- **Authentication**: None (Public gateway endpoint)
- **Rate Limit**: 100 requests per minute
- **What It Does**:
  1. Validates webhook payload schema via Zod (`eventId`, `eventType`, `data.bookingId`, `data.providerPaymentId`, `data.status`).
  2. Deduplicates using a unique database constraint on `PaymentWebhookEvent.providerEventId`.
  3. First delivery: records event, records payment, and confirms booking in an atomic transaction (`status: "processed"`).
  4. Duplicate / replayed deliveries: safely acknowledged without creating duplicate payments (`status: "already_processed"`).
  5. Concurrent webhook bursts: PostgreSQL unique constraint safely serializes races.

#### Example Request:
```bash
curl -X POST http://localhost:3000/payments/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "evt_razorpay_998811",
    "eventType": "payment.succeeded",
    "data": {
      "bookingId": "713e2bb9-2e11-419b-a01b-bf42b322a450",
      "providerPaymentId": "pay_gw_998811",
      "status": "SUCCESS"
    }
  }'
```

#### First Delivery Response (`200 OK`):
```json
{
  "received": true,
  "status": "processed",
  "eventId": "evt_razorpay_998811",
  "paymentId": "a45f9e21-50e3-4c91-b1e0-08d132a76f23",
  "bookingId": "713e2bb9-2e11-419b-a01b-bf42b322a450",
  "bookingStatus": "CONFIRMED"
}
```

#### Repeated Delivery Response (`200 OK` — Zero duplicate side-effects):
```json
{
  "received": true,
  "status": "already_processed",
  "eventId": "evt_razorpay_998811",
  "paymentId": "a45f9e21-50e3-4c91-b1e0-08d132a76f23"
}
```

---

## 7. Standard Error Response Specification

All API errors return a standard envelope:

```json
{
  "error": {
    "code": "<ERROR_CODE>",
    "message": "<HUMAN_READABLE_MESSAGE>"
  }
}
```

### Common Error Codes Reference:

| HTTP Status | Error Code | Trigger Condition |
| :--- | :--- | :--- |
| `400 Bad Request` | `VALIDATION_ERROR` | Request payload fails Zod schema validation (e.g. malformed UUID, negative price, past appointment date). |
| `401 Unauthorized` | `UNAUTHORIZED` | Missing or malformed `Authorization: Bearer <token>` header, or expired token. |
| `401 Unauthorized` | `INVALID_CREDENTIALS` | Incorrect email or password during login. |
| `403 Forbidden` | `FORBIDDEN` | Accessing another patient's booking or attempting admin mutations with `USER` role. |
| `404 Not Found` | `USER_NOT_FOUND` | User ID does not exist. |
| `404 Not Found` | `CENTRE_NOT_FOUND` | Diagnostic centre does not exist. |
| `404 Not Found` | `TEST_NOT_FOUND` | Diagnostic test catalogue entry does not exist. |
| `404 Not Found` | `CENTRE_TEST_NOT_FOUND` | The requested test is not offered by the specified diagnostic centre. |
| `404 Not Found` | `BOOKING_NOT_FOUND` | Booking ID does not exist. |
| `404 Not Found` | `PAYMENT_NOT_FOUND` | No payment record exists for the given booking ID. |
| `409 Conflict` | `USER_ALREADY_EXISTS` | Attempting to signup with an email already registered. |
| `409 Conflict` | `CENTRE_TEST_ALREADY_EXISTS`| Attempting to link the same test to a centre twice. |
| `409 Conflict` | `BOOKING_SLOT_UNAVAILABLE` | Concurrency lock hit — the appointment slot is already actively booked. |
| `409 Conflict` | `INVALID_BOOKING_STATE` | Attempting invalid transition (e.g. cancelling an already confirmed or cancelled booking). |
| `409 Conflict` | `DUPLICATE_PAYMENT` | Payment with this `providerPaymentId` or for this booking already exists. |
| `409 Conflict` | `PAYMENT_ALREADY_PROCESSED`| Booking is already paid and confirmed. |
| `409 Conflict` | `PAYMENT_CONFLICT` | Webhook status conflicts with already finalized payment. |
| `429 Too Many Requests` | `RATE_LIMIT_EXCEEDED` | Request threshold exceeded on rate-limited endpoints. |
| `500 Internal Error` | `INTERNAL_SERVER_ERROR`| Unhandled server exception. |
