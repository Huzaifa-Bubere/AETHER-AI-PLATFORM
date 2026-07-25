import { v2 as cloudinary } from 'cloudinary';
import logger from '../utils/logger';

class CloudinaryService {
  private isInitialized = false;

  initialize(): void {
    try {
      // Log environment loading status
      logger.info('=== Cloudinary Initialization ===');
      logger.info('Loading environment variables...');
      
      // Validate environment variables
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      const apiKey = process.env.CLOUDINARY_API_KEY;
      const apiSecret = process.env.CLOUDINARY_API_SECRET;

      logger.info(`Cloud Name: ${cloudName ? '✓ Present (' + cloudName + ')' : '✗ MISSING'}`);
      logger.info(`API Key: ${apiKey ? '✓ Present (' + apiKey.substring(0, 4) + '...' + apiKey.substring(apiKey.length - 4) + ')' : '✗ MISSING'}`);
      logger.info(`API Secret: ${apiSecret ? '✓ Present (' + apiSecret.length + ' chars)' : '✗ MISSING'}`);

      if (!cloudName || !apiKey || !apiSecret) {
        logger.warn('⚠️  Cloudinary credentials missing - uploads will be disabled');
        logger.warn('Required environment variables:');
        logger.warn('  - CLOUDINARY_CLOUD_NAME');
        logger.warn('  - CLOUDINARY_API_KEY');
        logger.warn('  - CLOUDINARY_API_SECRET');
        logger.warn('Get credentials from: https://cloudinary.com/console');
        this.isInitialized = false;
        return;
      }

      // Validate cloud name format (basic check)
      if (cloudName.includes(' ') || cloudName.length < 3) {
        logger.error(`⚠️  Invalid cloud name format: "${cloudName}"`);
        logger.error('Cloud name should not contain spaces and must be at least 3 characters');
        logger.error('Please verify your cloud name at: https://cloudinary.com/console');
        this.isInitialized = false;
        return;
      }

      // Configure Cloudinary
      logger.info('Configuring Cloudinary...');
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
      });

      this.isInitialized = true;
      logger.info('✓ Cloudinary initialized successfully');
      logger.info(`Cloud: ${cloudName}`);
      logger.info(`Dashboard: https://cloudinary.com/console`);
    } catch (error: any) {
      logger.error('❌ Cloudinary initialization error:', error.message);
      logger.error('Stack:', error.stack);
      logger.error('Please verify your Cloudinary credentials at: https://cloudinary.com/console');
      this.isInitialized = false;
    }
  }

  async uploadImage(
    buffer: Buffer,
    options: {
      folder?: string;
      public_id?: string;
      transformation?: any;
      resource_type?: 'image' | 'video' | 'raw' | 'auto';
    } = {}
  ): Promise<any> {
    if (!this.isInitialized) {
      const errorMsg = 'Cloudinary service is not initialized. Please verify your Cloudinary credentials (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) in backend/.env file. Get credentials from https://cloudinary.com/console';
      logger.error('❌ Cloudinary upload failed: Service not initialized');
      logger.error('💡 Solution: Check backend/.env file and verify credentials at https://cloudinary.com/console');
      throw new Error(errorMsg);
    }

    return new Promise((resolve, reject) => {
      try {
        const uploadOptions = {
          resource_type: options.resource_type || 'auto',
          folder: options.folder || 'smart-interview-ai',
          public_id: options.public_id,
          transformation: options.transformation,
          ...options,
        };

        logger.info(`📤 Uploading to Cloudinary: folder=${uploadOptions.folder}, resource_type=${uploadOptions.resource_type}`);

        const uploadStream = cloudinary.uploader.upload_stream(
          uploadOptions,
          (error, result) => {
            if (error) {
              logger.error('❌ Cloudinary upload error:', error.message);
              
              // Provide specific error messages
              if (error.message?.includes('Invalid cloud_name')) {
                reject(new Error(`Invalid Cloudinary cloud name. Please verify CLOUDINARY_CLOUD_NAME in backend/.env matches your account at https://cloudinary.com/console`));
              } else if (error.message?.includes('Invalid API key')) {
                reject(new Error(`Invalid Cloudinary API key. Please verify CLOUDINARY_API_KEY in backend/.env`));
              } else if (error.message?.includes('Invalid signature')) {
                reject(new Error(`Invalid Cloudinary API secret. Please verify CLOUDINARY_API_SECRET in backend/.env`));
              } else {
                reject(new Error(`Cloudinary upload failed: ${error.message || 'Unknown error'}`));
              }
            } else {
              logger.info(`✓ File uploaded to Cloudinary: ${result?.public_id}`);
              resolve(result);
            }
          }
        );

        uploadStream.end(buffer);
      } catch (error: any) {
        logger.error('❌ Cloudinary upload stream error:', error.message);
        reject(new Error(`Failed to create upload stream: ${error.message}`));
      }
    });
  }

  async uploadVideo(
    buffer: Buffer,
    options: {
      folder?: string;
      public_id?: string;
      transformation?: any;
    } = {}
  ): Promise<any> {
    return this.uploadImage(buffer, {
      ...options,
      resource_type: 'video',
    });
  }

  async uploadAudio(
    buffer: Buffer,
    options: {
      folder?: string;
      public_id?: string;
    } = {}
  ): Promise<any> {
    return this.uploadImage(buffer, {
      ...options,
      resource_type: 'video', // Cloudinary treats audio as video
    });
  }

  async uploadResume(
    buffer: Buffer,
    options: {
      folder?: string;
      public_id?: string;
    } = {}
  ): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('Cloudinary not configured. Please add valid credentials to backend/.env file.');
    }
    
    return this.uploadImage(buffer, {
      ...options,
      resource_type: 'raw',
      folder: options.folder || 'smart-interview-ai/resumes',
    });
  }

  async deleteFile(publicId: string, resourceType: 'image' | 'video' | 'raw' = 'image'): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('Cloudinary not initialized');
    }

    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
      });
      
      logger.info(`File deleted from Cloudinary: ${publicId}`);
      return result;
    } catch (error) {
      logger.error('Cloudinary delete error:', error);
      throw error;
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    if (!this.isInitialized) {
      return {
        success: false,
        message: 'Cloudinary not initialized. Check credentials in backend/.env',
        details: {
          cloudName: process.env.CLOUDINARY_CLOUD_NAME ? 'Present' : 'Missing',
          apiKey: process.env.CLOUDINARY_API_KEY ? 'Present' : 'Missing',
          apiSecret: process.env.CLOUDINARY_API_SECRET ? 'Present' : 'Missing',
        }
      };
    }

    try {
      // Try to get account details as a connection test
      const result = await cloudinary.api.ping();
      return {
        success: true,
        message: 'Cloudinary connection successful',
        details: result
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Cloudinary connection failed: ${error.message}`,
        details: {
          error: error.message,
          cloudName: process.env.CLOUDINARY_CLOUD_NAME
        }
      };
    }
  }

  async generateSignedUrl(
    publicId: string,
    options: {
      transformation?: any;
      resource_type?: 'image' | 'video' | 'raw';
      expires_at?: number;
    } = {}
  ): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Cloudinary not initialized');
    }

    try {
      const signedUrl = cloudinary.utils.private_download_url(publicId, 'jpg', {
        resource_type: options.resource_type || 'image',
        expires_at: options.expires_at || Math.floor(Date.now() / 1000) + 3600, // 1 hour
        ...(options.transformation && { transformation: options.transformation }),
      } as any);

      return signedUrl;
    } catch (error) {
      logger.error('Cloudinary signed URL error:', error);
      throw error;
    }
  }

  getOptimizedImageUrl(
    publicId: string,
    options: {
      width?: number;
      height?: number;
      crop?: string;
      quality?: string | number;
      format?: string;
    } = {}
  ): string {
    if (!this.isInitialized) {
      throw new Error('Cloudinary not initialized');
    }

    return cloudinary.url(publicId, {
      width: options.width,
      height: options.height,
      crop: options.crop || 'fill',
      quality: options.quality || 'auto',
      format: options.format || 'auto',
      fetch_format: 'auto',
    });
  }

  async getFileInfo(publicId: string, resourceType: 'image' | 'video' | 'raw' = 'image'): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('Cloudinary not initialized');
    }

    try {
      const result = await cloudinary.api.resource(publicId, {
        resource_type: resourceType,
      });
      
      return result;
    } catch (error) {
      logger.error('Cloudinary file info error:', error);
      throw error;
    }
  }

  isHealthy(): boolean {
    return this.isInitialized;
  }
}

const cloudinaryService = new CloudinaryService();

export function initializeCloudinary(): void {
  cloudinaryService.initialize();
}

export default cloudinaryService;