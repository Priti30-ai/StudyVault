/**
 * Centralized Error Handling Middleware
 * Catches unhandled errors, logs debugging info in development, and returns standardized response
 */
export const errorHandler = (err, req, res, next) => {
  // Handle Multer file size limit error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'File size exceeds the 10 MB limit'
    });
  }

  // Handle Multer or Busboy parsing errors (e.g. malformed part header, invalid multipart data)
  if (err.name === 'MulterError' || (err.message && err.message.includes('Malformed part header'))) {
    return res.status(400).json({
      success: false,
      message: 'Malformed file upload request'
    });
  }

  // Handle CORS origin rejection
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      message: 'CORS request blocked: Origin not allowed'
    });
  }

  const statusCode = err.statusCode || err.status || 500;

  // Log error on server for debugging (omit in test mode)
  if (process.env.NODE_ENV !== 'test') {
    console.error(`[Error] ${req.method} ${req.originalUrl}:`, err.message);
    if (process.env.NODE_ENV === 'development' && err.stack) {
      console.error(err.stack);
    }
  }

  let clientMessage = err.message && statusCode !== 500 ? err.message : 'Something went wrong';

  // Prevent leaking internal infrastructure or credentials strings
  if (
    clientMessage.toLowerCase().includes('mongodb') ||
    clientMessage.toLowerCase().includes('aws_') ||
    clientMessage.toLowerCase().includes('passwordhash')
  ) {
    clientMessage = 'An unexpected error occurred';
  }

  res.status(statusCode).json({
    success: false,
    message: clientMessage
  });
};

export default errorHandler;
