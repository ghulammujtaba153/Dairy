const rawMaterialSchema = {
    tableName: 'raw_materials',
    fields: {
        id: {
            type: 'SERIAL',
            primaryKey: true
        },
        supplier_id: {
            type: 'INTEGER',
            required: true,
            references: {
                table: 'suppliers',
                field: 'id'
            }
        },
        material: {
            type: 'VARCHAR(255)',
            required: true
        },
        quantity: {
            type: 'INTEGER',
            required: true
        },
        unit: {
            type: 'VARCHAR(20)',
            required: true
        },
        price: {
            type: 'DECIMAL(10, 2)',
            required: true
        },
        total_price: {
            type: 'DECIMAL(10, 2)',
            required: true
        },
        paid_amount: {
            type: 'DECIMAL(10, 2)',
            required: true
        },
        remaining_amount: {
            type: 'DECIMAL(10, 2)',
            required: true
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
                supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
                material VARCHAR(255) NOT NULL,
                quantity INTEGER NOT NULL,
                unit VARCHAR(20) NOT NULL,
                price DECIMAL(10, 2) NOT NULL,
                total_price DECIMAL(10, 2) NOT NULL,
                paid_amount DECIMAL(10, 2) DEFAULT 0,
                remaining_amount DECIMAL(10, 2) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;
    },
    validate: {
        material: (material) => {
            if (!material || material.trim().length === 0) {
                throw new Error('Material name is required');
            }
            return true;
        },
        quantity: (quantity) => {
            if (quantity === undefined || quantity === null || quantity < 0) {
                throw new Error('Valid quantity is required');
            }
            return true;
        },
        price: (price) => {
            if (price === undefined || price === null || price < 0) {
                throw new Error('Valid price is required');
            }
            return true;
        },
        supplier_id: (id) => {
            if (!id) {
                throw new Error('Supplier ID is required');
            }
            return true;
        }
    },
    sanitize: (rawMaterial) => {
        if (!rawMaterial) return null;
        // Convert string decimals to numbers for JSON response
        return {
            ...rawMaterial,
            price: Number(rawMaterial.price),
            total_price: Number(rawMaterial.total_price),
            paid_amount: Number(rawMaterial.paid_amount),
            remaining_amount: Number(rawMaterial.remaining_amount)
        };
    }
};

module.exports = rawMaterialSchema;