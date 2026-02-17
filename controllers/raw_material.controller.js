/**
 * Raw Material Controller
 */

const { sql } = require('../db');
const rawMaterialSchema = require('../models/raw_material.schema');

class RawMaterialController {
  /**
   * Get all raw material purchases
   */
  async getAll(req, res) {
    try {
      const records = await sql`
        SELECT r.*, s.name as supplier_name 
        FROM raw_materials r
        LEFT JOIN suppliers s ON r.supplier_id = s.id
        ORDER BY r.created_at DESC
      `;
      res.json({
        success: true,
        data: records.map(r => rawMaterialSchema.sanitize(r))
      });
    } catch (error) {
      console.error('Get all raw materials error:', error);
      res.status(500).json({ error: 'Failed to retrieve raw materials' });
    }
  }

  /**
   * Get statistics
   */
  async getStats(req, res) {
    try {
      // 1. Total Spending
      const totalSpendingRes = await sql`SELECT SUM(total_price) as total FROM raw_materials`;
      const totalSpending = Number(totalSpendingRes[0].total || 0);

      // 2. Spending this month
      const monthlySpendingRes = await sql`
        SELECT SUM(total_price) as total 
        FROM raw_materials 
        WHERE created_at >= date_trunc('month', now())
      `;
      const monthlySpending = Number(monthlySpendingRes[0].total || 0);

      // 3. Total Suppliers
      const totalSuppliersRes = await sql`SELECT COUNT(DISTINCT supplier_id) as total FROM raw_materials`;
      const totalSuppliers = Number(totalSuppliersRes[0].total || 0);

      // 4. Stock Value (Assuming current records represent stock)
      const stockValue = totalSpending; // In a real app, this would deduct consumption

      // 5. Array of all stocks (grouped by material)
      const stocks = await sql`
        SELECT material, SUM(quantity) as total_quantity, SUM(total_price) as total_value, unit
        FROM raw_materials
        GROUP BY material, unit
      `;

      // 6. Top Suppliers
      const topSuppliers = await sql`
        SELECT s.name, SUM(r.total_price) as total_spent, COUNT(r.id) as total_transactions
        FROM suppliers s
        JOIN raw_materials r ON s.id = r.supplier_id
        GROUP BY s.id, s.name
        ORDER BY total_spent DESC
        LIMIT 5
      `;

      res.json({
        success: true,
        data: {
          summary: {
            totalSpending,
            monthlySpending,
            totalSuppliers,
            stockValue,
          },
          stocks: stocks.map(s => ({
            material: s.material,
            totalQuantity: Number(s.total_quantity),
            totalValue: Number(s.total_value),
            unit: s.unit
          })),
          topSuppliers: topSuppliers.map(s => ({
            name: s.name,
            totalSpent: Number(s.total_spent),
            transactions: Number(s.total_transactions)
          }))
        }
      });
    } catch (error) {
      console.error('Get raw material stats error:', error);
      res.status(500).json({ error: 'Failed to retrieve statistics' });
    }
  }

  /**
   * Create new entry
   */
  async create(req, res) {
    try {
      const { supplier_id, material, quantity, unit, price, paid_amount } = req.body;

      // Validate
      rawMaterialSchema.validate.supplier_id(supplier_id);
      rawMaterialSchema.validate.material(material);
      rawMaterialSchema.validate.quantity(quantity);
      rawMaterialSchema.validate.price(price);

      const totalPrice = Number(quantity) * Number(price);
      const paid = Number(paid_amount || 0);
      const remaining = totalPrice - paid;

      const result = await sql`
        INSERT INTO raw_materials (
          supplier_id, material, quantity, unit, price, 
          total_price, paid_amount, remaining_amount
        )
        VALUES (
          ${supplier_id}, ${material}, ${quantity}, ${unit}, ${price}, 
          ${totalPrice}, ${paid}, ${remaining}
        )
        RETURNING *
      `;

      res.status(201).json({
        success: true,
        message: 'Raw material recorded successfully',
        data: rawMaterialSchema.sanitize(result[0])
      });
    } catch (error) {
      console.error('Create raw material error:', error);
      if (error.message.includes('required') || error.message.includes('Valid')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to record raw material' });
    }
  }

  /**
   * Update entry
   */
  async update(req, res) {
    try {
      const { id } = req.params;
      const { supplier_id, material, quantity, unit, price, paid_amount } = req.body;

      // Fetch existing record to calculate totals if needed
      const existing = await sql`SELECT * FROM raw_materials WHERE id = ${id}`;
      if (existing.length === 0) {
        return res.status(404).json({ error: 'Record not found' });
      }

      const current = existing[0];
      const newQty = quantity !== undefined ? Number(quantity) : Number(current.quantity);
      const newPrice = price !== undefined ? Number(price) : Number(current.price);
      const newPaid = paid_amount !== undefined ? Number(paid_amount) : Number(current.paid_amount);
      
      const newTotal = newQty * newPrice;
      const newRemaining = newTotal - newPaid;

      const result = await sql`
        UPDATE raw_materials
        SET 
          supplier_id = COALESCE(${supplier_id}, supplier_id),
          material = COALESCE(${material}, material),
          quantity = ${newQty},
          unit = COALESCE(${unit}, unit),
          price = ${newPrice},
          total_price = ${newTotal},
          paid_amount = ${newPaid},
          remaining_amount = ${newRemaining},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
        RETURNING *
      `;

      res.json({
        success: true,
        message: 'Record updated successfully',
        data: rawMaterialSchema.sanitize(result[0])
      });
    } catch (error) {
      console.error('Update raw material error:', error);
      res.status(500).json({ error: 'Failed to update record' });
    }
  }

  /**
   * Delete entry
   */
  async delete(req, res) {
    try {
      const { id } = req.params;
      const result = await sql`
        DELETE FROM raw_materials WHERE id = ${id} RETURNING id
      `;

      if (result.length === 0) {
        return res.status(404).json({ error: 'Record not found' });
      }

      res.json({
        success: true,
        message: 'Record deleted successfully'
      });
    } catch (error) {
      console.error('Delete raw material error:', error);
      res.status(500).json({ error: 'Failed to delete record' });
    }
  }
}

module.exports = new RawMaterialController();
