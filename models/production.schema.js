
const productionSchema = {
    tableName: 'production',
    fields: {
        id: {
            type: 'SERIAL',
            primaryKey: true
        },
        production_name: {
            type: 'VARCHAR(255)',
            required: true
        },
        production_date: {
            type: 'DATE',
            required: true
        },
        raw_material_id: {
            type: 'INTEGER',
            required: true,
            references: {
                table: 'raw_materials',
                field: 'id'
            }
        },
        raw_material_quantity: {
            type: 'INTEGER',
            required: true
        },
        production_output: {
            type: 'INTEGER',
            required: true
        },
        efficiency: {
            type: 'INTEGER',
            required: true
        },
        labour_cost: {
            type: 'INTEGER',
            required: true
        },
        other_cost: {
            type: 'INTEGER',
            required: true
        },
        total_cost: {
            type: 'INTEGER',
            required: true
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
                production_name VARCHAR(255) NOT NULL,
                production_date DATE NOT NULL,
                raw_material_id INTEGER NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
                raw_material_quantity INTEGER NOT NULL,
                production_output INTEGER NOT NULL,
                efficiency INTEGER NOT NULL,
                labour_cost INTEGER NOT NULL,
                other_cost INTEGER NOT NULL,
                total_cost INTEGER NOT NULL,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;
    },
    validate: {
        production_name: (name) => {
            if (!name || name.trim().length === 0) {
                throw new Error('Production name is required');
            }
            return true;
        },
        production_date: (date) => {
            if (!date) {
                throw new Error('Production date is required');
            }
            return true;
        },
        raw_material_id: (id) => {
            if (!id) {
                throw new Error('Raw material ID is required');
            }
            return true;
        },
        costs: (labour, other, total) => {
            if (labour < 0 || other < 0 || total < 0) {
                throw new Error('Costs cannot be negative');
            }
            return true;
        }
    },
    sanitize: (production) => {
        if (!production) return null;
        return {
            ...production,
            labour_cost: Number(production.labour_cost),
            other_cost: Number(production.other_cost),
            total_cost: Number(production.total_cost),
            efficiency: Number(production.efficiency)
        };
    }
};

module.exports = productionSchema;