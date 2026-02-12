// src/config/mail.js
const nodemailer = require('nodemailer');

const getMailTransporter = () => {
  // Use your own mail server
  if (process.env.MAIL_HOST) {
    return nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: parseInt(process.env.MAIL_PORT) || 587,
      secure: process.env.MAIL_SECURE === 'true',
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
      tls: {
        rejectUnauthorized: false // Allow self-signed certificates
      }
    });
  }
  
  // Fallback to Ethereal for development
  return null;
};

module.exports = { getMailTransporter };