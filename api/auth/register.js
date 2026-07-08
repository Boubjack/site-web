import bcrypt from 'bcryptjs';
import { sql } from '../../lib/db.js';
import { setUserCookie } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const {
    role,
    firstName,
    lastName,
    birthDate,
    gender,
    email,
    password,
    username,
    shopName,
    phone,
    city
  } = req.body || {};

  if (role !== 'client' && role !== 'vendeur') {
    return res.status(400).json({ error: 'Rôle invalide.' });
  }
  const required = { firstName, lastName, email, password, username };
  if (role === 'vendeur') Object.assign(required, { shopName, phone, city });
  if (Object.values(required).some((v) => !String(v || '').trim())) {
    return res.status(400).json({ error: 'Veuillez remplir toutes les cases.' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères.' });
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const existing = await sql`SELECT id FROM users WHERE email = ${normalizedEmail}`;
  if (existing.length > 0) {
    return res.status(409).json({ error: 'Un compte existe déjà avec cet email.' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const rows = await sql`
    INSERT INTO users (role, first_name, last_name, birth_date, gender, email, password_hash, username, shop_name, phone, city)
    VALUES (${role}, ${firstName}, ${lastName}, ${birthDate || null}, ${gender || null}, ${normalizedEmail}, ${passwordHash}, ${username}, ${shopName || null}, ${phone || null}, ${city || null})
    RETURNING id, role, first_name, last_name, email, username, shop_name, phone, city
  `;
  const row = rows[0];
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
  res.status(201).json({ user });
}
