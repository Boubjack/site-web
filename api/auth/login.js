import bcrypt from 'bcryptjs';
import { sql } from '../../lib/db.js';
import { setUserCookie } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis.' });
  }
  const normalizedEmail = String(email).toLowerCase().trim();
  const rows = await sql`SELECT * FROM users WHERE email = ${normalizedEmail}`;
  const row = rows[0];
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
  }
  const user = {
    id: row.id,
    role: row.role,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    username: row.username,
    shopName: row.shop_name,
    phone: row.phone,
    city: row.city
  };
  setUserCookie(res, user);
  res.status(200).json({ user });
}
