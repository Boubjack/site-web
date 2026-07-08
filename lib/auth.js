import jwt from 'jsonwebtoken';
import { serialize } from 'cookie';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const USER_COOKIE = 'emarket_token';
const ADMIN_COOKIE = 'emarket_admin_token';

function cookieOptions(maxAgeSeconds) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: maxAgeSeconds
  };
}

export function setUserCookie(res, user) {
  const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
  res.setHeader('Set-Cookie', serialize(USER_COOKIE, token, cookieOptions(7 * 24 * 60 * 60)));
}

export function clearUserCookie(res) {
  res.setHeader('Set-Cookie', serialize(USER_COOKIE, '', cookieOptions(0)));
}

export function getUser(req) {
  const token = req.cookies?.[USER_COOKIE];
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export function setAdminCookie(res) {
  const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '12h' });
  res.setHeader('Set-Cookie', serialize(ADMIN_COOKIE, token, cookieOptions(12 * 60 * 60)));
}

export function clearAdminCookie(res) {
  res.setHeader('Set-Cookie', serialize(ADMIN_COOKIE, '', cookieOptions(0)));
}

export function getAdmin(req) {
  const token = req.cookies?.[ADMIN_COOKIE];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return payload.role === 'admin' ? payload : null;
  } catch {
    return null;
  }
}
