import jwt from 'jsonwebtoken';

/**
 * Generate a JWT token for a given user ID
 * @param {string} userId - User's MongoDB ID
 * @returns {string} Signed JWT token
 */
export const generateToken = (userId) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not defined');
  }

  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

  return jwt.sign({ userId }, secret, { algorithm: 'HS256', expiresIn });
};

/**
 * Verify and decode a JWT token
 * @param {string} token - JWT token string
 * @returns {object} Decoded token payload
 */
export const verifyToken = (token) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not defined');
  }

  return jwt.verify(token, secret, { algorithms: ['HS256'] });
};

export default {
  generateToken,
  verifyToken
};
