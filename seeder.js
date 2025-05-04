const pool = require('./server/db');

const products = [
  {
    name: "Advanced Data Analysis",
    category: "Analysis",
    price: "€299.99",
    stock: 15,
    status: "Active",
  },
  {
    name: "AI Virtual Assistant",
    category: "Assistants",
    price: "€149.99",
    stock: 28,
    status: "Active",
  },
  {
    name: "Content Generator",
    category: "Content",
    price: "€199.99",
    stock: 10,
    status: "Active",
  },
  {
    name: "Image Recognition",
    category: "Vision",
    price: "€249.99",
    stock: 5,
    status: "Low stock",
  },
  {
    name: "Business Chatbot",
    category: "Assistants",
    price: "€399.99",
    stock: 0,
    status: "Out of stock",
  },
  {
    name: "Predictive Analysis",
    category: "Analysis",
    price: "€349.99",
    stock: 12,
    status: "Active",
  },
];

const categories = [
  { name: "Analysis", quantity: 2, color: "bg-lunexa-blue" },
  { name: "Assistants", quantity: 2, color: "bg-lunexa-blue" },
  { name: "Content", quantity: 1, color: "bg-lunexa-blue" },
  { name: "Vision", quantity: 1, color: "bg-lunexa-blue" },
];

async function seedDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Insertar productos
    for (const product of products) {
      await client.query(
        'INSERT INTO products (name, category, price, stock, status) VALUES ($1, $2, $3, $4, $5)',
        [product.name, product.category, product.price, product.stock, product.status]
      );
    }

    // Insertar categorías
    for (const category of categories) {
      await client.query(
        'INSERT INTO categories (name, quantity, color) VALUES ($1, $2, $3)',
        [category.name, category.quantity, category.color]
      );
    }

    await client.query('COMMIT');
    return { success: true, message: 'Database seeded successfully' };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  products,
  categories,
  seedDatabase
}; 