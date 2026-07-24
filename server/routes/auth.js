const express = require('express');
const { store } = require('../db/store');
const { hash } = require('../db/seed');
const { signToken, requireAuth } = require('../middleware/auth');
const { asyncHandler, ApiError } = require('../middleware/errors');

const router = express.Router();

router.post('/register', asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) throw new ApiError(400, 'name, email et password sont requis.');
  if (store.findOne('users', (u) => u.email === email)) throw new ApiError(409, 'Cet email est déjà utilisé.');
  const user = store.insert('users', {
    name: String(name).slice(0, 100),
    email: String(email).toLowerCase().slice(0, 200),
    password: hash(password),
    role: role === 'seller' ? 'seller' : 'client',
    ...(role === 'seller' ? { shop: String(name).slice(0, 100) } : {}),
  });
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = store.findOne('users', (u) => u.email === String(email || '').toLowerCase());
  if (!user || user.password !== hash(password || '')) throw new ApiError(401, 'Email ou mot de passe incorrect.');
  res.json({ token: signToken(user), user: publicUser(user) });
}));

router.get('/me', requireAuth, (req, res) => {
  const user = store.getById('users', req.user.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });
  res.json({ user: publicUser(user) });
});

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, shop: u.shop || null };
}

module.exports = router;
