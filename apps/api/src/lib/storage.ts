import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({
  region: process.env.S3_REGION || 'auto',
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true, // Required for R2 / MinIO
});

const bucket = process.env.S3_BUCKET || 'varyn';

// Key scheme: {prefix}/{projectId}/{uuid}-{filename}
// e.g. datasets/proj_abc123/d5f2a-sales.csv
//      plots/proj_abc123/run_x-scatter.png

export async function uploadBuffer(key: string, body: Buffer, contentType: string): Promise<void> {
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
}

export async function getDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
  return getSignedUrl(s3, new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  }), { expiresIn });
}

export async function getUploadUrl(key: string, contentType: string, expiresIn = 600): Promise<string> {
  return getSignedUrl(s3, new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  }), { expiresIn });
}
