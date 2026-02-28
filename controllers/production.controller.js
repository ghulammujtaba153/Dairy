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
      // 1. Total Production logs (Total count)
      const totalRes = await sql`SELECT COUNT(*) as total FROM production`;
      const totalProductionCount = Number(totalRes[0].total || 0);

      // 2. Today's Batches
      const todayRes = await sql`SELECT COUNT(*) as total FROM production WHERE production_date::date = CURRENT_DATE`;
      const todayBatches = Number(todayRes[0].total || 0);

      // 3. Average Efficiency
      const avgEffRes = await sql`SELECT AVG(efficiency) as avg FROM production`;
      const avgEfficiency = Math.round(Number(avgEffRes[0].avg || 0));

      // 4. This month production count
      const monthlyRes = await sql`
        SELECT COUNT(*) as count 
        FROM production 
        WHERE production_date >= date_trunc('month', now())
      `;
      const monthlyProductionNumber = Number(monthlyRes[0].count || 0);

      // 5. Total Production Cost
      const costRes = await sql`SELECT SUM(total_cost) as total FROM production`;
      const productionCost = Number(costRes[0].total || 0);

      // 6. Efficiency Trend (Last 7 days)
      const trendRes = await sql`
        SELECT 
          production_date::date as date,
          AVG(CASE WHEN production_name = 'Desi Ghee' THEN efficiency ELSE NULL END) as ghee,
          AVG(CASE WHEN production_name = 'Butter' THEN efficiency ELSE NULL END) as butter,
          AVG(CASE WHEN production_name = 'Khoya' THEN efficiency ELSE NULL END) as khoya
        FROM production 
        WHERE production_date >= now() - interval '7 days'
        GROUP BY production_date::date
        ORDER BY production_date::date ASC
      `;

      const efficiencyTrend = trendRes.map(t => ({
        date: new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        ghee: Math.round(Number(t.ghee || 0)),
        butter: Math.round(Number(t.butter || 0)),
        khoya: Math.round(Number(t.khoya || 0))
      }));

      res.json({
        success: true,
        data: {
          summary: {
            todayBatches,
            avgEfficiency,
            thisMonthBatches: monthlyProductionNumber,
            totalProductionCost: productionCost
          },
          efficiencyTrend: efficiencyTrend.length > 0 ? efficiencyTrend : [
            { date: 'Initial', ghee: 0, butter: 0, khoya: 0 }
          ]
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

      // 1. Create production entry
      const records = await sql`
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
      const prod = records[0];

      // 2. Update Inventory
      const inventoryRecords = await sql`
        SELECT * FROM inventory WHERE product_name = ${production_name}
      `;
      const inventory = inventoryRecords[0];

      const outputQty = Number(production_output);
      const unit = production_name.toLowerCase().includes('cream') ? 'liters' : 'kg';

      if (inventory) {
        await sql`
          UPDATE inventory 
          SET in_hand_quantity = in_hand_quantity + ${outputQty},
              price = price + ${total_cost},
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${inventory.id}
        `;
      } else {
        await sql`
          INSERT INTO inventory (product_name, in_hand_quantity, unit, price)
          VALUES (${production_name}, ${outputQty}, ${unit}, ${total_cost})
        `;
      }

      // 3. Record Stock Movement
      await sql`
        INSERT INTO stock_movements (product_name, movement_type, quantity, unit, reference_id, source_destination)
        VALUES (${production_name}, 'in', ${outputQty}, ${unit}, ${'BATCH-' + prod.id}, 'Production Line')
      `;

      res.status(201).json({
        success: true,
        message: 'Production logged and inventory updated',
        data: productionSchema.sanitize(prod)
      });
    } catch (error) {
      console.error('Create production log error:', error);
      if (error.message.includes('required') || error.message.includes('negative')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to record production: ' + error.message });
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
      if (existing.length === 0) return res.status(404).json({ error: 'Log not found' });

      const current = existing[0];
      const newLabour = labour_cost !== undefined ? Number(labour_cost) : Number(current.labour_cost);
      const newOther = other_cost !== undefined ? Number(other_cost) : Number(current.other_cost);
      const newTotal = newLabour + newOther;
      const newOutput = production_output !== undefined ? Number(production_output) : Number(current.production_output);
      const outputDiff = newOutput - Number(current.production_output);

      // 1. Update production log
      const updatedRecords = await sql`
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
      const updated = updatedRecords[0];

      // 2. Adjust Inventory if output or name changed
      if (outputDiff !== 0) {
        await sql`
          UPDATE inventory 
          SET in_hand_quantity = in_hand_quantity + ${outputDiff},
              updated_at = CURRENT_TIMESTAMP
          WHERE product_name = ${updated.production_name}
        `;

        // 3. Log movement for adjustment
        await sql`
          INSERT INTO stock_movements (product_name, movement_type, quantity, unit, reference_id, source_destination)
          VALUES (
            ${updated.production_name}, 
            ${outputDiff > 0 ? 'in' : 'out'}, 
            ${Math.abs(outputDiff)}, 
            ${updated.production_name.toLowerCase().includes('cream') ? 'liters' : 'kg'}, 
            ${'ADJ-' + updated.id}, 
            'Production Adjustment'
          )
        `;
      }

      res.json({
        success: true,
        message: 'Production log and inventory updated successfully',
        data: productionSchema.sanitize(updated)
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
      
      const existing = await sql`SELECT * FROM production WHERE id = ${id}`;
      if (existing.length === 0) return res.status(404).json({ error: 'Log not found' });
      
      const current = existing[0];

      // 1. Delete production record
      await sql`DELETE FROM production WHERE id = ${id}`;

      // 2. Reverse inventory
      await sql`
        UPDATE inventory 
        SET in_hand_quantity = in_hand_quantity - ${Number(current.production_output)},
            updated_at = CURRENT_TIMESTAMP
        WHERE product_name = ${current.production_name}
      `;

      // 3. Log reversing movement
      await sql`
        INSERT INTO stock_movements (product_name, movement_type, quantity, unit, reference_id, source_destination)
        VALUES (
          ${current.production_name}, 
          'out', 
          ${Number(current.production_output)}, 
          ${current.production_name.toLowerCase().includes('cream') ? 'liters' : 'kg'}, 
          ${'DEL-' + current.id}, 
          'Production Reversal'
        )
      `;

      res.json({
        success: true,
        message: 'Log deleted and inventory adjusted'
      });
    } catch (error) {
      console.error('Delete production log error:', error);
      res.status(500).json({ error: 'Failed to delete record' });
    }
  }
}

module.exports = new ProductionController();
