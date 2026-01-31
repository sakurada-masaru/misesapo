/**
 * POST /upload-url 参照実装（Node / Lambda 等）
 *
 * 前提: @aws-sdk/client-s3, @aws-sdk/s3-request-presigner
 * 環境変数: UPLOAD_BUCKET, AWS_REGION, (任意) CLOUDFRONT_DOMAIN
 *
 * - key: reports/{date}/{uuid}_{sanitized_filename}
 * - Presign 条件に Content-Type を含める
 * - fileUrl: S3 直 or CloudFront（CLOUDFRONT_DOMAIN があれば CloudFront）
 */

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { randomUUID } = require('crypto');

const bucket = process.env.UPLOAD_BUCKET || process.env.S3_REPORTS_BUCKET;
const region = process.env.AWS_REGION || 'ap-northeast-1';
const cloudFrontDomain = process.env.CLOUDFRONT_DOMAIN; // 例: d1234abcd.cloudfront.net

const s3 = new S3Client({ region });

function sanitizeFilename(filename) {
  if (!filename || typeof filename !== 'string') return 'file';
  const base = filename.replace(/^.*[/\\]/, '').replace(/[^\w\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf.\-]/g, '_');
  return base.slice(0, 200) || 'file';
}

async function handleUploadUrl(body) {
  const { filename, mime, size, context, date, storeIndex } = body;
  const uuid = randomUUID();
  const safeName = sanitizeFilename(filename);
  const key = `reports/${date}/${uuid}_${safeName}`;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: mime || 'application/octet-stream',
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

  let fileUrl;
  if (cloudFrontDomain) {
    fileUrl = `https://${cloudFrontDomain.replace(/^https?:\/\//, '')}/${key}`;
  } else {
    fileUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  }

  return { uploadUrl, fileUrl, key };
}

// Lambda ハンドラ例
// exports.handler = async (event) => {
//   const body = JSON.parse(event.body || '{}');
//   const result = await handleUploadUrl(body);
//   return { statusCode: 200, body: JSON.stringify(result) };
// };

module.exports = { handleUploadUrl, sanitizeFilename };
