import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import logger from '../utils/logger';

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

class LocalStorageService {
  private uploadsDir: string;
  private baseUrl: string;
  private ready: Promise<void> | null = null;

  constructor() {
    this.uploadsDir = path.join(process.cwd(), 'uploads');
    this.baseUrl = process.env.BACKEND_URL || 'http://localhost:5001';
  }

  private async initialize(): Promise<void> {
    try {
      // Create uploads directory if it doesn't exist
      if (!fs.existsSync(this.uploadsDir)) {
        await mkdir(this.uploadsDir, { recursive: true });
        logger.info('✓ Local uploads directory created:', this.uploadsDir);
      }

      // Create subdirectories
      const subdirs = ['resumes', 'images', 'videos', 'audio'];
      for (const subdir of subdirs) {
        const subdirPath = path.join(this.uploadsDir, subdir);
        if (!fs.existsSync(subdirPath)) {
          await mkdir(subdirPath, { recursive: true });
        }
      }

      logger.info('✓ Local storage initialized successfully');
    } catch (error) {
      logger.error('Local storage initialization error:', error);
      throw new Error('Local file storage is unavailable.');
    }
  }

  private async ensureReady(): Promise<void> {
    if (!this.ready) this.ready = this.initialize().catch(error => { this.ready = null; throw error; });
    await this.ready;
  }

  async uploadResume(
    buffer: Buffer,
    options: {
      filename: string;
      userId: string;
    }
  ): Promise<{ secure_url: string; public_id: string }> {
    try {
      await this.ensureReady();
      const timestamp = `${Date.now()}_${require("crypto").randomUUID()}`;
      const sanitizedFilename = options.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filename = `resume_${options.userId}_${timestamp}_${sanitizedFilename}`;
      const filepath = path.join(this.uploadsDir, 'resumes', filename);

      // Save file to disk
      await writeFile(filepath, buffer);

      logger.info(`✓ File saved locally: ${filename}`);

      // Return Cloudinary-compatible response
      return {
        secure_url: `${this.baseUrl}/uploads/resumes/${filename}`,
        public_id: `resumes/${filename}`,
      };
    } catch (error: any) {
      logger.error('Local storage upload error:', error);
      throw new Error(`Local storage upload failed: ${error.message}`);
    }
  }

  async uploadVideo(
    buffer: Buffer,
    options: {
      filename: string;
      userId?: string;
    }
  ): Promise<{ secure_url: string; public_id: string }> {
    try {
      await this.ensureReady();
      const timestamp = `${Date.now()}_${require("crypto").randomUUID()}`;
      const sanitizedFilename = options.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filename = `video_${options.userId || 'user'}_${timestamp}_${sanitizedFilename}`;
      const filepath = path.join(this.uploadsDir, 'videos', filename);

      await writeFile(filepath, buffer);

      logger.info(`✓ Video saved locally: ${filename}`);

      return {
        secure_url: `${this.baseUrl}/uploads/videos/${filename}`, // never exposed to browsers for interview recordings
        public_id: `videos/${filename}`,
      };
    } catch (error: any) {
      logger.error('Local video upload error:', error);
      throw new Error(`Local video upload failed: ${error.message}`);
    }
  }

  async uploadImage(
    buffer: Buffer,
    options: {
      filename: string;
      userId?: string;
    }
  ): Promise<{ secure_url: string; public_id: string }> {
    try {
      await this.ensureReady();
      const timestamp = `${Date.now()}_${require("crypto").randomUUID()}`;
      const sanitizedFilename = options.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filename = `image_${options.userId || 'user'}_${timestamp}_${sanitizedFilename}`;
      const filepath = path.join(this.uploadsDir, 'images', filename);

      await writeFile(filepath, buffer);

      logger.info(`✓ Image saved locally: ${filename}`);

      return {
        secure_url: `${this.baseUrl}/uploads/images/${filename}`,
        public_id: `images/${filename}`,
      };
    } catch (error: any) {
      logger.error('Local image upload error:', error);
      throw new Error(`Local image upload failed: ${error.message}`);
    }
  }

  async deleteFile(publicId: string): Promise<void> {
    try {
      const filepath = this.getFilePath(publicId);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        logger.info(`✓ File deleted: ${publicId}`);
      }
    } catch (error) {
      logger.error('Local file deletion error:', error);
    }
  }

  getFilePath(publicId: string): string {
    const resolved = path.resolve(this.uploadsDir, publicId);
    if (!resolved.startsWith(path.resolve(this.uploadsDir) + path.sep)) throw new Error('Invalid storage path.');
    return resolved;
  }

  fileExists(publicId: string): boolean {
    const filepath = this.getFilePath(publicId);
    return fs.existsSync(filepath);
  }
}

const localStorageService = new LocalStorageService();

export default localStorageService;
