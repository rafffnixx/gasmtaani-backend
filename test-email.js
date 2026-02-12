// test-email.js
const nodemailer = require('nodemailer');
require('dotenv').config();

async function testEmail() {
  console.log('🔍 Testing email configuration...');
  console.log('Host:', process.env.MAIL_HOST);
  console.log('Port:', process.env.MAIL_PORT);
  console.log('User:', process.env.MAIL_USER);
  
  // Try different configurations
  const configs = [
    {
      name: 'SSL 465',
      host: 'mail.masaigroup.co.ke',
      port: 465,
      secure: true,
      auth: { user: 'it@masaigroup.co.ke', pass: process.env.MAIL_PASS }
    },
    {
      name: 'TLS 587',
      host: 'mail.masaigroup.co.ke',
      port: 587,
      secure: false,
      auth: { user: 'it@masaigroup.co.ke', pass: process.env.MAIL_PASS },
      tls: { rejectUnauthorized: false }
    },
    {
      name: 'Plain 25',
      host: 'mail.masaigroup.co.ke',
      port: 25,
      secure: false,
      auth: { user: 'it@masaigroup.co.ke', pass: process.env.MAIL_PASS }
    }
  ];

  for (const config of configs) {
    try {
      console.log(`\n📧 Testing ${config.name}...`);
      const transporter = nodemailer.createTransport(config);
      await transporter.verify();
      console.log(`✅ SUCCESS with ${config.name}!`);
      
      // Send test email
      const info = await transporter.sendMail({
        from: '"Mtaani Gas Test" <it@masaigroup.co.ke>',
        to: 'it@masaigroup.co.ke', // Send to yourself
        subject: '✅ Mail Server Test Successful',
        text: `Your mail server works with ${config.name}!`
      });
      
      console.log(`✅ Test email sent! Message ID: ${info.messageId}`);
      return;
    } catch (error) {
      console.log(`❌ Failed with ${config.name}:`, error.message);
    }
  }
  
  console.log('\n❌ All configurations failed!');
  console.log('\n💡 TROUBLESHOOTING:');
  console.log('1. Check if your hosting provider blocks SMTP ports');
  console.log('2. Verify email password is correct');
  console.log('3. Check if "Allow less secure apps" is enabled');
  console.log('4. Try using Gmail SMTP as fallback:');
  console.log('   MAIL_HOST=smtp.gmail.com');
  console.log('   MAIL_PORT=587');
  console.log('   MAIL_SECURE=false');
  console.log('   MAIL_USER=your-email@gmail.com');
  console.log('   MAIL_PASS=your-16-digit-app-password');
}

testEmail().catch(console.error);