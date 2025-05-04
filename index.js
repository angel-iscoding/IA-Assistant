require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { handleTelegramWebhook } = require('./chatbot');
const databaseRoutes = require('./database');
const { products, categories, seedDatabase } = require('./seeder');

const PORT = process.env.PORT || 3010;
const app = express();

// Configurar CORS para aceptar todas las conexiones
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Configurar body-parser con límites más altos
app.use(bodyParser.json({
  limit: '50mb',
  verify: (req, res, buf) => {
    try {
      console.log('📦 Raw body:', buf.toString());
    } catch (error) {
      console.error('❌ Error al parsear body:', error);
    }
  }
}));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Middleware para logging de todas las peticiones
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.url}`);
  console.log('🔍 Headers:', req.headers);
  next();
});

// Rutas del chatbot
app.post('/webhook/telegram', handleTelegramWebhook);

// Rutas de la base de datos
app.use('/api', databaseRoutes);

// Seeder endpoint
app.get('/api/seeder', async (req, res) => {
  try {
    const result = await seedDatabase();
    res.json(result);
  } catch (error) {
    console.error('Error seeding database:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error seeding database',
      error: error.message 
    });
  }
});

// Ruta de prueba
app.get('/', (req, res) => {
  res.send('Servidor funcionando correctamente');
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('❌ Error global:', err);
  res.status(500).send('Error interno del servidor');
});

// Iniciar servidor
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
  console.log(`🌐 URL local: http://localhost:${PORT}`);
});

// Manejo de errores del servidor
server.on('error', (error) => {
  console.error('❌ Error del servidor:', error);
});