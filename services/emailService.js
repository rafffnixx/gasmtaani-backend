// services/emailService.js
const nodemailer = require('nodemailer');

// Console styling
const consoleStyle = {
  error: '\x1b[31m%s\x1b[0m',
  success: '\x1b[32m%s\x1b[0m',
  warning: '\x1b[33m%s\x1b[0m',
  info: '\x1b[36m%s\x1b[0m',
  data: '\x1b[90m%s\x1b[0m',
};

// Create transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.MAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.MAIL_PORT) || 587,
    secure: process.env.MAIL_SECURE === 'true' || false,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
};

// Send verification email
const sendVerificationEmail = async (to, code, name = '') => {
  try {
    console.log(consoleStyle.info, 'ðŸ“§ Sending verification email to:', to);
    
    const transporter = createTransporter();
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333333;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
          }
          .container {
            max-width: 600px;
            margin: 20px auto;
            background-color: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
          }
          .header {
            background: linear-gradient(135deg, #FF6B35 0%, #FF8E53 100%);
            padding: 40px 30px;
            text-align: center;
          }
          .header h1 {
            color: white;
            margin: 0;
            font-size: 32px;
            font-weight: 700;
          }
          .header p {
            color: rgba(255,255,255,0.9);
            margin: 10px 0 0;
            font-size: 16px;
          }
          .content {
            padding: 40px 30px;
            background-color: #ffffff;
          }
          .welcome-text {
            text-align: center;
            margin-bottom: 30px;
          }
          .welcome-text h2 {
            color: #FF6B35;
            margin: 0 0 10px;
            font-size: 24px;
          }
          .code-container {
            background: linear-gradient(145deg, #f8f9fa, #ffffff);
            border: 3px dashed #FF6B35;
            border-radius: 20px;
            padding: 30px;
            margin: 30px 0;
            text-align: center;
          }
          .code-label {
            color: #666;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 2px;
            margin-bottom: 10px;
          }
          .code {
            font-size: 48px;
            font-weight: 800;
            letter-spacing: 12px;
            color: #FF6B35;
            font-family: 'Courier New', monospace;
            background: #f8f9fa;
            padding: 15px 20px;
            border-radius: 12px;
            display: inline-block;
          }
          .expiry {
            text-align: center;
            background: #f8f9fa;
            padding: 15px;
            border-radius: 12px;
            margin: 20px 0;
            color: #666;
          }
          .expiry strong {
            color: #FF6B35;
          }
          .footer {
            background-color: #f8f9fa;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #e9ecef;
          }
          .footer p {
            margin: 5px 0;
            color: #888;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>âš¡ Mtaani Gas</h1>
            <p>Futuristic Gas Delivery</p>
          </div>
          <div class="content">
            <div class="welcome-text">
              <h2>Welcome to Mtaani Gas! ðŸ‘‹</h2>
              <p>Your trusted partner for gas delivery</p>
            </div>
            <p>Hello <strong>${name || 'Valued Customer'}</strong>,</p>
            <p>Thank you for choosing Mtaani Gas. To complete your registration, please use the verification code below:</p>
            <div class="code-container">
              <div class="code-label">Verification Code</div>
              <div class="code">${code}</div>
            </div>
            <div class="expiry">
              <span>â° This code expires in <strong>10 minutes</strong></span>
            </div>
            <p style="color: #666; font-style: italic; margin-top: 25px;">
              "Bringing convenience to your doorstep, one cylinder at a time."
            </p>
          </div>
          <div class="footer">
            <p style="font-size: 14px; color: #FF6B35; font-weight: 600;">Mtaani Gas - Your Neighborhood Gas Partner</p>
            <p>Â© ${new Date().getFullYear()} Mtaani Gas. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: process.env.MAIL_FROM || '"Mtaani Gas" <noreply@mtaanigas.com>',
      to: to,
      subject: 'ðŸ” Verify Your Mtaani Gas Account',
      html: html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(consoleStyle.success, 'âœ… Verification email sent to:', to);
    console.log(consoleStyle.data, '   Message ID:', info.messageId);
    
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.error(consoleStyle.error, 'âŒ Error sending email:', error.message);
    return { success: false, error: error.message };
  }
};

// Test email configuration
const testEmailConfig = async () => {
  try {
    console.log(consoleStyle.info, 'ðŸ”§ Testing email configuration...');
    
    const transporter = createTransporter();
    await transporter.verify();
    
    console.log(consoleStyle.success, 'âœ… Email configuration is working!');
    console.log(consoleStyle.data, '   SMTP Host:', process.env.MAIL_HOST);
    console.log(consoleStyle.data, '   SMTP Port:', process.env.MAIL_PORT);
    console.log(consoleStyle.data, '   From Email:', process.env.MAIL_USER);
    
    return { success: true };
  } catch (error) {
    console.error(consoleStyle.error, 'âŒ Email configuration failed:', error.message);
    return { success: false, error: error.message };
  }
};

// Send a test email
const sendTestEmail = async (to) => {
  return await sendVerificationEmail(to, '123456', 'Test User');
};

module.exports = {
  sendVerificationEmail,
  testEmailConfig,
  sendTestEmail,
  createTransporter,
};
