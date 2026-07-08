import { getUser } from '../../lib/auth.js';

export default function handler(req, res) {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Non connecté.' });
  res.status(200).json({ user });
}
