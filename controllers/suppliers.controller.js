/**
 * Suppliers Controller
 */

const { sql } = require('../db');
const suppliersSchema = require('../models/suppliers.schema');

class SuppliersController {
  /**
   * Get all suppliers
   */
  async getAllSuppliers(req, res) {
    try {
      const suppliers = await sql`
        SELECT * FROM suppliers ORDER BY created_at DESC
      `;
      res.json({
        success: true,
        data: suppliers.map(s => suppliersSchema.sanitize(s))
      });
    } catch (error) {
      console.error('Get all suppliers error:', error);
      res.status(500).json({ error: 'Failed to retrieve suppliers' });
    }
  }

  /**
   * Get supplier by ID
   */
  async getSupplierById(req, res) {
    try {
      const { id } = req.params;
      const suppliers = await sql`
        SELECT * FROM suppliers WHERE id = ${id}
      `;

      if (suppliers.length === 0) {
        return res.status(404).json({ error: 'Supplier not found' });
      }

      res.json({
        success: true,
        data: suppliersSchema.sanitize(suppliers[0])
      });
    } catch (error) {
      console.error('Get supplier error:', error);
      res.status(500).json({ error: 'Failed to retrieve supplier' });
    }
  }

  /**
   * Create new supplier
   */
  async createSupplier(req, res) {
    try {
      const { name, email, phone, address, notes } = req.body;

      // Validate
      suppliersSchema.validate.name(name);
      if (email) suppliersSchema.validate.email(email);
      if (phone) suppliersSchema.validate.phone(phone);

      const result = await sql`
        INSERT INTO suppliers (name, email, phone, address, notes)
        VALUES (${name}, ${email || null}, ${phone || null}, ${address || null}, ${notes || null})
        RETURNING *
      `;

      res.status(201).json({
        success: true,
        message: 'Supplier created successfully',
        data: suppliersSchema.sanitize(result[0])
      });
    } catch (error) {
      console.error('Create supplier error:', error);
      if (error.message.includes('required') || error.message.includes('format')) {
        return res.status(400).json({ error: error.message });
      }
      if (error.message.includes('unique constraint')) {
        return res.status(409).json({ error: 'Supplier with this email already exists' });
      }
      res.status(500).json({ error: 'Failed to create supplier' });
    }
  }

  /**
   * Update supplier
   */
  async updateSupplier(req, res) {
    try {
      const { id } = req.params;
      const { name, email, phone, address, notes } = req.body;

      // Validate
      if (name) suppliersSchema.validate.name(name);
      if (email) suppliersSchema.validate.email(email);
      if (phone) suppliersSchema.validate.phone(phone);

      const result = await sql`
        UPDATE suppliers
        SET 
          name = COALESCE(${name}, name),
          email = COALESCE(${email}, email),
          phone = COALESCE(${phone}, phone),
          address = COALESCE(${address}, address),
          notes = COALESCE(${notes}, notes),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
        RETURNING *
      `;

      if (result.length === 0) {
        return res.status(404).json({ error: 'Supplier not found' });
      }

      res.json({
        success: true,
        message: 'Supplier updated successfully',
        data: suppliersSchema.sanitize(result[0])
      });
    } catch (error) {
      console.error('Update supplier error:', error);
      if (error.message.includes('format') || error.message.includes('characters')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to update supplier' });
    }
  }

  /**
   * Delete supplier
   */
  async deleteSupplier(req, res) {
    try {
      const { id } = req.params;
      const result = await sql`
        DELETE FROM suppliers WHERE id = ${id} RETURNING id
      `;

      if (result.length === 0) {
        return res.status(404).json({ error: 'Supplier not found' });
      }

      res.json({
        success: true,
        message: 'Supplier deleted successfully'
      });
    } catch (error) {
      console.error('Delete supplier error:', error);
      res.status(500).json({ error: 'Failed to delete supplier' });
    }
  }
}

module.exports = new SuppliersController();
