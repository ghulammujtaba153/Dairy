const clientsSchema = {
    tableName: 'clients',
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
    validate: {
        name: (name) => {
            if (!name || name.trim().length === 0) {
                throw new Error('Client name is required');
            }
            if (name.length > 255) {
                throw new Error('Client name must be less than 255 characters');
            }
            return true;
        },
        email: (email) => {
            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                throw new Error('Invalid email format');
            }
            return true;
        },
        phone: (phone) => {
            if (phone && !/^\+?[0-9\s\-()]+$/.test(phone)) {
                throw new Error('Invalid phone format');
            }
            return true;
        }
    },
    sanitize: (client) => {
        if (!client) return null;
        const { ...sanitized } = client;
        return sanitized;
    }
};

module.exports = clientsSchema;