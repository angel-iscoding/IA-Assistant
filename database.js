const express = require('express');
const pool = require('./server/db');
const router = express.Router();

// Obtener todos los usuarios
router.get('/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users');
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).send(error.message);
  }
});

// Buscar usuario por correo y obtener su contraseña
router.get('/user/:email', async (req, res) => {
  const { email } = req.params;
  try {
    const result = await pool.query('SELECT id, password FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(404).send('Usuario no encontrado');
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).send(error.message);
  }
});

// Comparar contraseña ingresada con contraseña obtenida por el correo
router.post('/auth/signin', async (req, res) => {
  
  //Body
  const { email, password } = req.body;

  try {
    const result = await pool.query('SELECT password FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(404).send('Usuario no encontrado');
    }
    const storedPassword = result.rows[0].password;
    const isMatch = storedPassword === password; // Comparación directa para la demo
    res.json({ isMatch });
  } catch (error) {
    console.error(error);
    res.status(500).send(error.message);
  }
});

// Obtener tabla "store" relacionada al id del usuario
router.get('/store/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await pool.query('SELECT * FROM store WHERE user_id = $1', [userId]);
    if (result.rows.length === 0) {
      return res.status(404).send('Tienda no encontrada');
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).send(error.message);
  }
});

// Obtener todos los productos relacionados a store
router.get('/store/:storeId/products', async (req, res) => {
  const { storeId } = req.params;
  try {
    const result = await pool.query('SELECT * FROM products WHERE store_id = $1', [storeId]);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).send(error.message);
  }
});

// Obtener todos los pedidos relacionados al store
router.get('/store/:storeId/orders', async (req, res) => {
  const { storeId } = req.params;
  try {
    const result = await pool.query('SELECT * FROM orders WHERE store_id = $1', [storeId]);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).send(error.message);
  }
});

// Crear nuevo usuario
router.post('/auth/signup', async (req, res) => {
  const { email, password, confirmPassword, name } = req.body;

  // Verificar si las contraseñas coinciden
  if (password !== confirmPassword) {
    return res.status(400).send('Las contraseñas son incorrectas');
  }

  try {
    const result = await pool.query(
      'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING *',
      [email, password, name]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).send(error.message);
  }
});

// Editar información de usuario
router.put('/user/:userId', async (req, res) => {
  const { userId } = req.params;
  const { email, name } = req.body;
  try {
    const result = await pool.query(
      'UPDATE users SET email = $1, name = $2 WHERE id = $3 RETURNING *',
      [email, name, userId]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).send(error.message);
  }
});

// Editar información de store
router.put('/store/:storeId', async (req, res) => {
  const { storeId } = req.params;
  const { name, address } = req.body;
  try {
    const result = await pool.query(
      'UPDATE store SET name = $1, address = $2 WHERE id = $3 RETURNING *',
      [name, address, storeId]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).send(error.message);
  }
});

// Editar información de un producto del store
router.put('/store/:storeId/product/:productId', async (req, res) => {
  const { storeId, productId } = req.params;
  const { name, price, stock } = req.body;
  try {
    const result = await pool.query(
      'UPDATE products SET name = $1, price = $2, stock = $3 WHERE id = $4 AND store_id = $5 RETURNING *',
      [name, price, stock, productId, storeId]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).send(error.message);
  }
});

module.exports = router;