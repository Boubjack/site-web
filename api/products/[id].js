import { sql } from '../../lib/db.js';
import { getUser, getAdmin } from '../../lib/auth.js';

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'PATCH') {
    const admin = getAdmin(req);
    if (!admin) return res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
    const { status } = req.body || {};
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Statut invalide.' });
    }
    const rows = await sql`UPDATE products SET status = ${status} WHERE id = ${id} RETURNING *`;
    if (rows.length === 0) return res.status(404).json({ error: 'Produit introuvable.' });
    return res.status(200).json({ product: rows[0] });
  }

  if (req.method === 'DELETE') {
    const admin = getAdmin(req);
    const user = getUser(req);
    const existing = await sql`SELECT * FROM products WHERE id = ${id}`;
    if (existing.length === 0) return res.status(404).json({ error: 'Produit introuvable.' });
    const isOwner = user && user.role === 'vendeur' && user.id === existing[0].seller_id;
    if (!admin && !isOwner) return res.status(403).json({ error: 'Action non autorisée.' });
    await sql`DELETE FROM products WHERE id = ${id}`;
    return res.status(200).json({ ok: true });
  }

  res.status(405).json({ error: 'Méthode non autorisée' });
}
