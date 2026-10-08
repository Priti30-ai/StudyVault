import { S3Client } from '@aws-sdk/client-s3';

const region = process.env.AWS_REGION || 'ap-south-1';
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

const clientConfig = {
  region
};

// If explicit credentials are provided in env, use them;
// otherwise AWS SDK falls back to IAM Task Roles (ideal for ECS Fargate).
if (accessKeyId && secretAccessKey) {
  clientConfig.credentials = {
    accessKeyId,
    secretAccessKey
  };
}

export const s3Client = new S3Client(clientConfig);
export const S3_BUCKET = process.env.AWS_S3_BUCKET;

export default s3Client;
