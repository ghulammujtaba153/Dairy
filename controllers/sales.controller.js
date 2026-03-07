/**
 * Sales Controller
 */

const { sql } = require('../db');
const salesSchema = require('../models/sales.schema');

class SalesController {
  /**
   * Get all sales
   */
  async getAll(req, res) {
    try {
      const records = await sql`
        SELECT 
          s.*, 
          c.name as customer_name,
          p.production_name as product_name,
          r.material as raw_material_name
        FROM sales s
        LEFT JOIN clients c ON s.customer_id = c.id
        LEFT JOIN production p ON s.production_id = p.id
        LEFT JOIN raw_materials r ON s.raw_material_id = r.id
        ORDER BY s.created_at DESC
      `;
      res.json({
        success: true,
        data: records.map(r => salesSchema.sanitize(r))
      });
    } catch (error) {
      console.error('Get all sales error:', error);
      res.status(500).json({ error: 'Failed to retrieve sales' });
    }
  }

  /**
   * Create new sale
   */
  async create(req, res) {
    try {
      const { 
        customer_id, production_id, raw_material_id, 
        quantity, price, payment_status, status 
      } = req.body;

      // Validate
      salesSchema.validate.customer_id(customer_id);
      salesSchema.validate.item(production_id, raw_material_id);
      salesSchema.validate.quantity(quantity);
      salesSchema.validate.price(price);

      const total = Number(quantity) * Number(price);

      // 1. Create sale record
      const result = await sql`
        INSERT INTO sales (
          customer_id, production_id, raw_material_id, 
          quantity, price, total, payment_status, status
        )
        VALUES (
          ${customer_id}, ${production_id || null}, ${raw_material_id || null}, 
          ${quantity}, ${price}, ${total}, ${payment_status || 'cash'},
          ${status || 'paid'}
        )
        RETURNING *
      `;
      const sale = result[0];

      res.status(201).json({
        success: true,
        message: 'Sale recorded successfully',
        data: salesSchema.sanitize(sale)
      });
    } catch (error) {
      console.error('Create sale error:', error);
      res.status(500).json({ error: 'Failed to record sale: ' + error.message });
    }
  }

  /**
   * Update sale
   */
  async update(req, res) {
    try {
      const { id } = req.params;
      const { 
        customer_id, production_id, raw_material_id, 
        quantity, price, payment_status, status 
      } = req.body;

      const total = Number(quantity) * Number(price);

      const result = await sql`
        UPDATE sales SET
          customer_id = ${customer_id},
          production_id = ${production_id || null},
          raw_material_id = ${raw_material_id || null},
          quantity = ${quantity},
          price = ${price},
          total = ${total},
          payment_status = ${payment_status || 'cash'},
          status = ${status || 'paid'},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
        RETURNING *
      `;

      if (result.length === 0) {
        return res.status(404).json({ error: 'Sale record not found' });
      }

      res.json({
        success: true,
        message: 'Sale updated successfully',
        data: salesSchema.sanitize(result[0])
      });
    } catch (error) {
      console.error('Update sale error:', error);
      res.status(500).json({ error: 'Failed to update sale' });
    }
  }

  /**
   * Delete sale
   */
  async delete(req, res) {
    try {
      const { id } = req.params;
      const result = await sql`DELETE FROM sales WHERE id = ${id} RETURNING id`;
      
      if (result.length === 0) {
        return res.status(404).json({ error: 'Sale record not found' });
      }

      res.json({
        success: true,
        message: 'Sale deleted successfully'
      });
    } catch (error) {
      console.error('Delete sale error:', error);
      res.status(500).json({ error: 'Failed to delete sale' });
    }
  }

  /**
   * Get stats
   */
  async getStats(req, res) {
    try {
      const stats = await sql`
        SELECT 
          COUNT(*) as total_sales,
          SUM(total) as total_revenue,
          SUM(CASE WHEN payment_status = 'cash' THEN total ELSE 0 END) as cash_sales,
          SUM(CASE WHEN payment_status != 'cash' THEN total ELSE 0 END) as other_sales
        FROM sales
      `;
      
      const recentSales = await sql`
        SELECT s.*, c.name as customer_name
        FROM sales s
        JOIN clients c ON s.customer_id = c.id
        ORDER BY s.created_at DESC
        LIMIT 5
      `;

      res.json({
        success: true,
        data: {
          summary: {
            totalSales: Number(stats[0].total_sales || 0),
            totalRevenue: Number(stats[0].total_revenue || 0),
            cashSales: Number(stats[0].cash_sales || 0),
            otherSales: Number(stats[0].other_sales || 0)
          },
          recentSales: recentSales.map(s => salesSchema.sanitize(s))
        }
      });
    } catch (error) {
      console.error('Get sales stats error:', error);
      res.status(500).json({ error: 'Failed to retrieve stats' });
    }
  }
}

module.exports = new SalesController();
