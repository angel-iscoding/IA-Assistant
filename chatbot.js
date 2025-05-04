const axios = require('axios');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const pool = require('./server/db');
const { products, categories } = require('./seeder');

// Inicializar Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Estado del pedido actual
let currentOrder = {
  products: [],
  customerName: '',
  deliveryAddress: '',
  paymentMethod: '',
  deliveryDate: ''
};

// Función para obtener o crear un usuario de Telegram
async function getOrCreateTelegramUser(telegramId, userData) {
  try {
    // Intentar obtener el usuario existente
    const existingUser = await pool.query(
      `SELECT telegram_id FROM telegram_user WHERE telegram_id = $1`,
      [telegramId]
    );

    if (existingUser.rows.length > 0) {
      // Actualizar la última interacción
      await pool.query(
        `UPDATE telegram_user 
         SET last_interaction = NOW(),
             username = COALESCE($2, username),
             first_name = COALESCE($3, first_name),
             last_name = COALESCE($4, last_name)
         WHERE telegram_id = $1`,
        [telegramId, userData.username, userData.first_name, userData.last_name]
      );
      return existingUser.rows[0].telegram_id; // Devolver telegram_id
    }

    // Crear nuevo usuario
    const newUser = await pool.query(
      `INSERT INTO telegram_user 
       (telegram_id, username, first_name, last_name) 
       VALUES ($1, $2, $3, $4) 
       RETURNING telegram_id`, // Cambiar RETURNING id a RETURNING telegram_id
      [telegramId, userData.username, userData.first_name, userData.last_name]
    );

    return newUser.rows[0].telegram_id; // Devolver telegram_id
  } catch (error) {
    console.error('Error obteniendo/creando usuario de Telegram:', error);
    throw error;
  }
}

// Función para guardar un mensaje
async function saveMessage(telegramId, message, isBot = false) {
  try {
    await pool.query(
      `INSERT INTO messages (telegram_id, message, is_bot) 
       VALUES ($1, $2, $3)`,
      [telegramId, message, isBot]
    );
  } catch (error) {
    console.error('Error guardando mensaje:', error);
  }
}

// Función para obtener el historial de mensajes
async function getMessageHistory(telegramId) {
  try {
    const result = await pool.query(
      `SELECT * FROM messages 
       WHERE telegram_id = $1 
       ORDER BY create_at DESC 
       LIMIT 20`,
      [telegramId]
    );
    return result.rows.reverse(); // Ordenar del más antiguo al más reciente
  } catch (error) {
    console.error('Error obteniendo historial de mensajes:', error);
    return [];
  }
}

// Función para obtener productos de la base de datos
async function getProducts() {
  try {
    const result = await pool.query('SELECT * FROM products');
    return result.rows;
  } catch (error) {
    console.error('Error obteniendo productos:', error);
    return products;
  }
}

// Función para obtener categorías de la base de datos
async function getCategories() {
  try {
    const result = await pool.query('SELECT * FROM categories');
    return result.rows;
  } catch (error) {
    console.error('Error obteniendo categorías:', error);
    return categories;
  }
}

// Función para registrar un pedido en la base de datos
async function registerOrder(order) {
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Insertar el pedido
      const orderResult = await client.query(
        `INSERT INTO orders (customer_name, delivery_address, payment_method, delivery_date, status) 
         VALUES ($1, $2, $3, $4, 'pending') 
         RETURNING id`,
        [order.customerName, order.deliveryAddress, order.paymentMethod, order.deliveryDate]
      );
      
      const orderId = orderResult.rows[0].id;

      // Insertar los productos del pedido
      for (const product of order.products) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, quantity) 
           VALUES ($1, $2, $3)`,
          [orderId, product.id, product.quantity]
        );

        // Actualizar el stock
        await client.query(
          `UPDATE products SET stock = stock - $1 WHERE id = $2`,
          [product.quantity, product.id]
        );
      }

      await client.query('COMMIT');
      return { success: true, orderId };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error registrando pedido:', error);
    throw error;
  }
}

// Prompt del personaje
const CHARACTER_PROMPT = `
Actúa como un asistente virtual para pequeños emprendedores que venden por Instagram, WhatsApp o en tiendas locales. 

Cuando un cliente quiera hacer un pedido:
1. Pídele su nombre
2. Pídele la dirección de entrega
3. Pídele el método de pago
4. Pídele la fecha deseada de entrega
5. Pídele los productos que desea y sus cantidades

Una vez que tengas toda la información, muestra un resumen del pedido y pregunta si desea confirmarlo.
Si el cliente dice "confirmar", registra el pedido y actualiza el inventario.
Si el cliente dice "cancelar", cancela el pedido y reinicia el proceso.

Productos disponibles:
{PRODUCTS}

Categorías disponibles:
{CATEGORIES}

Estado actual del pedido:
{ORDER_STATUS}

Historial de la conversación:
{HISTORY}

Ahora, responde al siguiente mensaje del usuario como el asistente virtual descrito anteriormente, sin incluir ningún prefijo o etiqueta en tu respuesta:
`;

// Función para generar respuesta con Gemini
async function generateResponse(prompt, telegramId, userData) {
  let telegramUserId; // Definir la variable aquí
  try {
    console.log('🤖 Iniciando generación de respuesta con Gemini...');
    
    // Obtener o crear el usuario
    telegramUserId = await getOrCreateTelegramUser(telegramId, userData);
    
    // Obtener datos actualizados
    const productsList = await getProducts();
    const categoriesList = await getCategories();
    const messageHistory = await getMessageHistory(telegramUserId);
    
    // Formatear productos y categorías para el prompt
    const productsText = productsList.map(p => 
      `- ${p.name} (${p.category}): $${p.price} - Stock: ${p.stock}`
    ).join('\n');
    
    const categoriesText = categoriesList.map(c => 
      `- ${c.name} (${c.quantity} productos)`
    ).join('\n');

    // Formatear estado del pedido actual
    const orderStatus = currentOrder.products.length > 0 
      ? `Pedido en proceso:
         Cliente: ${currentOrder.customerName || 'No especificado'}
         Dirección: ${currentOrder.deliveryAddress || 'No especificada'}
         Método de pago: ${currentOrder.paymentMethod || 'No especificado'}
         Fecha de entrega: ${currentOrder.deliveryDate || 'No especificada'}
         Productos: ${currentOrder.products.map(p => `${p.name} (${p.quantity})`).join(', ')}`
      : 'No hay pedido en proceso';

    // Formatear historial de mensajes
    const historyText = messageHistory.map(msg => 
      `${msg.is_bot ? 'Asistente' : 'Usuario'}: ${msg.message}`
    ).join('\n');
    
    // Actualizar el prompt con los datos actuales
    const updatedPrompt = CHARACTER_PROMPT
      .replace('{PRODUCTS}', productsText)
      .replace('{CATEGORIES}', categoriesText)
      .replace('{ORDER_STATUS}', orderStatus)
      .replace('{HISTORY}', historyText);
    
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro-exp-03-25" });
    
    // Combinar el prompt del personaje con el mensaje del usuario
    const fullPrompt = `${updatedPrompt}\n\nUsuario: ${prompt}`;
    
    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const text = response.text();
    console.log('✅ Respuesta generada:', text);

    // Guardar mensajes en la base de datos
    await saveMessage(telegramUserId, prompt, false);
    await saveMessage(telegramUserId, text, true);

    // Si el usuario confirma el pedido
    if (prompt.toLowerCase().includes('confirmar') && currentOrder.products.length > 0) {
      try {
        const orderResult = await registerOrder(currentOrder);
        console.log('✅ Pedido registrado:', orderResult);
        // Reiniciar el pedido actual
        currentOrder = {
          products: [],
          customerName: '',
          deliveryAddress: '',
          paymentMethod: '',
          deliveryDate: ''
        };
        const confirmationMessage = `${text}\n\n¡Pedido registrado exitosamente! Número de pedido: ${orderResult.orderId}`;
        await saveMessage(telegramUserId, confirmationMessage, true);
        return confirmationMessage;
      } catch (error) {
        console.error('❌ Error registrando pedido:', error);
        const errorMessage = `${text}\n\nLo siento, hubo un error al registrar tu pedido. Por favor, intenta de nuevo.`;
        await saveMessage(telegramUserId, errorMessage, true);
        return errorMessage;
      }
    }

    return text;
  } catch (error) {
    console.error('❌ Error generando respuesta con Gemini:', error);
    const errorMessage = "Lo siento, hubo un error al procesar tu mensaje. Por favor, intenta de nuevo.";
    if (telegramUserId) {
      await saveMessage(telegramUserId, errorMessage, true);
    }
    return errorMessage;
  }
}

// Función para enviar mensajes a Telegram
async function sendTelegramMessage(chatId, text) {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  console.log('🔑 Token de Telegram:', TELEGRAM_BOT_TOKEN ? 'Presente' : 'Faltante');
  console.log('📤 Intentando enviar mensaje a Telegram...');
  console.log('💬 Chat ID:', chatId);
  console.log('📝 Mensaje:', text);

  try {
    const response = await axios.post(TELEGRAM_API_URL, {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML'
    });
    
    if (!response.data.ok) {
      throw new Error(`Telegram API error: ${response.data.description}`);
    }
    
    return response.data;
  } catch (error) {
    console.error('❌ Error al enviar mensaje a Telegram:', error.response?.data || error.message);
    throw error;
  }
}

// Endpoint para manejar el webhook de Telegram
async function handleTelegramWebhook(req, res) {
  console.log('🔔 Nuevo webhook recibido');
  console.log('📦 Body completo:', JSON.stringify(req.body, null, 2));
  console.log('🔍 Headers:', JSON.stringify(req.headers, null, 2));

  try {
    const { message } = req.body;
    
    if (!message) {
      console.log('⚠️ No hay mensaje en el body');
      return res.status(200).send('OK');
    }

    if (!message.text) {
      console.log('⚠️ El mensaje no tiene texto');
      return res.status(200).send('OK');
    }

    const chatId = message.chat.id;
    const userMessage = message.text;
    const userData = {
      username: message.from.username,
      first_name: message.from.first_name,
      last_name: message.from.last_name
    };

    console.log(`👤 Mensaje de ${userData.username || userData.first_name}: ${userMessage}`);
    console.log(`💬 Chat ID: ${chatId}`);

    // Generar respuesta usando Gemini
    const response = await generateResponse(userMessage, chatId, userData);
    
    // Enviar respuesta a Telegram
    console.log('📤 Enviando respuesta a Telegram...');
    await sendTelegramMessage(chatId, response);
    console.log('✅ Respuesta enviada correctamente');

    res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Error en el webhook:', error);
    res.status(500).send('Error processing webhook');
  }
}

module.exports = {
  handleTelegramWebhook
};