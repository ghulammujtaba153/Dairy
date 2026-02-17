/**
 * Auth Controller
 * Handles all authentication-related business logic
 */

const { sql } = require('../db');
const { hashPassword, comparePassword, generateToken } = require('../utils/auth');
const userSchema = require('../models/user.schema');

class AuthController {
  /**
   * Register a new user
   */
  async register(req, res) {
    try {
      const { email, password, name } = req.body;

      // Validate input using schema
      userSchema.validate.email(email);
      userSchema.validate.password(password);
      if (name) {
        userSchema.validate.name(name);
      }

      // Check if user already exists
      const existingUser = await sql`
        SELECT id FROM users WHERE email = ${email}
      `;

      if (existingUser.length > 0) {
        return res.status(409).json({ 
          error: 'User with this email already exists' 
        });
      }

      // Hash password
      const passwordHash = await hashPassword(password);

      // Create user
      const result = await sql`
        INSERT INTO users (email, password_hash, name)
        VALUES (${email}, ${passwordHash}, ${name || null})
        RETURNING id, email, name, created_at
      `;

      const user = result[0];

      // Generate JWT token
      const token = generateToken({ 
        id: user.id, 
        email: user.email 
      });

      // Send response
      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: userSchema.sanitizeUser(user),
          token
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      
      // Handle validation errors
      if (error.message.includes('required') || 
          error.message.includes('Invalid') ||
          error.message.includes('must be')) {
        return res.status(400).json({ 
          error: error.message 
        });
      }

      res.status(500).json({ 
        error: 'Registration failed. Please try again.' 
      });
    }
  }

  /**
   * Login user
   */
  async login(req, res) {
    try {
      const { email, password } = req.body;

      // Validate input
      userSchema.validate.email(email);
      userSchema.validate.password(password);

      // Find user by email
      const users = await sql`
        SELECT id, email, password_hash, name, created_at 
        FROM users 
        WHERE email = ${email}
      `;

      if (users.length === 0) {
        return res.status(401).json({ 
          error: 'Invalid email or password' 
        });
      }

      const user = users[0];

      // Verify password
      const isValidPassword = await comparePassword(password, user.password_hash);

      if (!isValidPassword) {
        return res.status(401).json({ 
          error: 'Invalid email or password' 
        });
      }

      // Update last login (optional - would need to add field to schema)
      await sql`
        UPDATE users 
        SET updated_at = CURRENT_TIMESTAMP 
        WHERE id = ${user.id}
      `;

      // Generate JWT token
      const token = generateToken({ 
        id: user.id, 
        email: user.email 
      });

      // Send response
      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: userSchema.sanitizeUser(user),
          token
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      
      // Handle validation errors
      if (error.message.includes('required') || 
          error.message.includes('Invalid')) {
        return res.status(400).json({ 
          error: error.message 
        });
      }

      res.status(500).json({ 
        error: 'Login failed. Please try again.' 
      });
    }
  }

  /**
   * Get current user profile
   */
  async getProfile(req, res) {
    try {
      // req.user is set by authenticateToken middleware
      const users = await sql`
        SELECT id, email, name, created_at, updated_at 
        FROM users 
        WHERE id = ${req.user.id}
      `;

      if (users.length === 0) {
        return res.status(404).json({ 
          error: 'User not found' 
        });
      }

      const user = users[0];

      res.json({
        success: true,
        data: {
          user: userSchema.sanitizeUser(user)
        }
      });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve user profile' 
      });
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(req, res) {
    try {
      const { name } = req.body;
      const userId = req.user.id;

      // Validate input
      if (name) {
        userSchema.validate.name(name);
      }

      // Update user
      const result = await sql`
        UPDATE users 
        SET 
          name = ${name || null},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${userId}
        RETURNING id, email, name, created_at, updated_at
      `;

      if (result.length === 0) {
        return res.status(404).json({ 
          error: 'User not found' 
        });
      }

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          user: userSchema.sanitizeUser(result[0])
        }
      });
    } catch (error) {
      console.error('Update profile error:', error);
      
      if (error.message.includes('cannot be empty')) {
        return res.status(400).json({ 
          error: error.message 
        });
      }

      res.status(500).json({ 
        error: 'Failed to update profile' 
      });
    }
  }

  /**
   * Delete user account
   */
  async deleteAccount(req, res) {
    try {
      const userId = req.user.id;

      const result = await sql`
        DELETE FROM users 
        WHERE id = ${userId}
        RETURNING id
      `;

      if (result.length === 0) {
        return res.status(404).json({ 
          error: 'User not found' 
        });
      }

      res.json({
        success: true,
        message: 'Account deleted successfully'
      });
    } catch (error) {
      console.error('Delete account error:', error);
      res.status(500).json({ 
        error: 'Failed to delete account' 
      });
    }
  }
}

// Export a singleton instance
module.exports = new AuthController();
