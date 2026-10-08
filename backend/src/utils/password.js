import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

/**
 * Hash a plain text password using bcryptjs
 * @param {string} password - Raw password
 * @returns {Promise<string>} Hashed password
 */
export const hashPassword = async (password) => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

/**
 * Compare candidate password with stored hash
 * @param {string} candidatePassword - Plain text candidate password
 * @param {string} hash - Stored password hash
 * @returns {Promise<boolean>} True if match, false otherwise
 */
export const comparePassword = async (candidatePassword, hash) => {
  return bcrypt.compare(candidatePassword, hash);
};

export default {
  hashPassword,
  comparePassword
};
