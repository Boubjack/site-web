import { sql } from '../../lib/db.js';
import { getUser, getAdmin } from '../../lib/auth.js';

function splitList(value) {
  return String(value || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { mine, forAdmin } = req.query || {};

    if (forAdmin) {
      const admin = getAdmin(req);
      if (!admin) return res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
      const rows = await sql`
        SELECT p.*, u.shop_name, u.email AS seller_email
        FROM products p JOIN users u ON u.id = p.seller_id
        ORDER BY p.created_at DESC
      `;
      return res.status(200).json({ products: rows });
    }

    if (mine) {
      const user = getUser(req);
      if (!user || user.role !== 'vendeur') return res.status(401).json({ error: 'Connexion vendeur requise.' });
      const rows = await sql`SELECT * FROM products WHERE seller_id = ${user.id} ORDER BY created_at DESC`;
      return res.status(200).json({ products: rows });
    }

    const rows = await sql`SELECT * FROM products WHERE status = 'approved' ORDER BY created_at DESC`;
    return res.status(200).json({ products: rows });
  }

  if (req.method === 'POST') {
    const user = getUser(req);
    if (!user || user.role !== 'vendeur') {
      return res.status(401).json({ error: 'Connexion vendeur requise pour publier un produit.' });
    }
    const { name, category, price, sizes, colors, description, image } = req.body || {};
    if (!name || !category || !price || !sizes || !colors || !description || !image) {
      return res.status(400).json({ error: 'Veuillez remplir toutes les informations du produit.' });
    }
    const priceInt = parseInt(String(price).replace(/[^\d]/g, ''), 10);
    if (!priceInt || priceInt <= 0) {
      return res.status(400).json({ error: 'Prix invalide.' });
    }
    const rows = await sql`
      INSERT INTO products (seller_id, name, category, price, sizes, colors, description, image_base64, status)
      VALUES (${user.id}, ${name}, ${category}, ${priceInt}, ${splitList(sizes)}, ${splitList(colors)}, ${description}, ${image}, 'pending')
      RETURNING *
    `;
    return res.status(201).json({ product: rows[0] });
  }

  res.status(405).json({ error: 'Méthode non autorisée' });
}
