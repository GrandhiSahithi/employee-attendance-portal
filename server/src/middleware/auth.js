/**
 * Authentication Middleware
 * ========================
 * Protects routes that require user authentication
 * Validates JWT token and checks user permissions
 */

import jwt from 'jsonwebtoken';
import { prisma } from '../db.js';

/**
 * requireAuth Middleware
 * Verifies JWT token from Authorization header
 * Loads user data and adds to req.user
 * Returns 401 if token is invalid or user is inactive
 *
 * Usage: router.get('/route', requireAuth, handler)
 */
export async function requireAuth(req, res, next) {
  try {
    // Get Authorization header
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return res.status(401).json({ message: 'Authentication required.' });
    
    // Extract and verify token (Bearer <token>)
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    
    // Get user from database using token's subject (user ID)
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { department: true, team: true, supervisor: true },
    });
    
    // Check if user exists and is active
    if (!user || !user.isActive) return res.status(401).json({ message: 'User account is unavailable.' });
    
    // Attach user to request object for use in route handlers
    req.user = user;
    next();
  } catch {
    // Token expired or invalid
    return res.status(401).json({ message: 'Session expired or token is invalid.' });
  }
}

/**
 * requireRoles Middleware
 * Checks if authenticated user has one of the required roles
 * Returns 403 if user lacks permission
 *
 * Usage: router.get('/route', requireAuth, requireRoles('MANAGER', 'HEAD_MANAGER'), handler)
 *
 * @param {...string} roles - Allowed role names
 * @returns {function} Express middleware
 */
export function requireRoles(...roles) {
  return (req, res, next) => {
    // req.user should be set by requireAuth middleware
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to access this resource.' });
    }
    next();
  };
}
