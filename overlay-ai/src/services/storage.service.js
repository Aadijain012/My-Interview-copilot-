const fs = require('fs');
const path = require('path');

let _s3Client = null;
let _bucket = null;

function getS3Client() {
  if (_s3Client) return _s3Client;

  const { S3Client } = require('@aws-sdk/client-s3');

  _s3Client = new S3Client({
    region: process.env.AWS_S3_REGION || 'ap-south-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  });

  _bucket = process.env.AWS_S3_BUCKET;

  if (!_bucket) {
    throw new Error('AWS_S3_BUCKET is required when SAVE_IN_S3=true');
  }
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error('AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are required when SAVE_IN_S3=true');
  }

  console.log(`[storage] S3 enabled — bucket: ${_bucket}, region: ${process.env.AWS_S3_REGION || 'ap-south-1'}`);
  return _s3Client;
}

function getBucket() {
  if (!_bucket) getS3Client();
  return _bucket;
}

function hasValidS3Credentials() {
  const bucket = (process.env.AWS_S3_BUCKET || '').trim();
  const accessKey = (process.env.AWS_ACCESS_KEY_ID || '').trim();
  const secretKey = (process.env.AWS_SECRET_ACCESS_KEY || '').trim();
  return Boolean(bucket && accessKey && secretKey);
}

let _loggedFallback = false;
function isS3Enabled() {
  const flag = process.env.SAVE_IN_S3 === 'true';
  if (!flag) return false;
  if (!hasValidS3Credentials()) {
    if (!_loggedFallback) {
      console.warn('[storage] SAVE_IN_S3=true but AWS credentials/bucket are missing or blank. Falling back to Local Storage.');
      _loggedFallback = true;
    }
    return false;
  }
  return true;
}

async function uploadToS3(localPath, s3Key) {
  const { PutObjectCommand } = require('@aws-sdk/client-s3');
  const client = getS3Client();
  const bucket = getBucket();

  const fileBuffer = fs.readFileSync(localPath);
  const ext = path.extname(localPath).toLowerCase();

  const mimeMap = {
    '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska', '.webm': 'video/webm', '.flv': 'video/x-flv',
    '.wmv': 'video/x-ms-wmv', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
    '.m4a': 'audio/mp4', '.ogg': 'audio/ogg'
  };

  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: s3Key,
    Body: fileBuffer,
    ContentType: mimeMap[ext] || 'application/octet-stream'
  }));

  const region = process.env.AWS_S3_REGION || 'ap-south-1';
  const s3Url = `https://${bucket}.s3.${region}.amazonaws.com/${s3Key}`;

  console.log(`[storage] Uploaded to S3: ${s3Key}`);
  return s3Url;
}

async function uploadFile(localPath, s3Key, localUrlFallback) {
  if (isS3Enabled()) {
    try {
      const url = await uploadToS3(localPath, s3Key);
      return { url, storageMode: 's3', s3Key };
    } catch (err) {
      console.error(`[storage] S3 upload failed for ${s3Key}, falling back to local:`, err.message);
      return { url: localUrlFallback, storageMode: 'local', s3Key: null };
    }
  }
  return { url: localUrlFallback, storageMode: 'local', s3Key: null };
}

function deleteLocalFile(localPath) {
  if (!localPath) return;
  try {
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
      console.log(`[storage] Deleted local file: ${localPath}`);
    }
  } catch (err) {
    console.warn(`[storage] Failed to delete local file ${localPath}:`, err.message);
  }
}

module.exports = {
  isS3Enabled,
  uploadFile,
  deleteLocalFile
};
