# Project Guide

## `mobile/`
Universal React Native + Expo client used by Web, Android, and iOS.

### `mobile/app/`
Expo Router screens:
- `_layout.jsx` - stable application providers and route container
- `index.jsx` - sends authenticated users to Dashboard and other users to Sign In
- `login.jsx` - existing-account sign in + Forgot Password link
- `signup.jsx` - new account creation, role selection, supervisor selection, Gmail OTP
- `forgot-password.jsx` - @dev.com recovery and Gmail OTP recovery
- `dashboard.jsx` - role-specific dashboard/navigation
- `attendance.jsx` - GPS check-in/check-out and coordinate display
- `leave.jsx` - leave calendar, suggestions, reason rephrasing
- `history.jsx` - preset/custom attendance history with calendars and GPS
- `profile.jsx` - profile display, photo upload, editable name/phone
- `management.jsx` - leave approval page for Managers/Heads
- `admin.jsx` - Head-only organization/account/role administration
- `notifications.jsx` - in-app notifications

### `mobile/src/components/`
Reusable UI such as buttons, inputs, responsive Screen container, PageHeader/back button, and cross-platform calendar picker.

### `mobile/src/context/`
- `AuthContext.jsx` - login state/token restoration
- `ThemeContext.jsx` - persistent light/dark mode

### `mobile/src/services/`
- `api.js` - Axios API client
- `offlineAttendance.js` - offline attendance queue/sync

## `server/`
Node.js/Express REST API.

### `server/prisma/schema.prisma`
PostgreSQL relational schema for:
- User
- Department
- Team
- Attendance
- LeaveRequest
- Notification
- AuditLog
- OtpCode

### `server/src/routes/`
- `auth.routes.js` - signup/login/Gmail OTP/forgot password
- `attendance.routes.js` - check in/out/history
- `dashboard.routes.js` - dashboard summary
- `leave.routes.js` - create/view leave requests
- `management.routes.js` - approvals, users, role changes, reassignment
- `organization.routes.js` - department/team management
- `profile.routes.js` - profile name/phone/photo
- `notifications.routes.js` - notification feed
- `assist.routes.js` - leave reason writing assistant

## Data ownership

Creating or editing a profile does not write JavaScript source files. Runtime user data is written to PostgreSQL through the REST API and Prisma.
