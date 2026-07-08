import { clearUserCookie } from '../../lib/auth.js';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }
  clearUserCookie(res);
  res.status(200).json({ ok: true });
}
