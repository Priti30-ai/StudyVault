import path from 'path';
import crypto from 'crypto';
import {
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client } from '../config/aws.js';

let s3Mock = null;
const devSimulatedStorage = new Map();

/**
 * Configure a mock handler for testing environments
 * @param {object|null} mock - Mock implementation
 */
export const setS3Mock = (mock) => {
  s3Mock = mock;
};

/**
 * Get current mock handler if configured
 */
export const getS3Mock = () => s3Mock;

/**
 * Checks if the environment is using placeholder development credentials
 */
const isMockDevMode = () => {
  return (
    process.env.AWS_ACCESS_KEY_ID === 'mock_dev_access_key' ||
    process.env.AWS_ACCESS_KEY_ID === 'your_access_key_id'
  );
};

/**
 * Generates a collision-resistant S3 storage key partitioned by user ID
 * Format: users/{userId}/{uuid}{extension}
 * @param {string} userId - Authenticated user's ObjectId
 * @param {string} originalFileName - Name of uploaded file
 * @returns {string} S3 object key
 */
export const generateS3Key = (userId, originalFileName) => {
  const rawExt = path.extname(originalFileName || '').toLowerCase();
  const cleanExt = rawExt.replace(/[^a-z0-9.]/g, '');
  const uniqueId = crypto.randomUUID();
  return `users/${userId}/${uniqueId}${cleanExt}`;
};

/**
 * Uploads a file buffer to private S3 bucket
 * @param {object} params
 * @param {Buffer} params.fileBuffer - Memory buffer of the file
 * @param {string} params.originalFileName - Original file name
 * @param {string} params.mimeType - MIME type
 * @param {string} params.userId - Authenticated user ID
 * @returns {Promise<{s3Key: string, bucket: string}>}
 */
export const uploadFile = async ({ fileBuffer, originalFileName, mimeType, userId }) => {
  if (s3Mock && typeof s3Mock.uploadFile === 'function') {
    return s3Mock.uploadFile({ fileBuffer, originalFileName, mimeType, userId });
  }

  const bucket = process.env.AWS_S3_BUCKET || 'studyvault-bucket';
  const s3Key = generateS3Key(userId, originalFileName);

  // Local development fallback if real AWS credentials are not configured yet
  if (isMockDevMode()) {
    devSimulatedStorage.set(s3Key, { fileBuffer, mimeType, originalFileName });
    return { s3Key, bucket };
  }

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: s3Key,
    Body: fileBuffer,
    ContentType: mimeType
  });

  await s3Client.send(command);

  return { s3Key, bucket };
};

/**
 * Deletes an object from S3
 * @param {string} s3Key - S3 object key
 * @returns {Promise<any>}
 */
export const deleteFile = async (s3Key) => {
  if (!s3Key) return;

  if (s3Mock && typeof s3Mock.deleteFile === 'function') {
    return s3Mock.deleteFile(s3Key);
  }

  const bucket = process.env.AWS_S3_BUCKET || 'studyvault-bucket';

  // Local development fallback
  if (isMockDevMode()) {
    devSimulatedStorage.delete(s3Key);
    return { success: true };
  }

  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: s3Key
  });

  return await s3Client.send(command);
};

/**
 * Generates a temporary presigned GET download URL for an S3 object
 * @param {string} s3Key - S3 object key
 * @param {number} expiresIn - Expiry duration in seconds (default: 300)
 * @returns {Promise<string>} Presigned URL
 */
export const generateDownloadUrl = async (s3Key, expiresIn = 300) => {
  if (s3Mock && typeof s3Mock.generateDownloadUrl === 'function') {
    return s3Mock.generateDownloadUrl(s3Key, expiresIn);
  }

  const bucket = process.env.AWS_S3_BUCKET || 'studyvault-bucket';
  const region = process.env.AWS_REGION || 'ap-south-1';

  // Local development fallback
  if (isMockDevMode()) {
    return `https://${bucket}.s3.${region}.amazonaws.com/${s3Key}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=${expiresIn}&X-Amz-Signature=devSimulationSignature`;
  }

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: s3Key
  });

  return await getSignedUrl(s3Client, command, { expiresIn });
};

export default {
  setS3Mock,
  getS3Mock,
  generateS3Key,
  uploadFile,
  deleteFile,
  generateDownloadUrl
};
