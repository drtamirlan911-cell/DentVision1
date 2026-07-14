// postgres.js — УДАЛЁН из соображений безопасности
// Строка подключения к БД НИКОГДА не должна находиться в клиентском коде.
// Используйте API_URL для запросов к бэкенду.

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";
