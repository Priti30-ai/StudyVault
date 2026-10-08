import mongoose from 'mongoose';

/**
 * Connect to MongoDB database
 * Reads MONGODB_URI from environment variables
 */
export const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('❌ MONGODB_URI is not defined in environment variables.');
    throw new Error('MONGODB_URI environment variable is required');
  }

  try {
    const conn = await mongoose.connect(uri);
    console.log(`📦 MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    throw error;
  }
};

/**
 * Disconnect from MongoDB database (useful for graceful shutdown and tests)
 */
export const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    console.log('📦 MongoDB Disconnected');
  } catch (error) {
    console.error(`❌ MongoDB Disconnect Error: ${error.message}`);
  }
};

export default connectDB;
