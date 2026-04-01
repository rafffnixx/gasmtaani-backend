const nodemailer = require('nodemailer');
const net = require('net');

// Console styling
const consoleStyle = {
  error: '\x1b[31m%s\x1b[0m',
  success: '\x1b[32m%s\x1b[0m',
  warning: '\x1b[33m%s\x1b[0m',
  info: '\x1b[36m%s\x1b[0m',
  data: '\x1b[90m%s\x1b[0m',
};

// Create transporter with increased timeouts for Render
const createTransporter = () => {
  const config = {
    host: process.env.MAIL_HOST || 'mail.masaigroup.co.ke',
    port: parseInt(process.env.MAIL_PORT) || 587,
    secure: process.env.MAIL_SECURE === 'true' || false,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false,
      ciphers: 'SSLv3',
    },
    // INCREASED TIMEOUTS for Render free tier
    connectionTimeout: 60000, // 60 seconds
    greetingTimeout: 60000,   // 60 seconds
    socketTimeout: 60000,      // 60 seconds
    debug: process.env.NODE_ENV === 'development',
  };
  
  console.log(consoleStyle.data, '📧 Mail Server Config:');
  console.log(consoleStyle.data, `   Host: ${config.host}`);
  console.log(consoleStyle.data, `   Port: ${config.port}`);
  console.log(consoleStyle.data, `   Secure: ${config.secure}`);
  console.log(consoleStyle.data, `   Timeouts: 60s (Render optimized)`);
  
  return nodemailer.createTransport(config);
};

// Send email with retry logic for Render
const sendEmailWithRetry = async (mailOptions, maxRetries = 3) => {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(consoleStyle.info, `📧 Email attempt ${attempt}/${maxRetries}`);
      
      const transporter = createTransporter();
      
      // Verify connection with timeout
      console.log(consoleStyle.data, '   Verifying connection...');
      await transporter.verify();
      console.log(consoleStyle.success, '   Connection verified');
      
      // Send email
      console.log(consoleStyle.data, '   Sending email...');
      const info = await transporter.sendMail(mailOptions);
      
      console.log(consoleStyle.success, '✅ Email sent successfully');
      console.log(consoleStyle.data, '   Message ID:', info.messageId);
      
      return { success: true, messageId: info.messageId };
      
    } catch (error) {
      lastError = error;
      console.log(consoleStyle.warning, `⚠️ Attempt ${attempt} failed:`, error.message);
      
      if (attempt < maxRetries) {
        // Exponential backoff: 5s, 10s, 15s
        const waitTime = attempt * 5000;
        console.log(consoleStyle.data, `   Waiting ${waitTime/1000}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  console.error(consoleStyle.error, '❌ All email attempts failed after', maxRetries, 'retries');
  console.error(consoleStyle.error, '   Last error:', lastError?.message);
  
  return { success: false, error: lastError?.message };
};

// Send verification email
const sendVerificationEmail = async (to, code, name = '') => {
  try {
    console.log(consoleStyle.info, '📧 Sending verification email to:', to);
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 20px auto; background-color: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #FF6B35 0%, #FF8E53 100%); padding: 40px 30px; text-align: center; }
          .header h1 { color: #fff; margin: 0; font-size: 32px; }
          .header p { color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 16px; }
          .content { padding: 40px 30px; background-color: #fff; }
          .welcome-text { text-align: center; margin-bottom: 30px; }
          .welcome-text h2 { color: #FF6B35; margin: 0 0 10px; font-size: 24px; }
          .code-container { background: linear-gradient(145deg, #f8f9fa, #fff); border: 3px dashed #FF6B35; border-radius: 20px; padding: 30px; margin: 30px 0; text-align: center; }
          .code-label { color: #666; font-size: 14px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px; }
          .code { font-size: 48px; font-weight: 800; letter-spacing: 12px; color: #FF6B35; font-family: 'Courier New', monospace; background: #f8f9fa; padding: 15px 20px; border-radius: 12px; display: inline-block; }
          .expiry { text-align: center; background: #f8f9fa; padding: 15px; border-radius: 12px; margin: 20px 0; color: #666; }
          .footer { background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef; }
          .footer p { margin: 5px 0; color: #888; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚡ Mtaani Gas</h1>
            <p>Your Neighborhood Gas Partner</p>
          </div>
          <div class="content">
            <div class="welcome-text">
              <h2>Welcome to Mtaani Gas! 👋</h2>
              <p>Your trusted partner for gas delivery</p>
            </div>
            <p>Hello <strong>${name || 'Valued Customer'}</strong>,</p>
            <p>Thank you for choosing Mtaani Gas. To complete your registration, please use the verification code below:</p>
            <div class="code-container">
              <div class="code-label">Verification Code</div>
              <div class="code">${code}</div>
            </div>
            <div class="expiry">
              <span>⏰ This code expires in <strong>10 minutes</strong></span>
            </div>
            <p style="color: #666; font-style: italic;">"Bringing convenience to your doorstep, one cylinder at a time."</p>
          </div>
          <div class="footer">
            <p style="font-size: 14px; color: #FF6B35; font-weight: 600;">Mtaani Gas - Your Neighborhood Gas Partner</p>
            <p>© ${new Date().getFullYear()} Mtaani Gas. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: process.env.MAIL_FROM || '"Mtaani Gas" <it@masaigroup.co.ke>',
      to: to,
      subject: '🔐 Verify Your Mtaani Gas Account',
      html: html,
    };

    return await sendEmailWithRetry(mailOptions, 3);
    
  } catch (error) {
    console.error(consoleStyle.error, '❌ Error in sendVerificationEmail:', error.message);
    return { success: false, error: error.message };
  }
};

// Send order confirmation email
const sendOrderConfirmationEmail = async (to, orderDetails, customerName) => {
  try {
    console.log(consoleStyle.info, '📧 Sending order confirmation to:', to);
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Order Confirmation - Mtaani Gas</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 20px auto; background-color: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #FF6B35 0%, #FF8E53 100%); padding: 30px; text-align: center; }
          .header h1 { color: #fff; margin: 0; font-size: 28px; }
          .content { padding: 30px; }
          .order-details { background: #f8f9fa; padding: 20px; border-radius: 12px; margin: 20px 0; }
          .total { font-size: 20px; font-weight: bold; color: #FF6B35; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #888; border-top: 1px solid #e9ecef; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Order Confirmation 🎉</h1>
          </div>
          <div class="content">
            <h2>Hello ${customerName},</h2>
            <p>Your order has been placed successfully!</p>
            <div class="order-details">
              <h3>Order Details:</h3>
              <p><strong>Order Number:</strong> ${orderDetails.order_number}</p>
              <p><strong>Total Amount:</strong> KES ${orderDetails.grand_total}</p>
              <p><strong>Status:</strong> ${orderDetails.status}</p>
            </div>
            <p>We'll notify you once your order is confirmed by the agent.</p>
            <p>Thank you for choosing Mtaani Gas!</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Mtaani Gas. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: process.env.MAIL_FROM || '"Mtaani Gas" <it@masaigroup.co.ke>',
      to: to,
      subject: `Order Confirmation #${orderDetails.order_number}`,
      html: html,
    };

    return await sendEmailWithRetry(mailOptions, 3);
    
  } catch (error) {
    console.error(consoleStyle.error, '❌ Error sending order confirmation:', error.message);
    return { success: false, error: error.message };
  }
};

// Test email configuration
const testEmailConfig = async () => {
  try {
    console.log(consoleStyle.info, '🔧 Testing email configuration...');
    
    const transporter = createTransporter();
    await transporter.verify();
    
    console.log(consoleStyle.success, '✅ Email configuration is working!');
    console.log(consoleStyle.data, '   Host:', process.env.MAIL_HOST);
    console.log(consoleStyle.data, '   Port:', process.env.MAIL_PORT);
    console.log(consoleStyle.data, '   User:', process.env.MAIL_USER);
    
    return { success: true };
  } catch (error) {
    console.error(consoleStyle.error, '❌ Email configuration failed:', error.message);
    return { success: false, error: error.message };
  }
};

// Send test email
const sendTestEmail = async (to) => {
  return await sendVerificationEmail(to, '123456', 'Test User');
};

module.exports = {
  sendVerificationEmail,
  sendOrderConfirmationEmail,
  testEmailConfig,
  sendTestEmail,
  createTransporter,
};