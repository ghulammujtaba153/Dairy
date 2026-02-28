const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./documentation/swagger.json');
const { testConnection, initDatabase } = require('./db');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
  swaggerOptions: {
    persistAuthorization: true
  }
}));

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Dairy Server API is running' });
});

// Health check endpoint
app.get('/health', async (req, res) => {
  const dbConnected = await testConnection();
  res.json({
    status: 'ok',
    database: dbConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// Import routes
const authRoutes = require('./routes/auth');
const suppliersRoutes = require('./routes/suppliers');
const clientsRoutes = require('./routes/clients');
const rawMaterialRoutes = require('./routes/raw_material');
const productionRoutes = require('./routes/production');
const inventoryRoutes = require('./routes/inventory');
const labourRoutes = require('./routes/labour');

app.use('/api/auth', authRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/raw-materials', rawMaterialRoutes);
app.use('/api/production', productionRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/labour', labourRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Server configuration
const PORT = process.env.PORT || 5000;

// Start server
async function startServer() {
  try {
    // Test database connection
    await testConnection();
    
    // Initialize database tables
    await initDatabase();
    
    // Start listening
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start server if run directly
if (require.main === module) {
  startServer();
}

module.exports = app;
