import { sql } from '../../lib/db.js';
import { getUser, getAdmin } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { forAdmin } = req.query || {};
    if (forAdmin) {
      const admin = getAdmin(req);
      if (!admin) return res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
      const orders = await sql`SELECT * FROM orders ORDER BY created_at DESC`;
      return res.status(200).json({ orders });
    }
    const user = getUser(req);
    if (!user) return res.status(401).json({ error: 'Connexion requise.' });
    const orders = await sql`SELECT * FROM orders WHERE user_id = ${user.id} ORDER BY created_at DESC`;
    const items = await sql`
      SELECT oi.* FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.user_id = ${user.id}
    `;
    const withItems = orders.map((o) => ({
      ...o,
      items: items.filter((i) => i.order_id === o.id)
    }));
    return res.status(200).json({ orders: withItems });
  }

  if (req.method === 'POST') {
    const user = getUser(req);
    if (!user) return res.status(401).json({ error: 'Connexion requise pour commander.' });

    const { customerName, phone, city, items } = req.body || {};
    if (!customerName || !phone || !city) {
      return res.status(400).json({ error: 'Nom complet, téléphone et ville sont requis.' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Le panier est vide.' });
    }

    const productIds = [...new Set(items.map((i) => i.productId))];
    const products = await sql`SELECT * FROM products WHERE id = ANY(${productIds}) AND status = 'approved'`;
    const productMap = new Map(products.map((p) => [p.id, p]));

    let total = 0;
    const resolvedItems = [];
    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) return res.status(400).json({ error: `Produit ${item.productId} introuvable ou indisponible.` });
      const quantity = Math.max(1, parseInt(item.quantity, 10) || 1);
      total += product.price * quantity;
      resolvedItems.push({ product, quantity, size: item.size || null, color: item.color || null });
    }

    const orderRows = await sql`
      INSERT INTO orders (user_id, customer_name, phone, city, status, total)
      VALUES (${user.id}, ${customerName}, ${phone}, ${city}, 'pending', ${total})
      RETURNING *
    `;
    const order = orderRows[0];

    for (const { product, quantity, size, color } of resolvedItems) {
      await sql`
        INSERT INTO order_items (order_id, product_id, name, price, quantity, size, color)
        VALUES (${order.id}, ${product.id}, ${product.name}, ${product.price}, ${quantity}, ${size}, ${color})
      `;
    }

    const orderItems = await sql`SELECT * FROM order_items WHERE order_id = ${order.id}`;
    return res.status(201).json({ order: { ...order, items: orderItems } });
  }

  res.status(405).json({ error: 'Méthode non autorisée' });
}
