// src/controllers/authController.js
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const db = require('../models');

// Console styling
const consoleStyle = {
  error: '\x1b[31m%s\x1b[0m',
  success: '\x1b[32m%s\x1b[0m',
  warning: '\x1b[33m%s\x1b[0m',
  info: '\x1b[36m%s\x1b[0m',
  header: '\x1b[1m\x1b[35m%s\x1b[0m',
  data: '\x1b[90m%s\x1b[0m',
  highlight: '\x1b[1m\x1b[37m%s\x1b[0m',
  time: '\x1b[34m%s\x1b[0m'
};

// Format Kenya time
const formatKenyaTime = (date) => {
  return date.toLocaleString('en-KE', { 
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

class AuthController {
  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  generateToken = (user) => {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        phone: user.phone_number,
        user_type: user.user_type,
        is_verified: user.is_verified,
        is_agent_profile_complete: user.is_agent_profile_complete
      },
      process.env.JWT_SECRET || 'mtaani-gas-secret-key-2024',
      { expiresIn: '7d' }
    );
  };

  generateLimitedToken = (user) => {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        phone: user.phone_number,
        is_verified: false
      },
      process.env.JWT_SECRET || 'mtaani-gas-secret-key-2024',
      { expiresIn: '1h' }
    );
  };

  normalizePhoneNumber = (phone) => {
    if (!phone) return phone;
    
    let cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.startsWith('0') && cleaned.length === 10) {
      cleaned = '254' + cleaned.substring(1);
    }
    
    if (!cleaned.startsWith('+') && !cleaned.startsWith('254')) {
      cleaned = '+254' + cleaned;
    } else if (cleaned.startsWith('254')) {
      cleaned = '+' + cleaned;
    }
    
    return cleaned;
  };

  generateVerificationCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  createVerificationCode = async (userId, type = 'phone_verification') => {
    try {
      // Delete any existing active codes for this user
      await db.VerificationCode.destroy({
        where: {
          user_id: userId,
          type: type,
          is_used: false
        }
      });

      const code = this.generateVerificationCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      const verificationCode = await db.VerificationCode.create({
        user_id: userId,
        code: code,
        type: type,
        expires_at: expiresAt,
        is_used: false,
        attempts: 0
      });

      console.log(consoleStyle.success, `✅ Verification code saved! ID: ${verificationCode.id}`);
      
      const expiresAtKenya = formatKenyaTime(expiresAt);
      console.log(consoleStyle.time, `   Expires at: ${expiresAtKenya}`);

      return {
        code: code,
        expires_at: expiresAt,
        id: verificationCode.id
      };
    } catch (error) {
      console.log(consoleStyle.error, '🔥 Failed to create verification code:');
      console.log(consoleStyle.data, `   Error: ${error.message}`);
      throw error;
    }
  };

  // ============================================================================
  // REGISTRATION FLOW
  // ============================================================================

  /**
   * 📝 STEP 1: BASIC REGISTRATION
   */
  step1Register = async (req, res) => {
    console.log('\n' + '='.repeat(80));
    console.log(consoleStyle.header, '📝 STEP 1: BASIC REGISTRATION');
    console.log(consoleStyle.time, `📅 Time: ${formatKenyaTime(new Date())}`);
    console.log('='.repeat(80));
    
    try {
      // Validation
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { email, phone_number, password, full_name } = req.body;

      console.log(consoleStyle.info, '📦 Registration Data:');
      console.log(consoleStyle.data, `   Email: ${email}`);
      console.log(consoleStyle.data, `   Phone: ${phone_number}`);
      console.log(consoleStyle.data, `   Full Name: ${full_name || 'Not provided'}`);

      // Validate password
      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters'
        });
      }

      // Normalize phone
      const normalizedPhone = this.normalizePhoneNumber(phone_number);
      console.log(consoleStyle.data, `   Normalized Phone: ${normalizedPhone}`);

      // Check for existing user
      const existingUser = await db.User.findOne({
        where: {
          [db.Sequelize.Op.or]: [
            { email },
            { phone_number: normalizedPhone }
          ]
        }
      });

      if (existingUser) {
        console.log(consoleStyle.error, '❌ User already exists!');
        return res.status(400).json({
          success: false,
          message: 'User with this email or phone already exists'
        });
      }

      console.log(consoleStyle.info, '🔄 Creating user account...');

      // Create user
      const user = await db.User.create({
        email,
        phone_number: normalizedPhone,
        password_hash: password,
        full_name: full_name || null,
        user_type: 'customer', // Default - can change in step 2
        is_verified: false,
        is_agent_profile_complete: false
      });

      console.log(consoleStyle.success, `✅ User created! ID: ${user.id}`);

      // Create verification code
      const verificationData = await this.createVerificationCode(user.id, 'phone_verification');

      // Generate limited token
      const limitedToken = this.generateLimitedToken(user);

      console.log('\n' + consoleStyle.highlight, '='.repeat(60));
      console.log(consoleStyle.success, '   📱 VERIFICATION CODE SENT');
      console.log(consoleStyle.highlight, '='.repeat(60));
      console.log(consoleStyle.info, `   📞 Phone: ${phone_number}`);
      console.log(consoleStyle.highlight, `   🔢 Code: ${verificationData.code}`);
      console.log(consoleStyle.time, `   ⏰ Expires: ${formatKenyaTime(verificationData.expires_at)}`);
      console.log(consoleStyle.highlight, '='.repeat(60));

      res.status(201).json({
        success: true,
        message: 'Registration successful! Please verify your phone number.',
        requires_verification: true,
        requires_role_selection: true,
        next_step: 'verify_and_choose_role',
        token: limitedToken,
        verification_sent: true,
        user: {
          id: user.id,
          email: user.email,
          phone_number: user.phone_number,
          full_name: user.full_name,
          user_type: user.user_type,
          is_verified: user.is_verified
        }
      });

    } catch (error) {
      console.log(consoleStyle.error, '🔥 REGISTRATION ERROR:');
      console.log(consoleStyle.data, `   Error: ${error.message}`);
      
      res.status(500).json({
        success: false,
        message: 'Registration failed. Please try again.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  /**
   * 🔄 RESEND VERIFICATION CODE
   */
  resendVerification = async (req, res) => {
    console.log('\n' + '='.repeat(80));
    console.log(consoleStyle.header, '📱 RESEND VERIFICATION CODE');
    console.log(consoleStyle.time, `📅 Time: ${formatKenyaTime(new Date())}`);
    
    try {
      const { phone_number } = req.body;

      if (!phone_number) {
        return res.status(400).json({
          success: false,
          message: 'Phone number is required'
        });
      }

      console.log(consoleStyle.info, '📦 Resend request:');
      console.log(consoleStyle.data, `   Phone: ${phone_number}`);

      const normalizedPhone = this.normalizePhoneNumber(phone_number);
      console.log(consoleStyle.data, `   Normalized: ${normalizedPhone}`);

      // Find user
      const user = await db.User.findOne({
        where: { phone_number: normalizedPhone }
      });

      if (!user) {
        console.log(consoleStyle.error, '❌ User not found!');
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      console.log(consoleStyle.success, `✅ User found! ID: ${user.id}`);
      console.log(consoleStyle.data, `   Verified: ${user.is_verified ? 'Yes' : 'No'}`);

      if (user.is_verified) {
        console.log(consoleStyle.warning, '⚠️ User already verified');
        return res.json({
          success: true,
          message: 'Account already verified'
        });
      }

      // Create new verification code
      const verificationData = await this.createVerificationCode(user.id, 'phone_verification');

      console.log('\n' + consoleStyle.highlight, '='.repeat(60));
      console.log(consoleStyle.success, '   🔄 NEW VERIFICATION CODE');
      console.log(consoleStyle.highlight, '='.repeat(60));
      console.log(consoleStyle.info, `   📞 Phone: ${phone_number}`);
      console.log(consoleStyle.highlight, `   🔢 New Code: ${verificationData.code}`);
      console.log(consoleStyle.time, `   ⏰ Expires: ${formatKenyaTime(verificationData.expires_at)}`);
      console.log(consoleStyle.highlight, '='.repeat(60));

      res.json({
        success: true,
        message: 'New verification code sent',
        verification_sent: true,
        expires_at: verificationData.expires_at,
        user: {
          id: user.id,
          phone_number: user.phone_number
        }
      });

    } catch (error) {
      console.log(consoleStyle.error, '🔥 RESEND ERROR:');
      console.log(consoleStyle.data, `   Error: ${error.message}`);
      
      res.status(500).json({
        success: false,
        message: 'Failed to resend verification code',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  /**
   * ✅ STEP 2: VERIFY & CHOOSE ROLE
   */
  step2VerifyAndSetRole = async (req, res) => {
    console.log('\n' + '='.repeat(80));
    console.log(consoleStyle.header, '✅ STEP 2: VERIFY & CHOOSE ROLE');
    console.log(consoleStyle.time, `📅 Time: ${formatKenyaTime(new Date())}`);
    console.log('='.repeat(80));
    
    try {
      const { phone_number, verification_code, user_type } = req.body;

      console.log(consoleStyle.info, '📦 Verification Request:');
      console.log(consoleStyle.data, `   Phone: ${phone_number}`);
      console.log(consoleStyle.data, `   Code: ${verification_code}`);
      console.log(consoleStyle.data, `   Role: ${user_type}`);

      // Validation
      if (!phone_number || !verification_code || !user_type) {
        return res.status(400).json({
          success: false,
          message: 'Phone number, verification code, and user type are required'
        });
      }

      if (!['customer', 'agent'].includes(user_type)) {
        return res.status(400).json({
          success: false,
          message: 'User type must be "customer" or "agent"'
        });
      }

      // Normalize phone
      const normalizedPhone = this.normalizePhoneNumber(phone_number);

      // Find user
      const user = await db.User.findOne({
        where: { phone_number: normalizedPhone }
      });

      if (!user) {
        console.log(consoleStyle.error, '❌ User not found!');
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      console.log(consoleStyle.success, `✅ User found! ID: ${user.id}`);
      console.log(consoleStyle.data, `   Current Role: ${user.user_type}`);
      console.log(consoleStyle.data, `   Already Verified: ${user.is_verified ? 'Yes' : 'No'}`);

      // Check if already verified
      if (user.is_verified) {
        console.log(consoleStyle.warning, '⚠️ Account already verified');
        
        // If changing role from customer to agent
        if (user.user_type === 'customer' && user_type === 'agent') {
          user.user_type = 'agent';
          await user.save();
          
          console.log(consoleStyle.success, '🔄 Role updated to agent');
          
          const token = this.generateToken(user);
          
          return res.json({
            success: true,
            message: 'Role changed to agent! Complete your agent profile.',
            token: token,
            next_step: 'complete_agent_profile',
            requires_agent_profile: true,
            user: this.formatUserResponse(user)
          });
        }
        
        // Already correct role
        return res.json({
          success: true,
          message: `Account already verified as ${user.user_type}`,
          token: this.generateToken(user),
          user: this.formatUserResponse(user)
        });
      }

      // Find verification code
      const verificationRecord = await db.VerificationCode.findOne({
        where: {
          user_id: user.id,
          type: 'phone_verification',
          is_used: false,
          expires_at: { [db.Sequelize.Op.gt]: new Date() }
        },
        order: [['created_at', 'DESC']]
      });

      if (!verificationRecord) {
        console.log(consoleStyle.error, '❌ No active verification code found');
        return res.status(400).json({
          success: false,
          message: 'No active verification code found. Please request a new one.',
          can_resend: true
        });
      }

      // Check if expired
      if (new Date() > verificationRecord.expires_at) {
        console.log(consoleStyle.error, '⏰ Verification code expired');
        verificationRecord.is_used = true;
        await verificationRecord.save();
        
        return res.status(400).json({
          success: false,
          message: 'Verification code expired. Please request a new one.',
          can_resend: true
        });
      }

      // Verify code
      if (verificationRecord.code !== verification_code) {
        console.log(consoleStyle.error, '❌ Invalid verification code');
        verificationRecord.attempts += 1;
        await verificationRecord.save();
        
        const attemptsLeft = 5 - verificationRecord.attempts;
        
        return res.status(400).json({
          success: false,
          message: `Invalid verification code. ${attemptsLeft > 0 ? `${attemptsLeft} attempts left` : 'No attempts left'}`,
          attempts_left: attemptsLeft,
          can_resend: attemptsLeft <= 0
        });
      }

      console.log(consoleStyle.success, '✅ Verification code valid!');

      // Mark code as used
      verificationRecord.is_used = true;
      await verificationRecord.save();

      // Update user
      user.is_verified = true;
      user.user_type = user_type;
      
      if (user_type === 'agent') {
        user.is_agent_profile_complete = false;
        user.agent_status = 'pending_vetting';
      }
      
      await user.save();

      console.log(consoleStyle.success, `✅ User verified as ${user_type}!`);

      // Create wallet
      const [wallet, created] = await db.Wallet.findOrCreate({
        where: { user_id: user.id },
        defaults: {
          user_id: user.id,
          balance: 0.00,
          currency: 'KES'
        }
      });

      if (created) {
        console.log(consoleStyle.success, `💰 Wallet created! Balance: ${wallet.balance} KES`);
      }

      // Generate full token
      const fullToken = this.generateToken(user);

      console.log('\n' + consoleStyle.highlight, '='.repeat(60));
      console.log(consoleStyle.success, `   🎉 ${user_type.toUpperCase()} REGISTRATION COMPLETE!`);
      console.log(consoleStyle.highlight, '='.repeat(60));
      console.log(consoleStyle.info, `   👤 ID: ${user.id}`);
      console.log(consoleStyle.info, `   📞 Phone: ${user.phone_number}`);
      console.log(consoleStyle.info, `   📧 Email: ${user.email}`);
      console.log(consoleStyle.success, `   🏷️  Role: ${user.user_type}`);
      console.log(consoleStyle.success, `   ✅ Status: VERIFIED`);
      console.log(consoleStyle.success, `   💰 Wallet: ${wallet.balance} KES`);
      
      if (user_type === 'agent') {
        console.log(consoleStyle.warning, `   ⚠️  Next: Complete agent profile`);
      }
      
      console.log(consoleStyle.highlight, '='.repeat(60));

      const response = {
        success: true,
        message: `Registration complete! Welcome as ${user_type}.`,
        token: fullToken,
        user: this.formatUserResponse(user, wallet)
      };

      // Add next steps for agents
      if (user_type === 'agent') {
        response.next_step = 'complete_agent_profile';
        response.requires_agent_profile = true;
        response.message += ' Please complete your agent profile to start selling.';
      }

      res.json(response);

    } catch (error) {
      console.log(consoleStyle.error, '🔥 VERIFICATION ERROR:');
      console.log(consoleStyle.data, `   Error: ${error.message}`);
      
      res.status(500).json({
        success: false,
        message: 'Verification failed. Please try again.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  /**
   * 🏢 STEP 3: COMPLETE AGENT PROFILE
   */
  completeAgentProfile = async (req, res) => {
    console.log('\n' + '='.repeat(80));
    console.log(consoleStyle.header, '🏢 STEP 3: COMPLETE AGENT PROFILE');
    console.log(consoleStyle.time, `📅 Time: ${formatKenyaTime(new Date())}`);
    console.log('='.repeat(80));
    
    const transaction = await db.sequelize.transaction();
    
    try {
      const userId = req.user.id;
      const {
        business_name,
        business_address,
        area_name,
        latitude,
        longitude,
        gas_brand_ids,
        id_number,
        kra_pin,
        business_registration_number
      } = req.body;

      console.log(consoleStyle.info, '📦 Agent Profile Data:');
      console.log(consoleStyle.data, `   User ID: ${userId}`);
      console.log(consoleStyle.data, `   Business: ${business_name}`);
      console.log(consoleStyle.data, `   Location: ${area_name}`);
      console.log(consoleStyle.data, `   Brands: ${JSON.stringify(gas_brand_ids)}`);
      console.log(consoleStyle.data, `   ID Number: ${id_number || 'Not provided'}`);
      console.log(consoleStyle.data, `   KRA PIN: ${kra_pin || 'Not provided'}`);

      // Validation
      const requiredFields = ['business_name', 'business_address', 'area_name', 'gas_brand_ids'];
      const missingFields = requiredFields.filter(field => !req.body[field]);
      
      if (missingFields.length > 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Missing required fields: ${missingFields.join(', ')}`,
          missing_fields: missingFields
        });
      }

      if (!Array.isArray(gas_brand_ids) || gas_brand_ids.length === 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Please select at least one gas brand'
        });
      }

      // Validate gas brands exist
      console.log(consoleStyle.info, '🔍 Validating gas brands...');
      const brands = await db.GasBrand.findAll({
        where: { id: gas_brand_ids },
        transaction
      });

      if (brands.length !== gas_brand_ids.length) {
        await transaction.rollback();
        console.log(consoleStyle.error, '❌ Some gas brands not found');
        return res.status(400).json({
          success: false,
          message: 'One or more gas brands not found',
          invalid_brands: gas_brand_ids.filter(id => !brands.find(b => b.id === id))
        });
      }

      brands.forEach(brand => {
        console.log(consoleStyle.data, `   ✅ ${brand.name}`);
      });

      // Find user
      console.log(consoleStyle.info, '🔍 Finding user...');
      const user = await db.User.findOne({
        where: {
          id: userId,
          user_type: 'agent',
          is_verified: true
        },
        transaction
      });

      if (!user) {
        await transaction.rollback();
        console.log(consoleStyle.error, '❌ User not found or not an agent');
        return res.status(404).json({
          success: false,
          message: 'User not found or not an agent'
        });
      }

      if (user.is_agent_profile_complete) {
        await transaction.rollback();
        console.log(consoleStyle.warning, '⚠️ Agent profile already complete');
        return res.status(400).json({
          success: false,
          message: 'Agent profile already completed'
        });
      }

      console.log(consoleStyle.success, '✅ User is verified agent');

      // Update user with agent details
      console.log(consoleStyle.info, '🔄 Updating user details...');
      await user.update({
        business_name,
        business_address,
        area_name,
        latitude: latitude || null,
        longitude: longitude || null,
        id_number: id_number || null,
        kra_pin: kra_pin || null,
        business_registration_number: business_registration_number || null,
        is_agent_profile_complete: true,
        profile_completed_at: new Date(),
        agent_status: 'pending_vetting'
      }, { transaction });

      console.log(consoleStyle.success, '✅ User details updated');

      // Clear existing brand associations
      console.log(consoleStyle.info, '🔗 Managing brand associations...');
      await db.UserGasBrand.destroy({
        where: { user_id: userId },
        transaction
      });

      // Create new associations
      const userGasBrands = gas_brand_ids.map(brandId => ({
        user_id: userId,
        gas_brand_id: brandId,
        created_at: new Date(),
        updated_at: new Date()
      }));

      await db.UserGasBrand.bulkCreate(userGasBrands, { transaction });
      console.log(consoleStyle.success, `✅ Associated with ${userGasBrands.length} brand(s)`);

      // Create or update agent profile
      console.log(consoleStyle.info, '📋 Creating agent profile...');
      const [agentProfile, created] = await db.AgentProfile.findOrCreate({
        where: { agent_id: userId },
        defaults: {
          agent_id: userId,
          is_approved: false,
          approval_status: 'pending',
          rating: 0,
          total_orders: 0,
          commission_rate: 5.00,
          is_active: true
        },
        transaction
      });

      if (!created) {
        await agentProfile.update({
          approval_status: 'pending'
        }, { transaction });
      }

      console.log(consoleStyle.success, `✅ Agent profile ${created ? 'created' : 'updated'}`);

      // Create default gas listings
      console.log(consoleStyle.info, '📦 Creating default listings...');
      const createdListings = [];
      
      for (const brand of brands) {
        const existingListing = await db.AgentGasListing.findOne({
          where: {
            agent_id: userId,
            gas_brand_id: brand.id,
            size: '6kg'
          },
          transaction
        });

        if (!existingListing) {
          const listing = await db.AgentGasListing.create({
            agent_id: userId,
            gas_brand_id: brand.id,
            size: '6kg',
            selling_price: 1500.00,
            available_quantity: 10,
            is_available: true,
            cylinder_condition: 'new',
            delivery_available: true,
            delivery_fee: 100.00,
            is_approved: false,
            rating: 0,
            total_orders: 0,
            description: `Standard ${brand.name} 6kg cylinder`
          }, { transaction });
          
          createdListings.push(listing);
          console.log(consoleStyle.data, `   📍 Created ${brand.name} 6kg listing`);
        }
      }

      // Commit transaction
      await transaction.commit();
      console.log(consoleStyle.success, '✅ Transaction committed');

      // Get updated user
      const updatedUser = await db.User.findByPk(userId, {
        include: [
          {
            model: db.GasBrand,
            as: 'gasBrands',
            attributes: ['id', 'name', 'logo_url']
          },
          {
            model: db.AgentProfile,
            as: 'agentProfile',
            attributes: ['id', 'is_approved', 'approval_status', 'rating', 'total_orders']
          },
          {
            model: db.Wallet,
            as: 'wallet',
            attributes: ['balance', 'currency']
          }
        ]
      });

      // Generate new token
      const token = this.generateToken(updatedUser);

      console.log('\n' + consoleStyle.highlight, '='.repeat(60));
      console.log(consoleStyle.success, '   🎉 AGENT PROFILE COMPLETE!');
      console.log(consoleStyle.highlight, '='.repeat(60));
      console.log(consoleStyle.info, `   👤 Agent: ${updatedUser.full_name}`);
      console.log(consoleStyle.info, `   🏢 Business: ${business_name}`);
      console.log(consoleStyle.info, `   📍 Location: ${area_name}`);
      console.log(consoleStyle.success, `   🏷️  Brands: ${brands.length} brand(s)`);
      console.log(consoleStyle.success, `   📋 Listings: ${createdListings.length} created`);
      console.log(consoleStyle.warning, `   ⏳ Status: Pending admin approval`);
      console.log(consoleStyle.success, `   ✅ Profile: COMPLETE`);
      console.log(consoleStyle.highlight, '='.repeat(60));

      res.json({
        success: true,
        message: 'Agent profile completed successfully! Your account is now pending admin approval.',
        token: token,
        next_step: 'await_approval',
        user: this.formatUserResponse(updatedUser),
        agent_details: {
          business_name: updatedUser.business_name,
          area_name: updatedUser.area_name,
          gas_brands: updatedUser.gasBrands,
          profile_status: updatedUser.agentProfile?.approval_status,
          listings_created: createdListings.length
        }
      });

    } catch (error) {
      await transaction.rollback();
      console.log(consoleStyle.error, '🔥 AGENT PROFILE ERROR:');
      console.log(consoleStyle.data, `   Error: ${error.message}`);
      console.log(consoleStyle.data, `   Stack: ${error.stack}`);
      
      res.status(500).json({
        success: false,
        message: 'Failed to complete agent profile',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  // ============================================================================
  // OTHER AUTH METHODS
  // ============================================================================

  /**
   * 🔐 LOGIN
   */
  simpleLogin = async (req, res) => {
    console.log('\n' + '='.repeat(80));
    console.log(consoleStyle.header, '🔐 USER LOGIN');
    console.log(consoleStyle.time, `📅 Time: ${formatKenyaTime(new Date())}`);
    
    try {
      const { email, phone_number, password } = req.body;

      console.log(consoleStyle.info, '📦 Login attempt:');
      console.log(consoleStyle.data, `   Email: ${email || 'Not provided'}`);
      console.log(consoleStyle.data, `   Phone: ${phone_number || 'Not provided'}`);

      if ((!email && !phone_number) || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email/phone and password are required'
        });
      }

      let whereClause = {};
      if (email) {
        whereClause.email = email;
      } else {
        const normalizedPhone = this.normalizePhoneNumber(phone_number);
        whereClause.phone_number = normalizedPhone;
      }

      const user = await db.User.findOne({
        where: whereClause,
        include: [
          {
            model: db.Wallet,
            as: 'wallet'
          },
          {
            model: db.GasBrand,
            as: 'gasBrands'
          },
          {
            model: db.AgentProfile,
            as: 'agentProfile'
          }
        ]
      });

      if (!user) {
        console.log(consoleStyle.error, '❌ User not found');
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Check password
      const isValidPassword = await user.checkPassword(password);
      if (!isValidPassword) {
        console.log(consoleStyle.error, '❌ Invalid password');
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      console.log(consoleStyle.success, `✅ Login successful! ID: ${user.id}`);

      // Check if verified
      if (!user.is_verified) {
        console.log(consoleStyle.warning, '⚠️ Account not verified');
        return res.status(403).json({
          success: false,
          message: 'Please verify your account first',
          requires_verification: true,
          can_resend: true,
          phone_number: user.phone_number
        });
      }

      // Update last login
      user.last_login = new Date();
      await user.save();

      // Generate token
      const token = this.generateToken(user);

      const response = {
        success: true,
        message: 'Login successful',
        token: token,
        user: this.formatUserResponse(user)
      };

      // Add agent-specific info
      if (user.user_type === 'agent' && !user.is_agent_profile_complete) {
        response.requires_agent_profile = true;
        response.message += ' Please complete your agent profile.';
        response.next_step = 'complete_agent_profile';
      }

      res.json(response);

    } catch (error) {
      console.log(consoleStyle.error, '🔥 LOGIN ERROR:');
      console.log(consoleStyle.data, `   Error: ${error.message}`);
      
      res.status(500).json({
        success: false,
        message: 'Login failed'
      });
    }
  };

  /**
   * 📋 GET USER PROFILE - ENHANCED VERSION
   */
  getUserProfile = async (req, res) => {
    console.log('\n' + '='.repeat(80));
    console.log(consoleStyle.header, '📋 GET USER PROFILE');
    console.log(consoleStyle.time, `📅 Time: ${formatKenyaTime(new Date())}`);
    console.log('='.repeat(80));
    
    try {
      const userId = req.user.id;

      console.log(consoleStyle.info, '📦 Profile Request:');
      console.log(consoleStyle.data, `   User ID: ${userId}`);
      console.log(consoleStyle.data, `   User Type: ${req.user.user_type}`);
      console.log(consoleStyle.data, `   Email: ${req.user.email}`);

      const user = await db.User.findByPk(userId, {
        include: [
          {
            model: db.Wallet,
            as: 'wallet',
            attributes: ['id', 'balance', 'currency']
          },
          {
            model: db.GasBrand,
            as: 'gasBrands',
            attributes: ['id', 'name', 'logo_url'],
            through: { attributes: [] }
          },
          {
            model: db.AgentProfile,
            as: 'agentProfile',
            attributes: ['id', 'rating', 'total_orders', 'commission_rate', 'approval_status']
          }
        ],
        attributes: {
          exclude: ['password_hash', 'reset_token', 'reset_token_expiry']
        }
      });

      if (!user) {
        console.log(consoleStyle.error, '❌ User not found');
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const formattedUser = {
        id: user.id,
        email: user.email,
        phone_number: user.phone_number,
        full_name: user.full_name,
        user_type: user.user_type,
        is_verified: user.is_verified,
        is_agent_profile_complete: user.is_agent_profile_complete,
        address: user.address,
        area_name: user.area_name,
        town: user.town,
        county: user.county,
        created_at: user.created_at,
        wallet: user.wallet,
        gas_brands: user.gasBrands,
        agent_profile: user.agentProfile
      };

      // Add agent-specific fields
      if (user.user_type === 'agent') {
        formattedUser.business_name = user.business_name;
        formattedUser.agent_status = user.agent_status;
        formattedUser.business_address = user.business_address;
        formattedUser.profile_completed_at = user.profile_completed_at;
      }

      console.log(consoleStyle.success, '✅ Profile fetched successfully');
      console.log(consoleStyle.data, `   User: ${formattedUser.full_name || formattedUser.email}`);
      console.log(consoleStyle.data, `   Type: ${formattedUser.user_type}`);
      console.log(consoleStyle.data, `   Verified: ${formattedUser.is_verified ? 'Yes' : 'No'}`);

      res.json({
        success: true,
        user: formattedUser,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.log(consoleStyle.error, '🔥 PROFILE ERROR:');
      console.log(consoleStyle.data, `   Error: ${error.message}`);
      console.log(consoleStyle.data, `   Stack: ${error.stack}`);
      
      res.status(500).json({
        success: false,
        message: 'Failed to get profile',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  /**
   * ✏️ UPDATE USER PROFILE
   */
  updateUserProfile = async (req, res) => {
    console.log('\n' + '='.repeat(80));
    console.log(consoleStyle.header, '✏️ UPDATE USER PROFILE');
    console.log(consoleStyle.time, `📅 Time: ${formatKenyaTime(new Date())}`);
    
    try {
      const userId = req.user.id;
      const {
        full_name,
        email,
        phone_number,
        address,
        area_name,
        town,
        county
      } = req.body;

      console.log(consoleStyle.info, '📦 Update Request:');
      console.log(consoleStyle.data, `   User ID: ${userId}`);
      console.log(consoleStyle.data, `   Full Name: ${full_name || 'Not provided'}`);
      console.log(consoleStyle.data, `   Email: ${email || 'Not provided'}`);
      console.log(consoleStyle.data, `   Phone: ${phone_number || 'Not provided'}`);

      const user = await db.User.findByPk(userId);

      if (!user) {
        console.log(consoleStyle.error, '❌ User not found');
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Build update object
      const updates = {};
      if (full_name !== undefined) updates.full_name = full_name;
      if (email !== undefined) updates.email = email;
      if (phone_number !== undefined) updates.phone_number = this.normalizePhoneNumber(phone_number);
      if (address !== undefined) updates.address = address;
      if (area_name !== undefined) updates.area_name = area_name;
      if (town !== undefined) updates.town = town;
      if (county !== undefined) updates.county = county;
      updates.updated_at = new Date();

      await user.update(updates);

      // Get updated user
      const updatedUser = await db.User.findByPk(userId, {
        include: [
          {
            model: db.Wallet,
            as: 'wallet',
            attributes: ['id', 'balance', 'currency']
          }
        ],
        attributes: {
          exclude: ['password_hash', 'reset_token', 'reset_token_expiry']
        }
      });

      const formattedUser = {
        id: updatedUser.id,
        email: updatedUser.email,
        phone_number: updatedUser.phone_number,
        full_name: updatedUser.full_name,
        user_type: updatedUser.user_type,
        is_verified: updatedUser.is_verified,
        address: updatedUser.address,
        area_name: updatedUser.area_name,
        town: updatedUser.town,
        county: updatedUser.county,
        wallet: updatedUser.wallet
      };

      console.log(consoleStyle.success, '✅ Profile updated successfully');
      console.log(consoleStyle.data, `   Updated fields: ${Object.keys(updates).join(', ')}`);

      res.json({
        success: true,
        message: 'Profile updated successfully',
        user: formattedUser,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.log(consoleStyle.error, '🔥 UPDATE PROFILE ERROR:');
      console.log(consoleStyle.data, `   Error: ${error.message}`);
      
      res.status(500).json({
        success: false,
        message: 'Failed to update profile',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  /**
   * 🚪 LOGOUT USER - ENHANCED VERSION
   */
  logoutUser = async (req, res) => {
    console.log('\n' + '='.repeat(80));
    console.log(consoleStyle.header, '🚪 USER LOGOUT');
    console.log(consoleStyle.time, `📅 Time: ${formatKenyaTime(new Date())}`);
    console.log('='.repeat(80));
    
    try {
      console.log(consoleStyle.info, '📦 Logout Request:');
      console.log(consoleStyle.data, `   User ID: ${req.user?.id || 'Unknown'}`);
      console.log(consoleStyle.data, `   Email: ${req.user?.email || 'Unknown'}`);
      console.log(consoleStyle.data, `   User Type: ${req.user?.user_type || 'Unknown'}`);
      console.log(consoleStyle.data, `   Method: ${req.method}`);
      console.log(consoleStyle.data, `   IP: ${req.ip || req.connection.remoteAddress}`);

      // Get token from header for logging
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        console.log(consoleStyle.data, `   Token length: ${token.length} chars`);
      }

      // Update last logout time
      if (req.user?.id) {
        await db.User.update(
          { last_logout: new Date() },
          { where: { id: req.user.id } }
        );
        console.log(consoleStyle.success, '✅ Updated last logout time');
      }

      console.log('\n' + consoleStyle.highlight, '='.repeat(60));
      console.log(consoleStyle.success, '   ✅ LOGOUT SUCCESSFUL');
      console.log(consoleStyle.highlight, '='.repeat(60));
      console.log(consoleStyle.info, `   👤 User: ${req.user?.email || 'Unknown'}`);
      console.log(consoleStyle.info, `   🆔 ID: ${req.user?.id || 'Unknown'}`);
      console.log(consoleStyle.time, `   ⏰ Time: ${formatKenyaTime(new Date())}`);
      console.log(consoleStyle.highlight, '='.repeat(60));

      res.status(200).json({
        success: true,
        message: 'Logged out successfully',
        timestamp: new Date().toISOString(),
        server_time_kenya: formatKenyaTime(new Date()),
        user_info: {
          id: req.user?.id,
          email: req.user?.email,
          user_type: req.user?.user_type
        },
        action: 'logout_complete'
      });

    } catch (error) {
      console.log(consoleStyle.error, '🔥 LOGOUT ERROR:');
      console.log(consoleStyle.data, `   Error: ${error.message}`);
      
      // Even if error occurs, send success response to client
      res.status(200).json({
        success: true,
        message: 'Logged out (backend cleanup may have issues)',
        timestamp: new Date().toISOString(),
        note: 'Client should clear local storage'
      });
    }
  };

  /**
   * 🗑️ DELETE ACCOUNT
   */
  deleteAccount = async (req, res) => {
    console.log('\n' + '='.repeat(80));
    console.log(consoleStyle.header, '🗑️ DELETE ACCOUNT');
    console.log(consoleStyle.time, `📅 Time: ${formatKenyaTime(new Date())}`);
    
    try {
      const userId = req.user.id;

      console.log(consoleStyle.info, '📦 Delete Request:');
      console.log(consoleStyle.data, `   User ID: ${userId}`);
      console.log(consoleStyle.data, `   Email: ${req.user.email}`);

      const user = await db.User.findByPk(userId);

      if (!user) {
        console.log(consoleStyle.error, '❌ User not found');
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Soft delete - mark as inactive
      await user.update({
        is_active: false,
        deleted_at: new Date(),
        updated_at: new Date()
      });

      console.log(consoleStyle.success, '✅ Account marked as deleted');

      res.json({
        success: true,
        message: 'Account deleted successfully',
        timestamp: new Date().toISOString(),
        note: 'Account has been marked as inactive'
      });

    } catch (error) {
      console.log(consoleStyle.error, '🔥 DELETE ACCOUNT ERROR:');
      console.log(consoleStyle.data, `   Error: ${error.message}`);
      
      res.status(500).json({
        success: false,
        message: 'Failed to delete account',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  /**
   * 🐛 DEBUG USER
   */
  debugUser = async (req, res) => {
    console.log('\n' + '='.repeat(80));
    console.log(consoleStyle.header, '🐛 DEBUG USER INFO');
    
    try {
      const { phone_number, email } = req.query;

      let whereClause = {};
      if (phone_number) {
        whereClause.phone_number = this.normalizePhoneNumber(phone_number);
      }
      if (email) whereClause.email = email;

      const user = await db.User.findOne({
        where: whereClause,
        include: [
          {
            model: db.VerificationCode,
            as: 'verificationCodes',
            where: { is_used: false },
            required: false
          }
        ]
      });

      if (!user) {
        return res.json({
          success: true,
          message: 'User not found',
          found: false
        });
      }

      res.json({
        success: true,
        user: this.formatUserResponse(user),
        verification_codes: user.verificationCodes,
        current_time: new Date().toISOString()
      });

    } catch (error) {
      console.log(consoleStyle.error, 'Debug error:', error);
      res.status(500).json({
        success: false,
        message: 'Debug failed'
      });
    }
  };

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  formatUserResponse = (user, wallet = null) => {
    const response = {
      id: user.id,
      email: user.email,
      phone_number: user.phone_number,
      full_name: user.full_name,
      user_type: user.user_type,
      is_verified: user.is_verified,
      is_agent_profile_complete: user.is_agent_profile_complete,
      wallet: wallet || user.wallet,
      created_at: user.created_at
    };

    // Add agent-specific fields
    if (user.user_type === 'agent') {
      response.business_name = user.business_name;
      response.area_name = user.area_name;
      response.agent_status = user.agent_status;
      response.profile_completed_at = user.profile_completed_at;
      response.gas_brands = user.gasBrands || [];
      response.agent_profile = user.agentProfile;
    }

    return response;
  };
}

module.exports = new AuthController();