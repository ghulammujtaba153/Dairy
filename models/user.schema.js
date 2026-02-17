/**
 * User Schema/Model
 * Defines the structure and validation for user data
 */

const userSchema = {
  // Table name
  tableName: 'users',
  
  // Fields definition
  fields: {
    id: {
      type: 'SERIAL',
      primaryKey: true
    },
    email: {
      type: 'VARCHAR(255)',
      unique: true,
      required: true,
      validate: (value) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(value);
      }
    },
    password_hash: {
      type: 'VARCHAR(255)',
      required: true
    },
    name: {
      type: 'VARCHAR(255)',
      required: false
    },
    created_at: {
      type: 'TIMESTAMP',
      default: 'CURRENT_TIMESTAMP'
    },
    updated_at: {
      type: 'TIMESTAMP',
      default: 'CURRENT_TIMESTAMP'
    }
  },

  // SQL for creating the table
  getCreateTableSQL() {
    return `
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
  },

  // Validation methods
  validate: {
    email(email) {
      if (!email) {
        throw new Error('Email is required');
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error('Invalid email format');
      }
      return true;
    },

    password(password) {
      if (!password) {
        throw new Error('Password is required');
      }
      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }
      return true;
    },

    name(name) {
      // Name is optional, but if provided, should not be empty
      if (name !== undefined && name !== null && name.trim() === '') {
        throw new Error('Name cannot be empty');
      }
      return true;
    }
  },

  // Helper method to sanitize user data (remove sensitive fields)
  sanitizeUser(user) {
    if (!user) return null;
    const { password_hash, ...sanitizedUser } = user;
    return sanitizedUser;
  }
};

module.exports = userSchema;
