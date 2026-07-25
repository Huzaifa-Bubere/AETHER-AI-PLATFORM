/**
 * Thin wrapper around your existing Cloudinary config.
 * ADAPT: import your already-configured `cloudinary` instance from wherever
 * your resume-upload code sets it up (per your report, this already exists
 * for resume storage) instead of re-configuring it here.
 */
import { v2 as cloudinary } from 'cloudinary';
import streamifier from 'streamifier';

export interface UploadResult {
  url: string;
  publicId: string;
}

export function uploadQuestionImage(buffer: Buffer, folder = 'smart-interview-ai/aptitude-questions'): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image' },
      (error, result) => {
        if (error || !result) return reject(error || new Error('Cloudinary upload failed'));
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

export function deleteQuestionImage(publicId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(publicId, (error) => {
      if (error) return reject(error);
      resolve();
    });
  });
}
