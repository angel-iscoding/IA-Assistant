-- Crear tabla de usuarios de Telegram
CREATE TABLE IF NOT EXISTS telegram_users (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT NOT NULL UNIQUE,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_interaction TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Crear tabla de mensajes
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    telegram_user_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    is_bot BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (telegram_user_id) REFERENCES telegram_users(id)
);

-- Crear índice para búsquedas por telegram_id en usuarios
CREATE INDEX IF NOT EXISTS idx_telegram_users_telegram_id ON telegram_users(telegram_id);

-- Crear índice para búsquedas por telegram_user_id en mensajes
CREATE INDEX IF NOT EXISTS idx_messages_telegram_user_id ON messages(telegram_user_id);

-- Crear índice para ordenar por fecha en mensajes
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at); 