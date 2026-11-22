# Admin API

All endpoints below are mounted under `/api/admin` and require a bearer JWT with the `admin` role. Successful responses use `{ "status": "success", "data": ... }`; validation and request errors use `{ "status": "error", "message": ..., "errors"?: [...] }`. List endpoints return `items` and `pagination`.

## Route groups

- Dashboard: `GET /dashboard`, `/dashboard/metrics`, `/dashboard/recent-activity`
- Tokens: `GET /tokens`, `/tokens/:id`; `PATCH /tokens/:id/status`; `POST /tokens/:id/call`, `/skip`, `/complete`, `/cancel`
- Queues: `GET /queues`, `/queues/:departmentId`; `PATCH /queues/:departmentId`; `POST /queues/:departmentId/call-next`
- Counters: `GET /counters`, `/counters/:id`; `POST /counters`; `PATCH /counters/:id`, `/status`; `DELETE /counters/:id`
- Appointments: `GET /appointments`, `/appointments/:id`; `PATCH /appointments/:id/status`; `POST /appointments/:id/approve`, `/reschedule`, `/cancel`, `/complete`
- Reports: `GET /reports/overview`, `/queues`, `/departments`, `/waiting-times`, `/appointments`
- Departments: `GET /departments`, `/departments/:id`; `POST /departments`; `PATCH` and `DELETE /departments/:id`
- Settings: `GET /settings`, `PATCH /settings`
- Own admin profile: `GET /profile`, `PATCH /profile` (only full name and phone number are editable)
- Own notification preferences: `GET /notification-preferences`, `PATCH /notification-preferences`
- AI insights: `GET /ai-insights/overview`, `/peak-hours`, `/department-performance`, `/wait-time-analysis`, `/recommendations`; `POST /ai-insights/refresh`

`PATCH /api/auth/change-password` requires a bearer token and the current password. A successful change updates the password hash and password-change timestamp, revokes the current token, and invalidates older access tokens.

`GET /api/public/statistics?period=today|7d|30d` is unauthenticated and returns only aggregate queue/counter/department figures. Responses are cached for 60 seconds.

Token booking accepts optional `preferredVisitDate` (`YYYY-MM-DD`), `preferredTime` (`HH:mm`), and `visitType` (`New Consultation`, `Follow-up`, or `Emergency`). These fields must be submitted together. Older clients can continue submitting only `departmentId`.

List filters support `page`, `limit`, `search`, `departmentId`, `status`, `from`, and `to` where relevant. Report date filters use inclusive `YYYY-MM-DD` dates.

## AI Insights

All five GET routes require an optional `departmentId` query parameter to be a valid MongoDB ObjectId and return the same backwards-compatible response payload. It keeps `dataSource`, `peakHours`, `waiting`, `departmentPerformance`, and `recommendations`, and adds:

- `analysis`: provider (`gemini` or `rule-based`), model where relevant, ISO timestamp, and a safe fallback reason.
- `generatedAnalysis`: optional Gemini summary and department notes. It is null during fallback.
- `peakPeriodAnalysis`: historical busiest hours/days and a weekday average only after at least 28 token-active days and 100 tokens have been observed in the bounded 90-day window. Otherwise its status is `insufficient-historical-data`.
- `waitTimeAnalysis`: department estimates, contributing queue/counter factors, confidence and timestamp. At least 20 valid completed service-duration samples and an active counter are required to derive an estimate from `servingAt` to `completedAt`. Otherwise the endpoint returns the existing stored-estimate fallback with low confidence. These are estimates, not guarantees.
- `operationalSummary`: MongoDB aggregates for active counters, appointment totals/completion/cancellation rates, and token completion/cancellation rates.
- `queuePressure`: per-department waiting tokens per active counter, labeled low/medium/high using fixed operational thresholds.
- `historicalQueueTrend`: up to 30 daily points in the 90-day window with token volume, waiting, completed, and cancelled counts.

Recommendations include a suggested action, supporting aggregate metrics, source, and a qualitative reliability level. Gemini only suggests actions; it cannot change operational records. Gemini-derived prose is schema-validated, numeric claims in prose are rejected, and evidence keys must map to metrics in the request snapshot.

`POST /api/admin/ai-insights/refresh` accepts an optional JSON `departmentId` and bypasses the two-minute cache. AI insight routes are admin-only, validate query/body inputs, and share a configurable per-IP rate limit. Gemini timeouts, network failures, rejected requests, unsupported model IDs, provider errors, quota responses, invalid output, and missing configuration return rule-based results with an explicit fallback reason. Gemini receives bounded aggregate counts and sanitized department labels only; it receives no citizen identifiers, names, contact details, credentials, or token numbers.

The token schema does not store an actual citizen wait duration. It does store `servingAt` and `completedAt`; only valid elapsed durations between these timestamps are used as service-duration samples. Stored `estimatedWaitingTime` remains explicitly labeled as an estimate when actual service-duration history is insufficient.
