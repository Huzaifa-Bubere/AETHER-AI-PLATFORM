import nodemailer from 'nodemailer';
import logger from '../utils/logger';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private isConfigured: boolean = false;

  constructor() {
    this.initialize();
  }

  private initialize() {
    const emailConfig = {
      service: process.env.EMAIL_SERVICE || 'gmail',
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    };

    // Check if email is configured
    if (!emailConfig.auth.user || !emailConfig.auth.pass) {
      logger.warn('Email service not configured - emails will not be sent');
      logger.warn('Set EMAIL_USER and EMAIL_PASSWORD environment variables to enable email');
      this.isConfigured = false;
      return;
    }

    try {
      this.transporter = nodemailer.createTransport(emailConfig);
      this.isConfigured = true;
      logger.info('Email service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize email service:', error);
      this.isConfigured = false;
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.isConfigured || !this.transporter) {
      logger.warn(`Email not sent to ${options.to} - service not configured`);
      logger.info(`Would have sent: ${options.subject}`);
      return false;
    }

    try {
      const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME || 'Smart Interview AI'}" <${process.env.EMAIL_USER}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || options.html.replace(/<[^>]*>/g, ''),
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent successfully to ${options.to}: ${info.messageId}`);
      return true;
    } catch (error: any) {
      logger.error(`Failed to send email to ${options.to}:`, error);
      return false;
    }
  }

  async sendVerificationEmail(email: string, token: string): Promise<boolean> {
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 12px 30px; background: #6366f1; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Smart Interview AI!</h1>
          </div>
          <div class="content">
            <p>Hi there,</p>
            <p>Thank you for signing up! Please verify your email address to get started with AI-powered interview preparation.</p>
            <p style="text-align: center;">
              <a href="${verificationUrl}" class="button">Verify Email Address</a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #6366f1;">${verificationUrl}</p>
            <p>This link will expire in 24 hours.</p>
            <p>If you didn't create an account, you can safely ignore this email.</p>
          </div>
          <div class="footer">
            <p>© 2026 Smart Interview AI. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: 'Verify Your Email - Smart Interview AI',
      html,
    });
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<boolean> {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 12px 30px; background: #6366f1; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <p>Hi there,</p>
            <p>We received a request to reset your password for your Smart Interview AI account.</p>
            <p style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #6366f1;">${resetUrl}</p>
            <div class="warning">
              <strong>⚠️ Security Notice:</strong>
              <ul>
                <li>This link will expire in 1 hour</li>
                <li>If you didn't request this reset, please ignore this email</li>
                <li>Your password will remain unchanged until you create a new one</li>
              </ul>
            </div>
          </div>
          <div class="footer">
            <p>© 2026 Smart Interview AI. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: 'Reset Your Password - Smart Interview AI',
      html,
    });
  }

  async sendWelcomeEmail(email: string, firstName: string): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 12px 30px; background: #6366f1; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .feature { background: white; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #6366f1; }
          .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to Smart Interview AI!</h1>
          </div>
          <div class="content">
            <p>Hi ${firstName},</p>
            <p>Your email has been verified! You're all set to start practicing interviews with AI.</p>
            
            <h3>Here's what you can do:</h3>
            
            <div class="feature">
              <strong>📄 Upload Your Resume</strong>
              <p>Get AI-powered analysis and personalized interview questions based on your experience.</p>
            </div>
            
            <div class="feature">
              <strong>🎤 Practice Interviews</strong>
              <p>Choose from behavioral, technical, or coding interviews with real-time feedback.</p>
            </div>
            
            <div class="feature">
              <strong>📊 Track Progress</strong>
              <p>View detailed analytics and improvement suggestions after each interview.</p>
            </div>
            
            <p style="text-align: center;">
              <a href="${process.env.FRONTEND_URL}/dashboard" class="button">Go to Dashboard</a>
            </p>
            
            <p>Need help? Check out our <a href="${process.env.FRONTEND_URL}/help">Help Center</a> or reply to this email.</p>
          </div>
          <div class="footer">
            <p>© 2026 Smart Interview AI. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: 'Welcome to Smart Interview AI! 🚀',
      html,
    });
  }

  async sendPaymentReceiptEmail(
    email: string,
    firstName: string,
    paymentDetails: {
      transactionId: string;
      plan: string;
      amount: number;
      currency: string;
      date: Date;
      paymentMethod?: string;
      receiptUrl?: string;
    }
  ): Promise<boolean> {
    const formattedAmount = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: paymentDetails.currency,
    }).format(paymentDetails.amount / 100);

    const formattedDate = new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(paymentDetails.date);

    const planName = paymentDetails.plan.charAt(0).toUpperCase() + paymentDetails.plan.slice(1);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          .receipt-box { background: white; border: 2px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .receipt-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e5e7eb; }
          .receipt-row:last-child { border-bottom: none; }
          .receipt-label { color: #6b7280; font-weight: 500; }
          .receipt-value { color: #111827; font-weight: 600; }
          .total-row { background: #f3f4f6; padding: 15px; border-radius: 5px; margin-top: 10px; }
          .total-amount { font-size: 24px; color: #10b981; font-weight: bold; }
          .button { display: inline-block; padding: 12px 30px; background: #10b981; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .success-icon { font-size: 48px; margin-bottom: 10px; }
          .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
          .info-box { background: #dbeafe; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="success-icon">✓</div>
            <h1>Payment Successful!</h1>
            <p style="margin: 0; opacity: 0.9;">Thank you for your subscription</p>
          </div>
          <div class="content">
            <p>Hi ${firstName},</p>
            <p>Your payment has been processed successfully. Here are your transaction details:</p>
            
            <div class="receipt-box">
              <h3 style="margin-top: 0; color: #111827;">Payment Receipt</h3>
              
              <div class="receipt-row">
                <span class="receipt-label">Transaction ID</span>
                <span class="receipt-value">${paymentDetails.transactionId}</span>
              </div>
              
              <div class="receipt-row">
                <span class="receipt-label">Date & Time</span>
                <span class="receipt-value">${formattedDate}</span>
              </div>
              
              <div class="receipt-row">
                <span class="receipt-label">Plan</span>
                <span class="receipt-value">${planName} Plan</span>
              </div>
              
              ${paymentDetails.paymentMethod ? `
              <div class="receipt-row">
                <span class="receipt-label">Payment Method</span>
                <span class="receipt-value">${paymentDetails.paymentMethod}</span>
              </div>
              ` : ''}
              
              <div class="total-row">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span class="receipt-label" style="font-size: 18px;">Total Amount Paid</span>
                  <span class="total-amount">${formattedAmount}</span>
                </div>
              </div>
            </div>

            <div class="info-box">
              <strong>📋 What's Next?</strong>
              <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                <li>Your ${planName} subscription is now active</li>
                <li>Access all premium features from your dashboard</li>
                <li>View your payment history in your profile</li>
                <li>Download invoice from your account settings</li>
              </ul>
            </div>

            <p style="text-align: center;">
              <a href="${process.env.FRONTEND_URL}/dashboard" class="button">Go to Dashboard</a>
            </p>

            ${paymentDetails.receiptUrl ? `
            <p style="text-align: center; margin-top: 20px;">
              <a href="${paymentDetails.receiptUrl}" style="color: #6366f1; text-decoration: none;">
                📄 Download Official Receipt from Stripe
              </a>
            </p>
            ` : ''}

            <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
              <strong>Need help?</strong> Contact our support team at ${process.env.EMAIL_USER || 'support@smartinterviewai.com'}
            </p>
          </div>
          <div class="footer">
            <p>© 2026 Smart Interview AI. All rights reserved.</p>
            <p style="margin-top: 10px; font-size: 12px;">
              This is an automated receipt for your records. Please do not reply to this email.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: `Payment Receipt - ${planName} Plan - Smart Interview AI`,
      html,
    });
  }

  async testConnection(): Promise<boolean> {
    if (!this.isConfigured || !this.transporter) {
      logger.warn('Email service not configured - cannot test connection');
      return false;
    }

    try {
      await this.transporter.verify();
      logger.info('Email service connection verified successfully');
      return true;
    } catch (error) {
      logger.error('Email service connection test failed:', error);
      return false;
    }
  }

  isReady(): boolean {
    return this.isConfigured;
  }
}

export const emailService = new EmailService();
export default emailService;
