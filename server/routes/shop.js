// ═══════════════════════════════════════════════════════════════
// Shop Routes — marketplace products, orders, reviews, favorites
// ═══════════════════════════════════════════════════════════════
import { Router } from 'express';
import crypto from 'crypto';
import { authenticate } from '../middleware/auth.js';
import { requireSameClinic } from '../middleware/rbac.js';

export default function shopRoutes(pool) {
  const router = Router();

  // ─── Categories (public read) ───
  router.get('/categories', async (_req, res) => {
    try {
      const result = await pool.query('SELECT * FROM shop_categories ORDER BY sort_order');
      res.json(result.rows);
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  // ─── Products (public read) ───
  router.get('/products', async (req, res) => {
    try {
      const { category, search, sort, min_price, max_price, brand } = req.query;
      let query = `SELECT p.*, c.name as category_name, s.name as supplier_name, s.country as supplier_country FROM shop_products p LEFT JOIN shop_categories c ON p.category_id = c.id LEFT JOIN shop_suppliers s ON p.supplier_id = s.id WHERE 1=1`;
      const params = []; let idx = 1;
      if (category) { query += ` AND p.category_id = $${idx++}`; params.push(category); }
      if (search) { query += ` AND (LOWER(p.name) LIKE $${idx} OR LOWER(p.brand) LIKE $${idx} OR LOWER(p.description) LIKE $${idx})`; params.push(`%${search.toLowerCase()}%`); idx++; }
      if (min_price) { query += ` AND p.price >= $${idx++}`; params.push(Number(min_price)); }
      if (max_price) { query += ` AND p.price <= $${idx++}`; params.push(Number(max_price)); }
      if (brand) { query += ` AND LOWER(p.brand) = $${idx++}`; params.push(brand.toLowerCase()); }
      if (sort === 'price_asc') query += ' ORDER BY p.price ASC';
      else if (sort === 'price_desc') query += ' ORDER BY p.price DESC';
      else if (sort === 'rating') query += ' ORDER BY p.rating DESC';
      else if (sort === 'newest') query += ' ORDER BY p.created_at DESC';
      else query += ' ORDER BY p.rating DESC, p.review_count DESC';
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  router.get('/products/:id', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT p.*, c.name as category_name, s.name as supplier_name, s.country as supplier_country, s.delivery_days, s.delivery_cost, s.free_delivery_from FROM shop_products p LEFT JOIN shop_categories c ON p.category_id = c.id LEFT JOIN shop_suppliers s ON p.supplier_id = s.id WHERE p.id = $1`, [req.params.id]);
      if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
      const reviews = await pool.query('SELECT * FROM shop_reviews WHERE product_id = $1 ORDER BY created_at DESC', [req.params.id]);
      const related = await pool.query('SELECT * FROM shop_products WHERE category_id = $1 AND id != $2 LIMIT 6', [result.rows[0].category_id, req.params.id]);
      res.json({ ...result.rows[0], reviews: reviews.rows, related: related.rows });
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  router.get('/suppliers', async (_req, res) => {
    try {
      const result = await pool.query('SELECT * FROM shop_suppliers ORDER BY name');
      res.json(result.rows);
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  // ─── Orders (authenticated) ───
  router.post('/orders', authenticate, requireSameClinic, async (req, res) => {
    try {
      const { clinic_id, items, delivery_address, delivery_method, payment_method, notes } = req.body;
      if (!items || items.length === 0) return res.status(400).json({ error: 'No items' });
      const orderId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
      let total = 0; const orderItems = [];
      for (const item of items) {
        const prod = await pool.query('SELECT * FROM shop_products WHERE id = $1', [item.product_id]);
        if (!prod.rows[0]) continue;
        const itemTotal = prod.rows[0].price * item.quantity; total += itemTotal;
        const itemId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
        orderItems.push({ id: itemId, product_id: item.product_id, product_name: prod.rows[0].name, quantity: item.quantity, price: prod.rows[0].price, total: itemTotal });
      }
      const deliveryCost = total >= 50000 ? 0 : 2500;
      await pool.query('INSERT INTO shop_orders (id, clinic_id, user_id, user_name, status, total, delivery_address, delivery_method, delivery_cost, payment_method, notes) VALUES ($1,$2,$3,$4,\'pending\',$5,$6,$7,$8,$9,$10)', [orderId, clinic_id, req.user.id, req.user.name, total + deliveryCost, delivery_address, delivery_method, deliveryCost, payment_method, notes]);
      for (const item of orderItems) {
        await pool.query('INSERT INTO shop_order_items (id, order_id, product_id, product_name, quantity, price, total) VALUES ($1,$2,$3,$4,$5,$6,$7)', [item.id, orderId, item.product_id, item.product_name, item.quantity, item.price, item.total]);
        await pool.query('UPDATE shop_products SET stock = stock - $1 WHERE id = $2', [item.quantity, item.product_id]);
      }
      res.json({ id: orderId, total: total + deliveryCost, items: orderItems });
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  router.get('/orders', authenticate, requireSameClinic, async (req, res) => {
    try {
      const { clinic_id } = req.query;
      let query = 'SELECT * FROM shop_orders'; const params = [];
      if (clinic_id) { query += ' WHERE clinic_id = $1'; params.push(clinic_id); }
      query += ' ORDER BY created_at DESC';
      const result = await pool.query(query, params);
      for (const order of result.rows) { const items = await pool.query('SELECT * FROM shop_order_items WHERE order_id = $1', [order.id]); order.items = items.rows; }
      res.json(result.rows);
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  // ─── Reviews (authenticated) ───
  router.post('/reviews', authenticate, async (req, res) => {
    try {
      const { product_id, pros, cons, comment, rating } = req.body;
      const id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
      await pool.query('INSERT INTO shop_reviews (id, product_id, clinic_id, user_id, user_name, rating, pros, cons, comment) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [id, product_id, req.user.clinicId, req.user.id, req.user.name, rating, pros, cons, comment]);
      await pool.query('UPDATE shop_products SET rating = (SELECT AVG(rating)::DECIMAL(2,1) FROM shop_reviews WHERE product_id = $1), review_count = (SELECT COUNT(*) FROM shop_reviews WHERE product_id = $1) WHERE id = $1', [product_id]);
      res.json({ id, success: true });
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  // ─── Favorites (authenticated) ───
  router.post('/favorites', authenticate, async (req, res) => {
    try {
      const { product_id } = req.body;
      const clinicId = req.user.clinicId;
      const existing = await pool.query('SELECT id FROM shop_favorites WHERE clinic_id = $1 AND product_id = $2', [clinicId, product_id]);
      if (existing.rows[0]) { await pool.query('DELETE FROM shop_favorites WHERE id = $1', [existing.rows[0].id]); return res.json({ added: false }); }
      const id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
      await pool.query('INSERT INTO shop_favorites (id, clinic_id, user_id, product_id) VALUES ($1,$2,$3,$4)', [id, clinicId, req.user.id, product_id]);
      res.json({ added: true, id });
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  router.get('/favorites', authenticate, async (req, res) => {
    try {
      const clinicId = req.user.clinicId;
      const result = await pool.query('SELECT f.*, p.name, p.brand, p.price, p.image_url, p.rating, p.review_count, p.stock FROM shop_favorites f JOIN shop_products p ON f.product_id = p.id WHERE f.clinic_id = $1 ORDER BY f.created_at DESC', [clinicId]);
      res.json(result.rows);
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  return router;
}
