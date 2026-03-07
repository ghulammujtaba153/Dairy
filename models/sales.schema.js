/**
 * Sales Schema
 */

const salesSchema = {
    tableName: 'sales',
    fields: {
        id: {
            type: 'SERIAL',
            primaryKey: true
        },
        customer_id: {
            type: 'INTEGER',
            required: true,
            references: {
                table: 'clients',
                field: 'id'
            }
        },
        production_id: {
            type: 'INTEGER',
            required: false,
            references: {
                table: 'production',
                field: 'id'
            }
        },
        raw_material_id: {
            type: 'INTEGER',
            required: false,
            references: {
                table: 'raw_materials',
                field: 'id'
            }
        },
        quantity: {
            type: 'DECIMAL(10, 2)',
            required: true
        },
        price: {
            type: 'DECIMAL(10, 2)',
            required: true
        },
        total: {
            type: 'DECIMAL(10, 2)',
            required: true
        },
        payment_status: {
            type: 'VARCHAR(20)',
            enum: ['cash', 'bank', 'jazzcash', 'easypaisa', 'credit'],
            default: 'cash'
        },
        status: {
            type: 'VARCHAR(20)',
            enum: ['paid', 'unpaid', 'partial'],
            default: 'paid'
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
                customer_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
                production_id INTEGER REFERENCES production(id) ON DELETE SET NULL,
                raw_material_id INTEGER REFERENCES raw_materials(id) ON DELETE SET NULL,
                quantity DECIMAL(10, 2) NOT NULL,
                price DECIMAL(10, 2) NOT NULL,
                total DECIMAL(10, 2) NOT NULL,
                payment_status VARCHAR(20) DEFAULT 'cash' CHECK (payment_status IN ('cash', 'bank', 'jazzcash', 'easypaisa', 'credit')),
                status VARCHAR(20) DEFAULT 'paid' CHECK (status IN ('paid', 'unpaid', 'partial')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                -- Ensure either production_id or raw_material_id is set
                CONSTRAINT item_check CHECK (
                    (production_id IS NOT NULL AND raw_material_id IS NULL) OR
                    (production_id IS NULL AND raw_material_id IS NOT NULL)
                )
            )
        `;
    },

    validate: {
        customer_id: (id) => {
            if (!id) throw new Error('Customer ID is required');
            return true;
        },
        item: (productionId, rawMaterialId) => {
            if (!productionId && !rawMaterialId) {
                throw new Error('Either production item or raw material is required');
            }
            if (productionId && rawMaterialId) {
                throw new Error('Cannot sell both production item and raw material in the same line');
            }
            return true;
        },
        quantity: (qty) => {
            if (qty <= 0) throw new Error('Quantity must be greater than zero');
            return true;
        },
        price: (price) => {
            if (price < 0) throw new Error('Price cannot be negative');
            return true;
        }
    },

    sanitize: (sale) => {
        if (!sale) return null;
        return {
            ...sale,
            quantity: Number(sale.quantity || 0),
            price: Number(sale.price || 0),
            total: Number(sale.total || 0),
            customer_id: Number(sale.customer_id),
            production_id: sale.production_id ? Number(sale.production_id) : null,
            raw_material_id: sale.raw_material_id ? Number(sale.raw_material_id) : null
        };
    }
};

module.exports = salesSchema;