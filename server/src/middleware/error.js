/**
 * Error Handling Middleware
 * =========================
 * Central 404 handler and catch-all error handler, registered last in
 * index.js (after all routes) so they catch anything not otherwise handled.
 */

/**
 * 404 handler for any request that didn't match a registered route.
 * Registered after all app.use(...) route mounts in index.js.
 */
export function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

/**
 * Express catch-all error handler (4-arg signature required by Express to
 * be recognized as an error handler). Maps a few known error shapes
 * (Multer file-size limit, upload file-type rejection) to friendly 400
 * responses, and otherwise falls back to the error's own status/message
 * or a generic 500.
 */
export function errorHandler(error, _req, res, _next) {
  console.error(error);
  if (error?.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ message: 'Profile picture must be 5 MB or smaller.' });
  if (error?.message === 'Only image files are allowed.') return res.status(400).json({ message: error.message });
  return res.status(error.status || 500).json({ message: error.message || 'Internal server error.' });
}
