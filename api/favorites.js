import { sql } from '../lib/db.js';
import { getUser } from '../lib/auth.js';

export default async function handler(req, res) {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Connexion requise.' });

  if (req.method === 'GET') {
    const rows = await sql`SELECT product_id FROM favorites WHERE user_id = ${user.id}`;
    return res.status(200).json({ favorites: rows.map((r) => r.product_id) });
  }

  if (req.method === 'POST') {
    const { productId } = req.body || {};
    if (!productId) return res.status(400).json({ error: 'productId requis.' });
    const existing = await sql`SELECT 1 FROM favorites WHERE user_id = ${user.id} AND product_id = ${productId}`;
    if (existing.length > 0) {
      await sql`DELETE FROM favorites WHERE user_id = ${user.id} AND product_id = ${productId}`;
      return res.status(200).json({ favorited: false });
    }
    await sql`INSERT INTO favorites (user_id, product_id) VALUES (${user.id}, ${productId})`;
    return res.status(200).json({ favorited: true });
  }

  res.status(405).json({ error: 'Méthode non autorisée' });
}
