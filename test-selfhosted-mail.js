// test-selfhosted-mail.js
require('dotenv').config();
const emailService = require('./services/emailService');

async function testSelfHostedMail() {
    console.log('\n========================================');
    console.log('📧 TESTING SELF-HOSTED MAIL SERVER');
    console.log('========================================\n');
    
    // Test configuration
    console.log('1. Testing mail server configuration...');
    const configTest = await emailService.testEmailConfig();
    
    if (!configTest.success) {
        console.log('\n❌ Mail server configuration failed!');
        console.log('\n💡 Please check:');
        console.log('   1. Mail server is running');
        console.log('   2. SMTP is enabled');
        console.log('   3. Credentials are correct');
        console.log('   4. Firewall allows connections');
        return;
    }
    
    console.log('\n2. Sending test email...');
    const result = await emailService.sendTestEmail('raffnixx@gmail.com');
    
    if (result.success) {
        console.log('\n✅ Test email sent successfully!');
        console.log('   Check your inbox/spam folder');
    } else {
        console.log('\n❌ Failed to send email:', result.error);
    }
    
    console.log('\n========================================\n');
}

testSelfHostedMail();