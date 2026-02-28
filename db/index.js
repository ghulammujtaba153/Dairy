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
    const inventorySchema = require('../models/inventory.schema');
    const labourSchema = require('../models/labour.schema');
    
    // Create tables if they don't exist
    await sql.query(userSchema.getCreateTableSQL());
    await sql.query(suppliersSchema.getCreateTableSQL());
    await sql.query(clientsSchema.getCreateTableSQL());
    await sql.query(rawMaterialSchema.getCreateTableSQL());
    await sql.query(productionSchema.getCreateTableSQL());
    await sql.query(inventorySchema.getCreateTableSQL());
    await sql.query(inventorySchema.getMovementsTableSQL());
    await sql.query(labourSchema.getCreateTableSQL());
    await sql.query(labourSchema.getAttendanceTableSQL());
    await sql.query(labourSchema.getAdvancesTableSQL());
    
    console.log('✅ Database tables initialized');
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
  }
}

module.exports = { sql, testConnection, initDatabase };
