// ═══════════════════════════════════════════════════════════════════
// POSTGRESQL (NEON) CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

// Конфигурация подключения к Neon PostgreSQL
export const DB_CONFIG = {
  connectionString: "postgresql://neondb_owner:npg_mvDyi8ntzIV9@ep-gentle-shadow-atzafh1s-pooler.c-9.us-east-1.aws.neon.tech/dent?sslmode=require",
  ssl: {
    rejectUnauthorized: false
  }
};

// Для использования в браузере через API сервер
export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";
