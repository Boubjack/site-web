import { getAdmin } from '../../lib/auth.js';

export default function handler(req, res) {
  const admin = getAdmin(req);
  if (!admin) return res.status(401).json({ error: 'Non connecté.' });
  res.status(200).json({ ok: true });
}
