const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

// Create a Neon SQL connection
const sql = neon(process.env.NEON_CONNECT);

// Test database connection
async function testConnection() {
  try {
    const result = await sql.query('SELECT NOW()');
    console.log('✅ Database connected successfully:', result[0].now);
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}


// Initialize database tables
async function initDatabase() {
  try {
    const userSchema = require('../models/user.schema');
    const suppliersSchema = require('../models/suppliers.schema');
    const clientsSchema = require('../models/clients.schema');
    const rawMaterialSchema = require('../models/raw_material.schema');
    const productionSchema = require('../models/production.schema');
    const labourSchema = require('../models/labour.schema');
    const salesSchema = require('../models/sales.schema');
    const inventorySchema = require('../models/inventory.schema');
    
    // Create tables if they don't exist
    await sql.query(userSchema.getCreateTableSQL());
    await sql.query(suppliersSchema.getCreateTableSQL());
    await sql.query(clientsSchema.getCreateTableSQL());
    await sql.query(rawMaterialSchema.getCreateTableSQL());
    await sql.query(productionSchema.getCreateTableSQL());
    await sql.query(inventorySchema.getMovementsTableSQL());
    await sql.query(labourSchema.getCreateTableSQL());
    await sql.query(labourSchema.getAttendanceTableSQL());
    await sql.query(labourSchema.getAdvancesTableSQL());
    await sql.query(salesSchema.getCreateTableSQL());
    
    // Migration: Add status column and update payment_status to sales table if missing
    try {
      await sql.query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'paid' CHECK (status IN ('paid', 'unpaid', 'partial'))`);
      
      // Update payment_status check constraint to include 'credit'
      // We drop if exists and recreate it to be safe (or just try to add it)
      // For Neon/Postgres, we can drop the constraint and add it back
      try {
        await sql.query(`ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_payment_status_check`);
        await sql.query(`ALTER TABLE sales ADD CONSTRAINT sales_payment_status_check CHECK (payment_status IN ('cash', 'bank', 'jazzcash', 'easypaisa', 'credit'))`);
      } catch (err) {
        // If the constraint name is different or other error, just log it
        console.log('Payment status constraint update skipped/failed (might already be up to date)');
      }
    } catch (migError) {
      console.log('Migration for sales table skipped:', migError.message);
    }
    
    console.log('✅ Database tables initialized');
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
  }
}

module.exports = { sql, testConnection, initDatabase };
