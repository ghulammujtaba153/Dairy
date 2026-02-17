const suppliersSchema = {
  // Table name
  tableName: 'suppliers',
  
  // Fields definition
  fields: {
    id: {
      type: 'SERIAL',
      primaryKey: true
    },
    name: {
      type: 'VARCHAR(255)',
      required: true
    },
    email: {
      type: 'VARCHAR(255)',
      required: false
    },
    phone: {
      type: 'VARCHAR(20)',
      required: false
    },
    address: {
      type: 'TEXT',
      required: false
    },
    notes: {
      type: 'TEXT',
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
  
  // Indexes
  indexes: {
    email: {
      type: 'UNIQUE',
      fields: ['email']
    }
  },
  
  // SQL for creating the table
  getCreateTableSQL() {
    return `
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE,
        phone VARCHAR(20),
        address TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
  },
  
  // Validation methods
  validate: {
    name: (name) => {
      if (!name || name.trim().length === 0) {
        throw new Error('Supplier name is required');
      }
      if (name.length > 255) {
        throw new Error('Supplier name must be less than 255 characters');
      }
    },
    email: (email) => {
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error('Invalid email format');
      }
    },
    phone: (phone) => {
      if (phone && !/^\+?[0-9\s\-()]+$/.test(phone)) {
        throw new Error('Invalid phone format');
      }
    }
  },
  
  // Sanitization method
  sanitize: (supplier) => {
    if (!supplier) return null;
    const { ...sanitized } = supplier;
    return sanitized;
  }
};

module.exports = suppliersSchema;