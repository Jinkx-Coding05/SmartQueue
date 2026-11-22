# Backend authentication

Copy `.env.example` to `.env` in this directory and configure the Atlas URI and a random `JWT_SECRET` of at least 32 bytes. Never copy backend secrets into frontend environment files.

Run the API with `npm run server:dev`. Access tokens are signed HS256 JWTs with a 15 minute default lifetime. Authenticated requests use `Authorization: Bearer <access-token>`. Logout revokes the token in MongoDB until its expiry; clients should also discard the token immediately.

## Authentication endpoints

- `POST /api/auth/register`
- `POST /api/auth/verify-otp`
- `POST /api/auth/resend-otp`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

## Citizen endpoints

- `GET /api/citizen/profile`, `PATCH /api/citizen/profile`
- `GET /api/departments`, `GET /api/departments/:id` (public active-department catalog)
- `POST /api/tokens`, `GET /api/tokens/my`, `GET /api/tokens/:id`, `POST /api/tokens/:id/cancel`, `GET /api/tokens/:id/tracking`
- `POST /api/appointments`, `GET /api/appointments/my`, `GET /api/appointments/:id`, `PATCH /api/appointments/:id`, `POST /api/appointments/:id/cancel`
- `POST /api/documents`, `GET /api/documents/my`, `DELETE /api/documents/:id`
- `GET /api/notifications/my`, `PATCH /api/notifications/:id/read`, `PATCH /api/notifications/read-all`

Citizen endpoints require a citizen JWT. Lists accept `page` and `limit` (maximum 50); notifications also accept `unreadOnly=true`. Appointment dates, daily queues, and department working hours use `HOSPITAL_TIME_ZONE` (default `Asia/Kolkata`). Appointment availability is checked against active departments, counters, configured working hours, and existing citizen bookings. Queue position counts saved waiting tokens; the displayed wait estimate uses saved estimates from active queue records and is not a live prediction.

Document requests accept metadata only. Until secure external storage is configured, records use `storageStatus: metadata-only`; no bytes are persisted and the API does not claim that a file was uploaded.

Email/SMS delivery is not configured. Registration creates an unverified account and login is denied until its one-time code is verified. Before production, implement `OtpDeliveryProvider` in `src/services/otpDelivery.ts` using an approved transactional email or SMS provider, verify the sending domain/number and templates, configure server-side credentials and delivery webhooks, retain the existing one-time expiry and rate limits, and keep OTP values and message contents out of logs. Password reset similarly requires an email provider and verified sender. In a local development environment only, `AUTH_OTP_EXPOSE=true` and `AUTH_RESET_TOKEN_EXPOSE=true` return temporary codes in API responses; both flags are rejected unless `NODE_ENV=development` and must remain disabled in production.

## Initial administrator

Set `ADMIN_FULL_NAME`, `ADMIN_EMAIL`, `ADMIN_PHONE`, and `ADMIN_PASSWORD` in `server/.env`, then run `npm run admin:provision`. The script connects to Atlas, hashes the password, and creates an admin account with verified email. It does not print the password or hash.

Authentication tests use an isolated in-memory repository and do not read, delete, or modify Atlas records.

## Isolated Atlas test data

For live development checks, use a separate Atlas database whose database name ends in `_test`, such as `smartqueue_ai_test`. In `server/.env`, configure `MONGODB_TEST_URI`, `ALLOW_TEST_DATA_SEEDING=true`, and distinct `TEST_ADMIN_*` and `TEST_CITIZEN_*` credentials. Keep the test URI's Atlas database user scoped to that test database. The seed and cleanup scripts only run in development with the explicit opt-in, reject a URI that targets the same cluster database as `MONGODB_URI`, and never print credentials. `TEST_MONGODB_URI` remains supported as a legacy alias.

Provision only accounts that do not already exist. If a matching email or phone belongs to an unmarked or different-role user, seeding stops without changing that user. Test accounts are marked in MongoDB; `npm run test-accounts:remove` removes only marked test accounts and records owned by those accounts from the isolated database. It does not clear the whole database or remove unmarked users. Do not use test credentials on the normal application database.

## Document storage roadmap

Current document handling keeps file bytes and previews in the browser session; the backend stores metadata only and reports `storageStatus: metadata-only`. Permanent uploads require an explicitly configured provider, private bucket/container, server-side credentials, access controls, encryption in transit and at rest, upload size/type validation, malware scanning, retention/deletion rules, audit events, and short-lived authorized download links. Implement and test those controls before describing uploads as permanent.

## Gemini AI Insights

Gemini enhancement is optional. Set `GEMINI_API_KEY` in `server/.env` to enable it; `GEMINI_MODEL` defaults to `gemini-3.8-flash`. The key is used only by the backend. The service uses Google's `generateContent` REST endpoint with a bounded request timeout, `responseJsonSchema` validation, safe status/category/duration diagnostics, a two-minute per-department cache, and a per-IP rate limit. If the key is absent or the provider times out, fails, or returns invalid output, the admin API continues using MongoDB-backed rule analytics and identifies the fallback in `analysis.provider` and `analysis.fallbackReason`.

Gemini input is limited to aggregated queue/counter metrics, appointment and token lifecycle counts/rates, daily queue trends, and sanitized department labels. No citizen profile fields, token numbers, contact details, credentials, or appointment notes are sent. Numerical wait estimates and weekday averages are calculated by the backend from saved records. Actual service duration is derived only from valid `servingAt` to `completedAt` intervals; insufficient samples use stored wait estimates and are labeled as low-confidence fallback. Historical weekday forecasts require at least 28 token-active days and 100 tokens in the last 90 days. They are descriptive estimates and not guarantees. Transient server/network errors receive one short retry; quota errors do not retry and all provider failures retain the rule-based fallback.
