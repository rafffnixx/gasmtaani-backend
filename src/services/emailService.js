const nodemailer = require('nodemailer');
require('dotenv').config();

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: process.env.EMAIL_PORT || 587,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  }

  // Send verification email
  async sendVerificationEmail(to, code, userName = 'User') {
    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || `"Mtaani Gas" <${process.env.EMAIL_USER}>`,
        to: to,
        subject: 'Verify Your Account - Mtaani Gas',
        html: this.generateVerificationTemplate(code, userName)
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('\x1b[32m✅ Verification email sent: %s\x1b[0m', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('\x1b[31m🔥 Email sending error:\x1b[0m', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  // Send welcome email
  async sendWelcomeEmail(to, userName, userType) {
    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || `"Mtaani Gas" <${process.env.EMAIL_USER}>`,
        to: to,
        subject: `Welcome to Mtaani Gas - ${userType} Account Created!`,
        html: this.generateWelcomeTemplate(userName, userType)
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('\x1b[32m✅ Welcome email sent: %s\x1b[0m', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('\x1b[31m🔥 Welcome email error:\x1b[0m', error);
      // Don't throw error for welcome email - it's less critical
      return { success: false, error: error.message };
    }
  }

  // Send password reset email
  async sendPasswordResetEmail(to, resetToken, userName = 'User') {
    try {
      const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
      
      const mailOptions = {
        from: process.env.EMAIL_FROM || `"Mtaani Gas" <${process.env.EMAIL_USER}>`,
        to: to,
        subject: 'Reset Your Password - Mtaani Gas',
        html: this.generateResetPasswordTemplate(resetLink, userName)
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('\x1b[32m✅ Password reset email sent: %s\x1b[0m', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('\x1b[31m🔥 Password reset email error:\x1b[0m', error);
      throw new Error(`Failed to send password reset email: ${error.message}`);
    }
  }

  // Generate verification email template
  generateVerificationTemplate(code, userName) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Account</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .container { background-color: #f9f9f9; padding: 30px; border-radius: 10px; border: 1px solid #e0e0e0; }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { max-width: 150px; margin-bottom: 20px; }
          .code-container { text-align: center; margin: 30px 0; padding: 20px; background-color: #fff; border-radius: 8px; border: 2px dashed #4CAF50; }
          .verification-code { font-size: 32px; font-weight: bold; color: #4CAF50; letter-spacing: 5px; padding: 10px; }
          .instructions { background-color: #e8f5e9; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          .warning { color: #f44336; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="color: #4CAF50;">Mtaani Gas</h1>
            <h2>Verify Your Account</h2>
          </div>
          
          <p>Hello ${userName},</p>
          <p>Thank you for registering with Mtaani Gas! To complete your registration, please use the verification code below:</p>
          
          <div class="code-container">
            <div class="verification-code">${code}</div>
            <p style="margin-top: 10px; color: #666;">This code will expire in 10 minutes</p>
          </div>
          
          <div class="instructions">
            <p><strong>Instructions:</strong></p>
            <ol>
              <li>Enter this code in the verification screen of the Mtaani Gas app</li>
              <li>Complete your profile setup</li>
              <li>Start exploring gas delivery services!</li>
            </ol>
          </div>
          
          <p class="warning">⚠️ Do not share this code with anyone. Mtaani Gas will never ask for this code via phone or email.</p>
          
          <p>If you didn't create an account with Mtaani Gas, please ignore this email.</p>
          
          <div class="footer">
            <p>Best regards,<br>The Mtaani Gas Team</p>
            <p>📍 Nairobi, Kenya<br>📧 support@mtaanigas.co.ke<br>📱 +254 700 000 000</p>
            <p style="margin-top: 20px; font-size: 10px; color: #999;">
              This is an automated message. Please do not reply to this email.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Generate welcome email template
  generateWelcomeTemplate(userName, userType) {
    const roleSpecificMessage = userType === 'agent' 
      ? `<p>As an agent, you can now:</p>
         <ul>
           <li>Set up your gas product listings</li>
           <li>Manage inventory and pricing</li>
           <li>Receive orders from customers</li>
           <li>Track your earnings</li>
         </ul>`
      : `<p>As a customer, you can now:</p>
         <ul>
           <li>Browse available gas products</li>
           <li>Place orders for delivery</li>
           <li>Track your orders in real-time</li>
           <li>Save your favorite agents</li>
         </ul>`;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Mtaani Gas</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .container { background-color: #f9f9f9; padding: 30px; border-radius: 10px; border: 1px solid #e0e0e0; }
          .header { text-align: center; margin-bottom: 30px; }
          .welcome-message { background-color: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .features { background-color: #fff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4CAF50; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="color: #4CAF50;">🎉 Welcome to Mtaani Gas! 🎉</h1>
          </div>
          
          <p>Hello ${userName},</p>
          
          <div class="welcome-message">
            <p><strong>Your ${userType} account has been successfully created!</strong></p>
            <p>We're excited to have you join our community of ${userType === 'agent' ? 'trusted gas agents' : 'valued customers'} across Kenya.</p>
          </div>
          
          <div class="features">
            ${roleSpecificMessage}
          </div>
          
          <p><strong>Next Steps:</strong></p>
          <ol>
            <li>Complete your profile information</li>
            <li>Explore the dashboard</li>
            <li>${userType === 'agent' ? 'Set up your first product listing' : 'Browse available gas products'}</li>
            <li>Download our mobile app (coming soon!)</li>
          </ol>
          
          <p>Need help getting started? Check out our <a href="${process.env.FRONTEND_URL}/help">help center</a> or contact our support team.</p>
          
          <div class="footer">
            <p>Best regards,<br>The Mtaani Gas Team</p>
            <p>📍 Nairobi, Kenya<br>📧 support@mtaanigas.co.ke<br>📱 +254 700 000 000</p>
            <p style="margin-top: 20px; font-size: 10px; color: #999;">
              Delivering gas solutions to your doorstep across Kenya
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Generate password reset template
  generateResetPasswordTemplate(resetLink, userName) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .container { background-color: #f9f9f9; padding: 30px; border-radius: 10px; border: 1px solid #e0e0e0; }
          .header { text-align: center; margin-bottom: 30px; }
          .reset-button { display: inline-block; background-color: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
          .warning { color: #f44336; font-weight: bold; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="color: #4CAF50;">Reset Your Password</h1>
          </div>
          
          <p>Hello ${userName},</p>
          <p>We received a request to reset your password for your Mtaani Gas account. Click the button below to reset your password:</p>
          
          <div style="text-align: center;">
            <a href="${resetLink}" class="reset-button">Reset Password</a>
          </div>
          
          <p style="word-break: break-all;">Or copy and paste this link in your browser:<br>${resetLink}</p>
          
          <p class="warning">⚠️ This link will expire in 1 hour. If you didn't request a password reset, please ignore this email or contact support if you're concerned.</p>
          
          <p>For security reasons, this link can only be used once. After resetting your password, you'll be able to log in with your new password.</p>
          
          <div class="footer">
            <p>Best regards,<br>The Mtaani Gas Team</p>
            <p>📍 Nairobi, Kenya<br>📧 support@mtaanigas.co.ke<br>📱 +254 700 000 000</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

module.exports = new EmailService();