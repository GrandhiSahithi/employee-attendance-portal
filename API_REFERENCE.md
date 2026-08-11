# REST API Reference

Base URL: `/api`

## Authentication

- `GET /auth/setup-status`
- `GET /auth/signup-options`
- `POST /auth/signup/request-otp` - sends signup OTP to Gmail
- `POST /auth/signup` - creates account
- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/forgot-password/request`
- `POST /auth/forgot-password/reset`

## Dashboard

- `GET /dashboard`

## Attendance (Employee)

- `GET /attendance/today`
- `POST /attendance/check-in`
- `POST /attendance/check-out`
- `GET /attendance/history?range=7`
- `GET /attendance/history?range=30`
- `GET /attendance/history?from=YYYY-MM-DD&to=YYYY-MM-DD`

Attendance POST payload:

```json
{
  "latitude": 41.123456,
  "longitude": -73.123456,
  "capturedAt": "2026-08-11T15:30:00.000Z"
}
```

## Leave

- `POST /leaves`
- `GET /leaves/me`

## Leave writing assistant

- `POST /assist/rephrase`

## Profile

- `GET /profile`
- `PUT /profile` - editable `name` and `phone`
- `POST /profile/photo` - multipart profile photo upload

## Notifications

- `GET /notifications`
- `PATCH /notifications/:id/read`
- `PATCH /notifications/read-all`

## Organization

- `GET /organization/options`
- `POST /organization/departments` - Head only
- `POST /organization/teams` - Head only

## Management

Manager and Head:
- `GET /management/team`
- `GET /management/leaves/pending`
- `PATCH /management/leaves/:id`

Head only:
- `GET /management/users`
- `POST /management/users`
- `PATCH /management/users/:id/assignment`
- `PATCH /management/users/:id/role`
- `PATCH /management/users/:id/status`
