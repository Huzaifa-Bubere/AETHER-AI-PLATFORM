import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import logger from '../utils/logger';

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

class LocalStorageService {
  private uploadsDir: string;
  private baseUrl: string;

  constructor() {
    this.uploadsDir = path.join(process.cwd(), 'uploads');
    this.baseUrl = process.env.BACKEND_URL || 'http://localhost:5001';
    this.initialize();
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
    }
  }

  async uploadResume(
    buffer: Buffer,
    options: {
      filename: string;
      userId: string;
    }
  ): Promise<{ secure_url: string; public_id: string }> {
    try {
      const timestamp = Date.now();
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

  async uploadImage(
    buffer: Buffer,
    options: {
      filename: string;
      userId?: string;
    }
  ): Promise<{ secure_url: string; public_id: string }> {
    try {
      const timestamp = Date.now();
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
      const filepath = path.join(this.uploadsDir, publicId);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        logger.info(`✓ File deleted: ${publicId}`);
      }
    } catch (error) {
      logger.error('Local file deletion error:', error);
    }
  }

  getFilePath(publicId: string): string {
    return path.join(this.uploadsDir, publicId);
  }

  fileExists(publicId: string): boolean {
    const filepath = path.join(this.uploadsDir, publicId);
    return fs.existsSync(filepath);
  }
}

const localStorageService = new LocalStorageService();

export default localStorageService;
