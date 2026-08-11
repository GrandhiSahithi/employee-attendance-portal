# Employee Attendance & Leave Management Portal

A full-stack workforce portal built with React Native + Expo for Web, Android, and iOS, backed by Node.js/Express REST APIs and PostgreSQL/Prisma.

## Core roles

### Employee
- Sign up / sign in
- GPS check-in and check-out
- View exact check-in/check-out latitude and longitude
- Apply for Casual, Sick, or Vacation leave
- Calendar-based leave dates with past dates blocked
- Leave reason suggestions and Rephrase Reason writing assistant
- Attendance history: last 7 days, last 30 days, or custom calendar range
- View check-in/out time, working hours, and GPS coordinates
- View/edit name and phone number
- Upload/change profile picture
- Notifications

### Manager
- Sign up / sign in
- Apply for personal leave
- Review direct employees' pending leave
- Approve/reject leave
- First authorized leave decision is final
- Notifications
- View/edit personal profile and photo
- Cannot create accounts or change organization roles

### Head Manager
- All personal profile/leave features
- Review eligible employee/manager/head leave requests
- Organization Administration
- Create internal @dev.com accounts
- Create departments and teams/sections
- Assign/reassign employees to managers
- Assign/reassign managers to heads
- Change another user's role after account creation
- Change department, team, job title, and supervisor
- Activate/deactivate accounts
- Audit-log backed administrative changes

## Organization hierarchy

The hierarchy is stored in PostgreSQL rather than hard-coded:

```text
Head Manager
  └── Manager
       └── Employee
```

There can be many Head Managers, Managers, Employees, Departments, and Teams/Sections.

## Authentication and account rules

- Email and Employee ID are unique in PostgreSQL.
- Supported account emails: `@dev.com` and `@gmail.com`.
- `@dev.com` is the internal/demo domain and does not require email delivery.
- `@gmail.com` signup requires a six-digit OTP sent to that Gmail mailbox.
- A Gmail profile is created only after the OTP is entered successfully.
- The first account automatically becomes the first Head Manager.
- After initial setup, public Sign Up can create Employee, Manager, or Head Manager profiles.
- Employees select a Manager. Managers select a Head Manager. Head Managers have no supervisor.
- Head Managers can also create internal `@dev.com` accounts through Organization Administration.

### Forgot Password

- `@dev.com`: enter the account email, linked Employee ID, and a new password.
- `@gmail.com`: receive an OTP by email, enter the OTP, then set a new password.

For Gmail OTPs, configure `GMAIL_USER` and `GMAIL_APP_PASSWORD` in `server/.env`. Gmail SMTP does not require a paid API. The sender Gmail account must have an App Password configured.

## Attendance

Each attendance record stores:
- Work date
- Check-in date/time
- Check-in latitude
- Check-in longitude
- Check-out date/time
- Check-out latitude
- Check-out longitude
- Calculated total working time

The database has a unique constraint on `(userId, workDate)`, preventing multiple check-ins for the same employee on the same day.

Offline attendance actions are queued in AsyncStorage and synchronized when connectivity returns.

## Leave management

Leave types:
- Casual
- Sick
- Vacation

Rules:
- Reason is mandatory.
- From Date cannot exceed To Date.
- Past dates are rejected by both UI and REST API.
- Overlapping pending/approved leave requests are blocked.
- Leave balance is checked before submission and again before approval.
- Unpaid leave is not included.

Approval routing:
- Employee request → direct Manager + that Manager's Head Manager.
- Manager request → assigned Head Manager.
- Head Manager request → other active Head Managers.
- A user cannot approve their own leave.
- The first authorized approve/reject action is final and is enforced atomically in PostgreSQL.

## Leave writing assistant

The Leave page includes contextual suggestions plus a **Rephrase Reason** action.

By default it uses a built-in no-cost writing assistant, so no external AI API is required. Optionally, set `OLLAMA_URL` and `OLLAMA_MODEL` in `server/.env` to use a local Ollama model.

## Technology stack

### Client
- React Native
- Expo
- Expo Router
- JavaScript
- Axios
- AsyncStorage
- Expo Location
- Expo Image Picker
- NetInfo

### Server
- Node.js
- Express
- Prisma ORM
- PostgreSQL
- JWT
- bcryptjs
- Zod
- Multer
- Nodemailer for Gmail OTP

### Architecture
- Component/service/context separation on the client
- REST route/middleware/data-layer separation on the server
- Relational PostgreSQL data model
- Role-based access control
- Audit logging for administrative changes

## Quick start

See [RUN_PROJECT.md](RUN_PROJECT.md) for step-by-step commands.
