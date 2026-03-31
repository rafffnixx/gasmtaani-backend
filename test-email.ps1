# test-email.ps1
# Run this script to test email functionality without modifying your code

$backendPath = "C:\Users\Hp\Desktop\mtaani-gas\mtaani-backend"

$testScript = @'
// test-email.js
// Run with: node test-email.js

require('dotenv').config();
const emailService = require('./services/emailService');

async function testEmail() {
    console.log('\n========================================');
    console.log('📧 EMAIL SERVICE TEST');
    console.log('========================================\n');
    
    // Test email configuration
    console.log('1. Testing email configuration...');
    const configTest = await emailService.testEmailConfig();
    
    if (!configTest.success) {
        console.log('❌ Email configuration failed!');
        console.log('   Error:', configTest.error);
        console.log('\n💡 Please check your .env file has:');
        console.log('   MAIL_USER=your-email@gmail.com');
        console.log('   MAIL_PASS=your-app-password');
        return;
    }
    
    console.log('\n2. Sending test email...');
    
    // Send test email - Change this to your email
    const testEmailAddress = 'raffnixx@gmail.com';
    const result = await emailService.sendTestEmail(testEmailAddress);
    
    if (result.success) {
        console.log('✅ Test email sent successfully!');
        console.log('   To:', testEmailAddress);
        console.log('   Message ID:', result.messageId);
        console.log('\n📧 Please check your inbox/spam folder for the verification email.');
    } else {
        console.log('❌ Failed to send test email:', result.error);
    }
    
    console.log('\n========================================');
    console.log('TEST COMPLETE');
    console.log('========================================\n');
}

testEmail();
'@

# Write the test script
$testScript | Out-File -FilePath "$backendPath\test-email.js" -Encoding UTF8

Write-Host "✅ Created test-email.js" -ForegroundColor Green