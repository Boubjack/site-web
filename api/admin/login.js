import { setAdminCookie } from '../../lib/auth.js';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }
  const { email, password, secretKey } = req.body || {};
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'change-me-admin-password';
  const adminSecretKey = process.env.ADMIN_SECRET_KEY || 'change-me-secret-key';

  if (email !== adminEmail || password !== adminPassword || secretKey !== adminSecretKey) {
    return res.status(401).json({ error: 'Accès refusé. Email, mot de passe ou clé incorrect.' });
  }
  setAdminCookie(res);
  res.status(200).json({ ok: true });
}
