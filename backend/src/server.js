import 'dotenv/config';
import app from './app.js';

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

const server = app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`🚀 StudyVault Backend API Server`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`⚙️  Environment: ${NODE_ENV}`);
  console.log(`🩺 Health: http://localhost:${PORT}/api/health`);
  console.log(`=========================================`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  server.close(() => process.exit(1));
});

export default server;
