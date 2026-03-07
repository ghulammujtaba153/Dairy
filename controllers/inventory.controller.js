/**
 * Inventory Controller (Derived from Production, Raw Materials, and Sales)
 */

const { sql } = require('../db');

class InventoryController {
  /**
   * Get all inventory stock (Derived on the fly)
   */
  async getStock(req, res) {
    try {
      // 1. Get real in-market amount for each to show in the 
      const marketRes = await sql`
        SELECT SUM(total) as market_total 
        FROM sales 
      `;
      // WHERE status IN ('unpaid', 'partial')

      const inMarketValue = Number(marketRes[0].market_total || 0);
      console.log(inMarketValue);

      // 2. This query calculates stock for both raw materials and production items
      const stock = await sql`
        WITH movements AS (
            -- Production Inflow
            SELECT production_name as name, production_output as qty, 0 as market_qty, total_cost as cost, 0 as market_cost FROM production
            UNION ALL
            -- Raw Materials Inflow
            SELECT material as name, quantity as qty, 0 as market_qty, total_price as cost, 0 as market_cost FROM raw_materials
            UNION ALL
            -- Sales Outflow (Hand-stock deduction)
            SELECT 
                COALESCE(p.production_name, r.material) as name, 
                -s.quantity as qty, 
                0 as market_qty,
                0 as cost,
                0 as market_cost
            FROM sales s
            LEFT JOIN production p ON s.production_id = p.id
            LEFT JOIN raw_materials r ON s.raw_material_id = r.id
            UNION ALL
            -- Sales move to 'In Market'
            SELECT 
                COALESCE(p.production_name, r.material) as name, 
                0 as qty, 
                s.quantity as market_qty,
                0 as cost,
                s.total as market_cost
            FROM sales s
            LEFT JOIN production p ON s.production_id = p.id
            LEFT JOIN raw_materials r ON s.raw_material_id = r.id
            UNION ALL
            -- Production Consumption (Raw Materials Out)
            SELECT r.material as name, -p.raw_material_quantity as qty, 0 as market_qty, 0 as cost, 0 as market_cost
            FROM production p
            JOIN raw_materials r ON p.raw_material_id = r.id
            UNION ALL
            -- Manual/Other Movements
            SELECT 
                product_name as name, 
                CASE 
                    WHEN movement_type = 'in' THEN quantity 
                    WHEN movement_type = 'out' THEN -quantity 
                    ELSE 0 
                END as qty,
                CASE WHEN movement_type = 'market' THEN quantity ELSE 0 END as market_qty,
                CASE WHEN movement_type IN ('in', 'out') THEN price ELSE 0 END as cost,
                CASE WHEN movement_type = 'market' THEN price ELSE 0 END as market_cost
            FROM stock_movements
            WHERE reference_id IS NULL OR (reference_id NOT LIKE 'BATCH-%' AND reference_id NOT LIKE 'SALE-%' AND reference_id NOT LIKE 'SALE-RM-%')
        )
        SELECT 
            m.name as product_name,
            SUM(m.qty) as in_hand_quantity,
            SUM(m.market_qty) as in_market_quantity,
            COALESCE((SELECT MAX(unit) FROM raw_materials WHERE material = m.name), 
                     (SELECT MAX(unit) FROM stock_movements WHERE product_name = m.name), 
                     'kg') as unit,
            SUM(m.cost) as price,
            SUM(m.market_cost) as value_in_market,
            0 as min_stock_level
        FROM movements m
        GROUP BY m.name
        HAVING SUM(m.qty) != 0 OR SUM(m.market_qty) != 0
        ORDER BY m.name ASC
      `;
      
      res.json({
        success: true,
        inMarketValue,
        data: stock.map(s => ({
            ...s,
            in_hand_quantity: Number(s.in_hand_quantity),
            in_market_quantity: Number(s.in_market_quantity),
            price: Number(s.price),
            total_price: Number(s.price),
            valueInMarket: Number(s.value_in_market),
            min_stock_level: Number(s.min_stock_level)
        }))
      });
    } catch (error) {
      console.error('Get inventory stock error:', error);
      res.status(500).json({ error: 'Failed to retrieve inventory' });
    }
  }

  /**
   * Get recent movements (Combined from all tables)
   */
  async getMovements(req, res) {
    try {
      const records = await sql`
        SELECT * FROM (
            SELECT id, created_at as movement_date, material as product_name, 'in' as movement_type, quantity, unit, 'PURCHASE-' || id as reference_id, 'Supplier' as source_destination, total_price as price FROM raw_materials
            UNION ALL
            SELECT id, production_date as movement_date, production_name as product_name, 'in' as movement_type, production_output as quantity, 'kg' as unit, 'BATCH-' || id as reference_id, 'Production' as source_destination, total_cost as price FROM production
            UNION ALL
            SELECT s.id, s.created_at as movement_date, COALESCE(p.production_name, r.material) as product_name, 'out' as movement_type, s.quantity, COALESCE(r.unit, 'kg') as unit, 'SALE-' || s.id as reference_id, 'Customer' as source_destination, s.total as price 
            FROM sales s
            LEFT JOIN production p ON s.production_id = p.id
            LEFT JOIN raw_materials r ON s.raw_material_id = r.id
            UNION ALL
            SELECT id, movement_date, product_name, movement_type, quantity, unit, reference_id, source_destination, price FROM stock_movements
            WHERE reference_id IS NULL OR (reference_id NOT LIKE 'BATCH-%' AND reference_id NOT LIKE 'SALE-%' AND reference_id NOT LIKE 'SALE-RM-%' AND reference_id NOT LIKE 'PURCHASE-%')
        ) as combined_movements
        ORDER BY movement_date DESC 
        LIMIT 50
      `;
      res.json({
        success: true,
        data: records.map(r => ({
            ...r,
            quantity: Number(r.quantity),
            price: Number(r.price)
        }))
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
      // Fetch derived stock first
      const stockRes = await this.getStockData();
      
      const totalValue = stockRes.reduce((sum, item) => sum + Number(item.price || 0), 0);
      
      // Use sales schema to get real in-market amount (unpaid/partial sales)
      const marketRes = await sql`
        SELECT SUM(total) as market_total 
        FROM sales 
      `;

      // WHERE status IN ('unpaid', 'partial')

      const inMarketValue = Number(marketRes[0].market_total || 0);

      const lowStockCount = 0; // Derived system needs a settings table for this

      // Calculate last 7 days movement trend (Values in PKR)
      const trendData = await sql`
        SELECT 
          date as date,
          SUM(inflow) as inflow,
          SUM(outflow) as outflow
        FROM (
            SELECT production_date::date as date, total_cost as inflow, 0 as outflow FROM production
            UNION ALL
            SELECT created_at::date as date, total_price as inflow, 0 as outflow FROM raw_materials
            UNION ALL
            SELECT created_at::date as date, 0 as inflow, total as outflow FROM sales
            UNION ALL
            SELECT movement_date::date as date, 
                   CASE WHEN movement_type = 'in' THEN price ELSE 0 END as inflow, 
                   CASE WHEN movement_type IN ('out', 'market') THEN price ELSE 0 END as outflow 
            FROM stock_movements
        ) as all_m
        WHERE date >= now() - interval '7 days'
        GROUP BY date
        ORDER BY date ASC
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
          inHandValue: totalValue - inMarketValue,
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

  // Internal helper to get stock data without res object
  async getStockData() {
      const stock = await sql`
        WITH movements AS (
            SELECT production_name as name, production_output as qty, 0 as market_qty, total_cost as cost, 0 as market_cost FROM production
            UNION ALL
            SELECT material as name, quantity as qty, 0 as market_qty, total_price as cost, 0 as market_cost FROM raw_materials
            UNION ALL
            SELECT COALESCE(p.production_name, r.material) as name, -s.quantity as qty, 0 as market_qty, 0 as cost, 0 as market_cost
            FROM sales s LEFT JOIN production p ON s.production_id = p.id LEFT JOIN raw_materials r ON s.raw_material_id = r.id
            UNION ALL
            SELECT COALESCE(p.production_name, r.material) as name, 0 as qty, s.quantity as market_qty, 0 as cost, s.total as market_cost
            FROM sales s LEFT JOIN production p ON s.production_id = p.id LEFT JOIN raw_materials r ON s.raw_material_id = r.id
            UNION ALL
            SELECT r.material as name, -p.raw_material_quantity as qty, 0 as market_qty, 0 as cost, 0 as market_cost FROM production p JOIN raw_materials r ON p.raw_material_id = r.id
            UNION ALL
            SELECT product_name as name, 
                   CASE WHEN movement_type = 'in' THEN quantity WHEN movement_type = 'out' THEN -quantity ELSE 0 END as qty, 
                   CASE WHEN movement_type = 'market' THEN quantity ELSE 0 END as market_qty, 
                   CASE WHEN movement_type IN ('in', 'out') THEN price ELSE 0 END as cost,
                   CASE WHEN movement_type = 'market' THEN price ELSE 0 END as market_cost
            FROM stock_movements WHERE reference_id IS NULL OR (reference_id NOT LIKE 'BATCH-%' AND reference_id NOT LIKE 'SALE-%' AND reference_id NOT LIKE 'SALE-RM-%')
        )
        SELECT name as product_name, SUM(qty) as in_hand_quantity, SUM(market_qty) as in_market_quantity, SUM(cost) as price, SUM(market_cost) as value_in_market FROM movements GROUP BY name
      `;
      return stock;
  }

  /**
   * Record a new manual movement
   */
  async recordMovement(req, res) {
    try {
      const { product_name, movement_type, quantity, unit, reference_id, source_destination, price } = req.body;
      
      // Record the movement only in stock_movements
      const movement = await sql`
        INSERT INTO stock_movements (
          product_name, movement_type, quantity, unit, reference_id, source_destination, price
        )
        VALUES (${product_name}, ${movement_type}, ${quantity}, ${unit}, ${reference_id}, ${source_destination}, ${price || 0})
        RETURNING *
      `;

      res.status(201).json({
        success: true,
        message: 'Stock movement recorded successfully',
        data: movement[0]
      });
    } catch (error) {
      console.error('Record stock movement error:', error);
      res.status(500).json({ error: error.message || 'Failed to record movement' });
    }
  }

  /**
   * Update an existing movement
   */
  async updateMovement(req, res) {
    try {
      const { id } = req.params;
      const { product_name, movement_type, quantity, unit, reference_id, source_destination, price } = req.body;
      
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

      if (updated.length === 0) return res.status(404).json({ error: 'Movement not found' });

      res.json({
        success: true,
        message: 'Stock movement updated successfully',
        data: updated[0]
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
      const deleted = await sql`DELETE FROM stock_movements WHERE id = ${id} RETURNING id`;
      if (deleted.length === 0) return res.status(404).json({ error: 'Movement not found' });

      res.json({
        success: true,
        message: 'Stock movement deleted successfully'
      });
    } catch (error) {
      console.error('Delete stock movement error:', error);
      res.status(500).json({ error: error.message || 'Failed to delete movement' });
    }
  }
}

module.exports = new InventoryController();
