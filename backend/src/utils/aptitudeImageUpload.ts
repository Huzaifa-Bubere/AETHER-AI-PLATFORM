import { v2 as cloudinary } from 'cloudinary';
import streamifier from 'streamifier';
import logger from './logger';

export interface UploadResult {
  url: string;
  publicId: string;
}

function ensureCloudinaryConfig() {
  if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
  }
}

export function uploadQuestionImage(buffer: Buffer, folder = 'smart-interview-ai/aptitude-questions'): Promise<UploadResult> {
  return new Promise((resolve) => {
    try {
      ensureCloudinaryConfig();
      if (!process.env.CLOUDINARY_CLOUD_NAME) {
        // Fallback to data URI for local/offline environments
        const dataUrl = `data:image/png;base64,${buffer.toString('base64')}`;
        return resolve({ url: dataUrl, publicId: `local_${Date.now()}` });
      }

      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: 'image' },
        (error, result) => {
          if (error || !result) {
            logger.warn('Cloudinary upload failed, falling back to data URL:', error?.message);
            const dataUrl = `data:image/png;base64,${buffer.toString('base64')}`;
            return resolve({ url: dataUrl, publicId: `local_${Date.now()}` });
          }
          resolve({ url: result.secure_url, publicId: result.public_id });
        }
      );
      streamifier.createReadStream(buffer).pipe(stream);
    } catch (err: any) {
      logger.warn('Cloudinary stream error, falling back to data URL:', err?.message);
      const dataUrl = `data:image/png;base64,${buffer.toString('base64')}`;
      resolve({ url: dataUrl, publicId: `local_${Date.now()}` });
    }
  });
}

export function deleteQuestionImage(publicId: string): Promise<void> {
  return new Promise((resolve) => {
    if (!publicId || publicId.startsWith('local_')) {
      return resolve();
    }
    ensureCloudinaryConfig();
    cloudinary.uploader.destroy(publicId, (error) => {
      if (error) logger.debug('Cloudinary destroy error:', error);
      resolve();
    });
  });
}

