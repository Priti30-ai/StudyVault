/**
 * Centralized Error Handling Middleware
 * Catches unhandled errors, logs debugging info in development, and returns standardized response
 */
export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500;

  // Log error on server for debugging
  console.error(`[Error] ${req.method} ${req.originalUrl}:`, err.message);
  if (process.env.NODE_ENV === 'development' && err.stack) {
    console.error(err.stack);
  }

  res.status(statusCode).json({
    success: false,
    message: err.message && statusCode !== 500 ? err.message : 'Something went wrong'
  });
};

export default errorHandler;
