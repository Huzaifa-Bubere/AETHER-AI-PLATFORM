import { v2 as cloudinary } from 'cloudinary';
import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { invalidInput } from '../middleware/aptitudeValidation';

export const questionImageDirectory = path.resolve(__dirname, '../../uploads/aptitude');
export interface UploadResult { url: string; publicId: string }

export async function uploadQuestionImage(buffer: Buffer): Promise<UploadResult> {
  let normalized: Buffer;
  try {
    const input = sharp(buffer, { limitInputPixels: 25000000 });
    const metadata = await input.metadata();
    if (!['jpeg', 'png', 'webp', 'gif'].includes(metadata.format || '')) invalidInput('Use a PNG, JPEG, WebP or GIF image.');
    normalized = await input.rotate().webp({ quality: 90 }).toBuffer();
  } catch { return invalidInput('The uploaded file is not a valid supported image.'); }
  if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
    cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET, secure: true });
    try {
      return await new Promise<UploadResult>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({ folder: 'smart-interview-ai/aptitude-questions', resource_type: 'image', timeout: 10000 },
          (error, result) => error || !result ? reject(error) : resolve({ url: result.secure_url, publicId: result.public_id }));
        stream.on('error', reject);
        stream.end(normalized);
      });
    } catch { /* Keep local development usable when optional cloud storage is unavailable. */ }
  }
  // Store each image once; embedding 100 images in an attempt can exceed MongoDB's document limit.
  await fs.mkdir(questionImageDirectory, { recursive: true });
  const name = `${randomUUID()}.webp`;
  await fs.writeFile(path.join(questionImageDirectory, name), normalized);
  return { url: `/api/aptitude/images/${name}`, publicId: `disk:${name}` };
}

export async function deleteQuestionImage(publicId: string): Promise<void> {
  if (publicId.startsWith('disk:')) {
    const name = publicId.slice(5);
    if (/^[a-f0-9-]{36}\.webp$/.test(name)) await fs.unlink(path.join(questionImageDirectory, name)).catch(() => {});
    return;
  }
  if (!publicId.startsWith('smart-interview-ai/aptitude-questions/')) return;
  await cloudinary.uploader.destroy(publicId).catch(() => {});
}
