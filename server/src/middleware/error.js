export function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

export function errorHandler(error, _req, res, _next) {
  console.error(error);
  if (error?.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ message: 'Profile picture must be 5 MB or smaller.' });
  if (error?.message === 'Only image files are allowed.') return res.status(400).json({ message: error.message });
  return res.status(error.status || 500).json({ message: error.message || 'Internal server error.' });
}
