// src/services/emailService.js
const axios = require('axios');

// 👇 PASTE YOUR APPS SCRIPT URL HERE
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';

class EmailService {
  /**
   * Send email via Google Apps Script
   */
  async sendVerificationEmail(to, code, name) {
    try {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; }
            .header { background: linear-gradient(135deg, #FF6B35 0%, #FF8E53 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .header h1 { color: white; margin: 0; font-size: 28px; }
            .content { background-color: white; padding: 40px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .code { background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 36px; font-weight: bold; letter-spacing: 10px; color: #FF6B35; border-radius: 10px; margin: 20px 0; border: 2px dashed #FF6B35; }
            .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Mtaani Gas</h1>
              <p style="color: white; opacity: 0.9;">Futuristic Gas Delivery</p>
            </div>
            <div class="content">
              <h2 style="color: #FF6B35; text-align: center;">Welcome to Mtaani Gas! 👋</h2>
              
              <p style="font-size: 16px;">Hello <strong>${name || to}</strong>,</p>
              
              <p>Thank you for registering with Mtaani Gas. To complete your registration, please use the verification code below:</p>
              
              <div class="code">
                ${code}
              </div>
              
              <p style="text-align: center; color: #666;">
                This code will expire in <strong style="color: #FF6B35;">10 minutes</strong>.
              </p>
              
              <p style="margin-top: 30px;">
                If you didn't request this verification, please ignore this email.
              </p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Mtaani Gas. All rights reserved.</p>
              <p style="margin-top: 10px;">
                <small>This is an automated message, please do not reply.</small>
              </p>
            </div>
          </div>
        </body>
        </html>
      `;

      const text = `
        Welcome to Mtaani Gas!
        
        Hello ${name || to},
        
        Your verification code is: ${code}
        
        This code will expire in 10 minutes.
        
        If you didn't request this verification, please ignore this email.
        
        © ${new Date().getFullYear()} Mtaani Gas. All rights reserved.
      `;

      const response = await axios.post(APPS_SCRIPT_URL, {
        to,
        subject: '🔐 Verify Your Mtaani Gas Account',
        html,
        text
      });

      console.log(`✅ Email sent to ${to} via Apps Script`);
      return { success: true, data: response.data };
      
    } catch (error) {
      console.error('❌ Apps Script email failed:', error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new EmailService();