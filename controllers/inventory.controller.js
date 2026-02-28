/**
 * Inventory Controller
 */

const { sql } = require('../db');
const inventorySchema = require('../models/inventory.schema');

class InventoryController {
  /**
   * Get all inventory stock
   */
  async getStock(req, res) {
    try {
      const records = await sql`SELECT * FROM inventory ORDER BY product_name ASC`;
      
      res.json({
        success: true,
        data: records.map(r => inventorySchema.sanitize(r))
      });
    } catch (error) {
      console.error('Get inventory stock error:', error);
      res.status(500).json({ error: 'Failed to retrieve inventory' });
    }
  }

  /**
   * Get recent movements
   */
  async getMovements(req, res) {
    try {
      const records = await sql`
        SELECT * FROM stock_movements 
        ORDER BY movement_date DESC 
        LIMIT 50
      `;
      res.json({
        success: true,
        data: records.map(r => inventorySchema.sanitize(r))
      });
    } catch (error) {
      console.error('Get stock movements error:', error);
      res.status(500).json({ error: 'Failed to retrieve movements' });
    }
  }

  /**
   * Get inventory statistics
   */
  async getStats(req, res) {
    try {
      const stock = await sql`SELECT * FROM inventory`;
      
      const totalValue = stock.reduce((sum, item) => sum + Number(item.price || 0), 0);
      
      const inMarketValue = stock.reduce((sum, item) => {
        const qtyInHand = Number(item.in_hand_quantity || 0);
        const qtyInMarket = Number(item.in_market_quantity || 0);
        if (qtyInHand === 0) return sum;
        const unitPrice = Number(item.price || 0) / qtyInHand;
        return sum + (qtyInMarket * unitPrice);
      }, 0);

      const inWarehouseValue = totalValue - inMarketValue;
      
      const lowStockCount = stock.filter(item => {
        const available = Number(item.in_hand_quantity || 0) - Number(item.in_market_quantity || 0);
        return available < Number(item.min_stock_level || 0);
      }).length;

      // Calculate last 7 days movement trend for charts
      const trendData = await sql`
        SELECT 
          movement_date::date as date,
          SUM(CASE WHEN movement_type = 'in' THEN quantity ELSE 0 END) as inflow,
          SUM(CASE WHEN movement_type IN ('out', 'market') THEN quantity ELSE 0 END) as outflow
        FROM stock_movements
        WHERE movement_date >= now() - interval '7 days'
        GROUP BY movement_date::date
        ORDER BY movement_date::date ASC
      `;

      const movementData = trendData.map(t => ({
        date: new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        inflow: Number(t.inflow || 0),
        outflow: Number(t.outflow || 0)
      }));

      res.json({
        success: true,
        data: {
          totalValue,
          inHandValue: inWarehouseValue,
          inMarketValue: inMarketValue,
          lowStockCount,
          movementData
        }
      });
    } catch (error) {
      console.error('Get inventory stats error:', error);
      res.status(500).json({ error: 'Failed to retrieve statistics' });
    }
  }

  /**
   * Record a new movement
   */
    async recordMovement(req, res) {
    try {
      const { product_name, movement_type, quantity, unit, reference_id, source_destination, price } = req.body;
      
      inventorySchema.validate.movement({ product_name, movement_type, quantity });

      // Begin transaction-like approach (sequence of queries)
      // 1. Record the movement
      const movement = await sql`
        INSERT INTO stock_movements (
          product_name, movement_type, quantity, unit, reference_id, source_destination, price
        )
        VALUES (${product_name}, ${movement_type}, ${quantity}, ${unit}, ${reference_id}, ${source_destination}, ${price || 0})
        RETURNING *
      `;

      // 2. Update inventory quantities
      // First check if product exists in inventory
      const existing = await sql`SELECT * FROM inventory WHERE product_name = ${product_name}`;
      
      if (existing.length === 0) {
        // Create initial stock record if it doesn't exist
        let in_hand = 0;
        let in_market = 0;
        
        if (movement_type === 'in') in_hand = quantity;
        else if (movement_type === 'out') in_hand = -quantity;
        else if (movement_type === 'market') {
          in_hand = quantity;
          in_market = quantity;
        }

        await sql`
          INSERT INTO inventory (product_name, in_hand_quantity, in_market_quantity, unit, price)
          VALUES (${product_name}, ${in_hand}, ${in_market}, ${unit || 'kg'}, 0)
        `;
      } else {
        // Update existing record
        if (movement_type === 'in') {
          await sql`
            UPDATE inventory SET 
              in_hand_quantity = in_hand_quantity + ${quantity}, 
              updated_at = CURRENT_TIMESTAMP
            WHERE product_name = ${product_name}
          `;
        } else if (movement_type === 'out') {
          await sql`
            UPDATE inventory SET 
              price = CASE WHEN in_hand_quantity > 0 THEN price - (${quantity} * (price / in_hand_quantity)) ELSE price END,
              in_hand_quantity = in_hand_quantity - ${quantity}, 
              updated_at = CURRENT_TIMESTAMP
            WHERE product_name = ${product_name}
          `;
        } else if (movement_type === 'market') {
          await sql`
            UPDATE inventory SET 
              in_market_quantity = in_market_quantity + ${quantity}, 
              updated_at = CURRENT_TIMESTAMP
            WHERE product_name = ${product_name}
          `;
        }
      }

      res.status(201).json({
        success: true,
        message: 'Stock movement recorded successfully',
        data: inventorySchema.sanitize(movement[0])
      });
    } catch (error) {
      console.error('Record stock movement error:', error);
      res.status(500).json({ error: error.message || 'Failed to record movement' });
    }
  }

  /**
   * Update product details (price, min stock)
   */
  async updateProduct(req, res) {
    try {
      const { id } = req.params;
      const { price, min_stock_level, product_name, unit } = req.body;

      const updated = await sql`
        UPDATE inventory SET
          price = COALESCE(${price}, price),
          min_stock_level = COALESCE(${min_stock_level}, min_stock_level),
          product_name = COALESCE(${product_name}, product_name),
          unit = COALESCE(${unit}, unit),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
        RETURNING *
      `;

      if (updated.length === 0) return res.status(404).json({ error: 'Product not found' });

      res.json({
        success: true,
        message: 'Product updated successfully',
        data: inventorySchema.sanitize(updated[0])
      });
    } catch (error) {
      console.error('Update product error:', error);
      res.status(500).json({ error: 'Failed to update product' });
    }
  }

  /**
   * Update an existing movement
   */
  async updateMovement(req, res) {
    try {
      const { id } = req.params;
      const { product_name, movement_type, quantity, unit, reference_id, source_destination, price } = req.body;
      
      inventorySchema.validate.movement({ product_name, movement_type, quantity });

      // 1. Get old movement to reverse its effect
      const oldMovement = await sql`SELECT * FROM stock_movements WHERE id = ${id}`;
      if (oldMovement.length === 0) return res.status(404).json({ error: 'Movement not found' });
      
      const old = oldMovement[0];

      // 2. Reverse old effect
      await this._adjustStock(old.product_name, old.movement_type, -old.quantity);

      // 3. Apply new effect
      await this._adjustStock(product_name, movement_type, Number(quantity));

      // 4. Update the record
      const updated = await sql`
        UPDATE stock_movements SET
          product_name = ${product_name},
          movement_type = ${movement_type},
          quantity = ${quantity},
          unit = ${unit},
          reference_id = ${reference_id},
          source_destination = ${source_destination},
          price = ${price || 0},
          movement_date = CURRENT_TIMESTAMP
        WHERE id = ${id}
        RETURNING *
      `;

      res.json({
        success: true,
        message: 'Stock movement updated successfully',
        data: inventorySchema.sanitize(updated[0])
      });
    } catch (error) {
      console.error('Update stock movement error:', error);
      res.status(500).json({ error: error.message || 'Failed to update movement' });
    }
  }

  /**
   * Delete a movement
   */
  async deleteMovement(req, res) {
    try {
      const { id } = req.params;

      // 1. Get old movement to reverse its effect
      const oldMovement = await sql`SELECT * FROM stock_movements WHERE id = ${id}`;
      if (oldMovement.length === 0) return res.status(404).json({ error: 'Movement not found' });
      
      const old = oldMovement[0];

      // 2. Reverse effect
      await this._adjustStock(old.product_name, old.movement_type, -old.quantity);

      // 3. Delete the record
      await sql`DELETE FROM stock_movements WHERE id = ${id}`;

      res.json({
        success: true,
        message: 'Stock movement deleted successfully'
      });
    } catch (error) {
      console.error('Delete stock movement error:', error);
      res.status(500).json({ error: error.message || 'Failed to delete movement' });
    }
  }

  /**
   * Helper to adjust stock levels
   * @private
   */
  async _adjustStock(productName, type, quantity) {
    const existing = await sql`SELECT * FROM inventory WHERE product_name = ${productName}`;
    if (existing.length === 0) return; // Should ideally exist if we have movements for it

    if (type === 'in') {
      await sql`UPDATE inventory SET in_hand_quantity = in_hand_quantity + ${quantity}, updated_at = CURRENT_TIMESTAMP WHERE product_name = ${productName}`;
    } else if (type === 'out') {
      await sql`
        UPDATE inventory SET 
          price = CASE WHEN in_hand_quantity > 0 THEN price + (${quantity} * (price / in_hand_quantity)) ELSE price END,
          in_hand_quantity = in_hand_quantity + ${quantity}, 
          updated_at = CURRENT_TIMESTAMP 
        WHERE product_name = ${productName}
      `;
    } else if (type === 'market') {
      await sql`UPDATE inventory SET in_market_quantity = in_market_quantity + ${quantity}, updated_at = CURRENT_TIMESTAMP WHERE product_name = ${productName}`;
    }
  }
}

module.exports = new InventoryController();
