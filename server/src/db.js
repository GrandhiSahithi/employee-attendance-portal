/**
 * Database Client
 * ===============
 * Exports Prisma client instance for database access
 * Used throughout the server to query the PostgreSQL database
 */

import { PrismaClient } from '@prisma/client';

/**
 * Prisma Client instance
 * Configured via DATABASE_URL environment variable
 * Handles all database operations with type safety
 */
export const prisma = new PrismaClient();
