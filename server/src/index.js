/**
 * Employee Attendance Portal - API Server
 * ======================================
 * Main Express server application
 * Features:
 * - User authentication and authorization
 * - Attendance tracking with GPS
 * - Leave management and approvals
 * - Organization and team management
 * - Notifications
 * - Audit logging
 *
 * Database: PostgreSQL with Prisma ORM
 * Port: 4000 (or process.env.PORT)
 */

import 'dotenv/config';
import path from 'path';
import cors from 'cors';
import express from 'express';

// Import all route modules
import authRoutes from './routes/auth.routes.js';
import attendanceRoutes from './routes/attendance.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import leaveRoutes from './routes/leave.routes.js';
import managementRoutes from './routes/management.routes.js';
import assistRoutes from './routes/assist.routes.js';
import profileRoutes from './routes/profile.routes.js';
import organizationRoutes from './routes/organization.routes.js';
import notificationsRoutes from './routes/notifications.routes.js';

// Import error handling middleware
import { errorHandler, notFound } from './middleware/error.js';
import { startAutoCheckoutScheduler } from './jobs/autoCheckout.js';
import { startLeaveAccrualScheduler } from './jobs/leaveAccrual.js';

// Validate required environment variables
if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is missing. Copy .env.example to .env and set a secret.');

// Initialize Express app
const app = express();
const port = Number(process.env.PORT || 4000);

/**
 * Configure CORS (Cross-Origin Resource Sharing)
 * Allows requests from the client origin (mobile app, web dashboard)
 */
app.use(cors({ origin: process.env.CLIENT_ORIGIN === '*' ? true : process.env.CLIENT_ORIGIN }));

/**
 * Parse JSON request bodies
 * Limit to 2MB to prevent large uploads through API
 */
app.use(express.json({ limit: '2mb' }));

/**
 * Serve uploaded files as static assets
 * Files stored in ./uploads directory
 */
app.use('/uploads', express.static(path.resolve('uploads')));

/**
 * Health check endpoint
 * Used by monitoring services to verify server is running
 */
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'employee-portal-api' }));

/**
 * Register all API routes
 * Each route prefix corresponds to its domain
 */
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/assist', assistRoutes);
app.use('/api/management', managementRoutes);
app.use('/api/organization', organizationRoutes);
app.use('/api/notifications', notificationsRoutes);

/**
 * Error handling middleware
 * Must come after all routes
 */
app.use(notFound);           // Handle 404 - route not found
app.use(errorHandler);       // Handle all errors

/**
 * Start server
 * Listen on configured port
 */
app.listen(port, () => console.log(`Employee Portal API listening on http://localhost:${port}`));

/**
 * Automatically checks out employees at 5:00 PM in their check-in
 * timezone if they never checked out manually. See src/jobs/autoCheckout.js.
 */
startAutoCheckoutScheduler();

/**
 * Grants each active user their monthly leave accrual (replacing the old
 * flat yearly balance), capped by a carryover limit. See
 * src/jobs/leaveAccrual.js.
 */
startLeaveAccrualScheduler();
