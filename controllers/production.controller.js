/**
 * Production Controller
 */

const { sql } = require('../db');
const productionSchema = require('../models/production.schema');

class ProductionController {
  /**
   * Get all production logs
   */
  async getAll(req, res) {
    try {
      const records = await sql`
        SELECT p.*, r.material as raw_material_name 
        FROM production p
        LEFT JOIN raw_materials r ON p.raw_material_id = r.id
        ORDER BY p.production_date DESC
      `;
      res.json({
        success: true,
        data: records.map(r => productionSchema.sanitize(r))
      });
    } catch (error) {
      console.error('Get all production logs error:', error);
      res.status(500).json({ error: 'Failed to retrieve production logs' });
    }
  }

  /**
   * Get statistics
   */
  async getStats(req, res) {
    try {
      // 1. Total Production logs
      const totalRes = await sql`SELECT COUNT(*) as total FROM production`;
      const totalProduction = Number(totalRes[0].total || 0);

      // 2. Average Efficiency
      const avgEffRes = await sql`SELECT AVG(efficiency) as avg FROM production`;
      const avgEfficiency = Math.round(Number(avgEffRes[0].avg || 0));

      // 3. This month production count
      const monthlyRes = await sql`
        SELECT COUNT(*) as count 
        FROM production 
        WHERE production_date >= date_trunc('month', now())
      `;
      const monthlyProductionNumber = Number(monthlyRes[0].count || 0);

      // 4. Total Production Cost
      const costRes = await sql`SELECT SUM(total_cost) as total FROM production`;
      const productionCost = Number(costRes[0].total || 0);

      res.json({
        success: true,
        data: {
          totalProduction,
          avgEfficiency,
          monthlyProductionNumber,
          productionCost
        }
      });
    } catch (error) {
      console.error('Get production stats error:', error);
      res.status(500).json({ error: 'Failed to retrieve statistics' });
    }
  }

  /**
   * Create new entry
   */
  async create(req, res) {
    try {
      const { 
        production_name, production_date, raw_material_id, 
        raw_material_quantity, production_output, efficiency,
        labour_cost, other_cost, notes 
      } = req.body;

      // Validate
      productionSchema.validate.production_name(production_name);
      productionSchema.validate.production_date(production_date);
      productionSchema.validate.raw_material_id(raw_material_id);
      
      const total_cost = Number(labour_cost || 0) + Number(other_cost || 0);
      productionSchema.validate.costs(labour_cost, other_cost, total_cost);

      const result = await sql`
        INSERT INTO production (
          production_name, production_date, raw_material_id, 
          raw_material_quantity, production_output, efficiency,
          labour_cost, other_cost, total_cost, notes
        )
        VALUES (
          ${production_name}, ${production_date}, ${raw_material_id}, 
          ${raw_material_quantity}, ${production_output}, ${efficiency},
          ${labour_cost}, ${other_cost}, ${total_cost}, ${notes || null}
        )
        RETURNING *
      `;

      res.status(201).json({
        success: true,
        message: 'Production logged successfully',
        data: productionSchema.sanitize(result[0])
      });
    } catch (error) {
      console.error('Create production log error:', error);
      if (error.message.includes('required') || error.message.includes('negative')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to record production' });
    }
  }

  /**
   * Update entry
   */
  async update(req, res) {
    try {
      const { id } = req.params;
      const { 
        production_name, production_date, raw_material_id, 
        raw_material_quantity, production_output, efficiency,
        labour_cost, other_cost, notes 
      } = req.body;

      const existing = await sql`SELECT * FROM production WHERE id = ${id}`;
      if (existing.length === 0) {
        return res.status(404).json({ error: 'Log not found' });
      }

      const current = existing[0];
      const newLabour = labour_cost !== undefined ? Number(labour_cost) : Number(current.labour_cost);
      const newOther = other_cost !== undefined ? Number(other_cost) : Number(current.other_cost);
      const newTotal = newLabour + newOther;

      const result = await sql`
        UPDATE production
        SET 
          production_name = COALESCE(${production_name}, production_name),
          production_date = COALESCE(${production_date}, production_date),
          raw_material_id = COALESCE(${raw_material_id}, raw_material_id),
          raw_material_quantity = COALESCE(${raw_material_quantity}, raw_material_quantity),
          production_output = COALESCE(${production_output}, production_output),
          efficiency = COALESCE(${efficiency}, efficiency),
          labour_cost = ${newLabour},
          other_cost = ${newOther},
          total_cost = ${newTotal},
          notes = COALESCE(${notes}, notes),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
        RETURNING *
      `;

      res.json({
        success: true,
        message: 'Production log updated successfully',
        data: productionSchema.sanitize(result[0])
      });
    } catch (error) {
      console.error('Update production log error:', error);
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
        DELETE FROM production WHERE id = ${id} RETURNING id
      `;

      if (result.length === 0) {
        return res.status(404).json({ error: 'Log not found' });
      }

      res.json({
        success: true,
        message: 'Log deleted successfully'
      });
    } catch (error) {
      console.error('Delete production log error:', error);
      res.status(500).json({ error: 'Failed to delete record' });
    }
  }
}

module.exports = new ProductionController();
