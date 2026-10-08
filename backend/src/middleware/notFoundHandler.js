/**
 * 404 Not Found Middleware
 * Handles all requests targeting unregistered endpoints
 */
export const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
};

export default notFoundHandler;
