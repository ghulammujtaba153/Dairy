/**
 * Inventory Schema
 */

const inventorySchema = {
  tableName: 'inventory',
  movementsTable: 'stock_movements',
  
  getCreateTableSQL() {
    return `
      CREATE TABLE IF NOT EXISTS inventory (
        id SERIAL PRIMARY KEY,
        product_name VARCHAR(255) UNIQUE NOT NULL,
        in_hand_quantity DECIMAL(10, 2) DEFAULT 0,
        in_market_quantity DECIMAL(10, 2) DEFAULT 0,
        unit VARCHAR(20) NOT NULL,
        min_stock_level DECIMAL(10, 2) DEFAULT 0,
        price DECIMAL(10, 2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
  },

  getMovementsTableSQL() {
    return `
      CREATE TABLE IF NOT EXISTS stock_movements (
        id SERIAL PRIMARY KEY,
        movement_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        product_name VARCHAR(255) NOT NULL,
        movement_type VARCHAR(10) CHECK (movement_type IN ('in', 'out', 'market')),
        quantity DECIMAL(10, 2) NOT NULL,
        unit VARCHAR(20) NOT NULL,
        reference_id VARCHAR(50),
        source_destination VARCHAR(255),
        price DECIMAL(10, 2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
  },

  validate: {
    inventory: (data) => {
      if (!data.product_name) throw new Error('Product name is required');
      if (data.in_hand_quantity < 0) throw new Error('In-hand quantity cannot be negative');
      return true;
    },
    movement: (data) => {
      if (!data.product_name) throw new Error('Product name is required');
      if (!data.movement_type) throw new Error('Movement type is required');
      if (data.quantity <= 0) throw new Error('Quantity must be greater than zero');
      return true;
    }
  },

  sanitize: (item) => {
    if (!item) return null;
    return {
      ...item,
      in_hand_quantity: Number(item.in_hand_quantity || 0),
      in_market_quantity: Number(item.in_market_quantity || 0),
      min_stock_level: Number(item.min_stock_level || 0),
      price: Number(item.price || 0),
      quantity: item.quantity ? Number(item.quantity) : undefined,
      movement_price: item.price ? Number(item.price) : undefined
    };
  }
};

module.exports = inventorySchema;
