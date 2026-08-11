# Run the Employee Attendance Portal

## 1. Requirements

Install:
- Node.js
- npm
- Docker Desktop
- VS Code

Check:

```bash
node -v
npm -v
docker --version
docker compose version
```

## 2. Start PostgreSQL

From the project root:

```bash
docker compose up -d postgres
```

Verify:

```bash
docker ps
```

## 3. Backend setup

```bash
cd server
cp .env.example .env
npm install
npx prisma migrate dev --name init
npx prisma db seed
npm run dev
```

Backend:

```text
http://localhost:4000
```

Health endpoint:

```text
http://localhost:4000/health
```

The seed intentionally creates zero login users. Use **Sign Up** in the app to create the first account. The first account becomes Head Manager.

## 4. Gmail OTP setup (only if testing @gmail.com)

Edit `server/.env`:

```env
GMAIL_USER=your-sender@gmail.com
GMAIL_APP_PASSWORD=your-google-app-password
```

Use a Gmail App Password, not the normal Gmail password.

If these values are blank, all `@dev.com` features still work, but Gmail signup/password-reset OTP sending will return a configuration message.

## 5. Mobile/Web setup

Open another terminal:

```bash
cd mobile
cp .env.example .env
npm install
npx expo-doctor
npx expo start
```

For web, open the `Web:` address printed by Expo, normally:

```text
http://localhost:8081
```

For Expo Go on a physical phone, edit `mobile/.env` and replace localhost with your Mac's local network IP:

```env
EXPO_PUBLIC_API_URL=http://192.168.x.x:4000/api
```

Restart Expo after changing `.env`:

```bash
npx expo start -c
```

## 6. First account

Choose **Sign Up**.

If the database has no users, the first profile automatically becomes Head Manager and creates the first Department and Team/Section.

You may use a demo internal email such as:

```text
name@dev.com
```

or a real Gmail address. Gmail requires OTP verification.

## Daily run after installation

You do not need `npm install` every time.

Terminal 1:

```bash
docker compose up -d postgres
cd server
npm run dev
```

Terminal 2:

```bash
cd mobile
npx expo start
```
