import Stripe from 'stripe';
import { sql } from '../lib/db.js';
import { getUser } from '../lib/auth.js';

// Le franc CFA (XOF) est arrimé à taux fixe à l'euro et n'est pas une devise
// supportée par Stripe. On convertit donc au taux officiel fixe de la zone UEMOA.
const XOF_PER_EUR = 655.957;

function xofToEurCents(xofAmount) {
  return Math.round((xofAmount / XOF_PER_EUR) * 100);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({
      error: 'Paiement indisponible : STRIPE_SECRET_KEY n\'est pas configurée sur le serveur.'
    });
  }

  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Connexion requise.' });

  const { orderId } = req.body || {};
  const orders = await sql`SELECT * FROM orders WHERE id = ${orderId}`;
  const order = orders[0];
  if (!order || order.user_id !== user.id) {
    return res.status(404).json({ error: 'Commande introuvable.' });
  }
  if (order.status !== 'pending') {
    return res.status(400).json({ error: 'Cette commande a déjà été traitée.' });
  }

  const items = await sql`SELECT * FROM order_items WHERE order_id = ${order.id}`;
  const baseUrl = process.env.BASE_URL || `https://${req.headers.host}`;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: items.map((item) => ({
        quantity: item.quantity,
        price_data: {
          currency: 'eur',
          unit_amount: xofToEurCents(item.price),
          product_data: {
            name: `${item.name}${item.size ? ` (${item.size})` : ''}`,
            description: 'Montant converti depuis des FCFA au taux fixe UEMOA (1 EUR = 655,957 FCFA).'
          }
        }
      })),
      metadata: { order_id: String(order.id) },
      success_url: `${baseUrl}/?paid=1&order=${order.id}`,
      cancel_url: `${baseUrl}/?cancelled=1`
    });
    await sql`UPDATE orders SET stripe_session_id = ${session.id} WHERE id = ${order.id}`;
    res.status(200).json({ url: session.url });
  } catch (err) {
    res.status(502).json({ error: `Erreur Stripe : ${err.message}` });
  }
}
