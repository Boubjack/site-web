/**
 * Données de démonstration E-Market (contexte Afrique de l'Ouest, prix en FCFA).
 * Exécution : `npm run seed` — ou automatique au premier démarrage.
 */
const crypto = require('crypto');
const { store } = require('./store');

function hash(password) {
  return crypto.createHash('sha256').update(password + '::emarket').digest('hex');
}

const USERS = [
  { id: 'u-admin', name: 'Admin E-Market', email: 'admin@emarket.ml', password: hash('admin123'), role: 'admin' },
  { id: 'u-vend-1', name: 'Bamako Style', email: 'vendeur@emarket.ml', password: hash('vendeur123'), role: 'seller', shop: 'Bamako Style', rating: 4.7 },
  { id: 'u-vend-2', name: 'Sahel Tech', email: 'saheltech@emarket.ml', password: hash('vendeur123'), role: 'seller', shop: 'Sahel Tech', rating: 4.5 },
  { id: 'u-vend-3', name: 'Wax & Co', email: 'waxco@emarket.ml', password: hash('vendeur123'), role: 'seller', shop: 'Wax & Co', rating: 4.8 },
  { id: 'u-cli-1', name: 'Aminata Traoré', email: 'client@emarket.ml', password: hash('client123'), role: 'client' },
  { id: 'u-cli-2', name: 'Moussa Keïta', email: 'moussa@emarket.ml', password: hash('client123'), role: 'client' },
];

const PRODUCTS = [
  // --- Mode mariage / cérémonie ---
  { id: 'p-001', name: 'Grand boubou bazin riche brodé', category: 'mode-homme', subcategory: 'tenues-ceremonie', price: 45000, colors: ['blanc', 'bleu ciel', 'doré'], sizes: ['M', 'L', 'XL', 'XXL'], sellerId: 'u-vend-3', stock: 12, emoji: '🥻', occasion: ['mariage', 'ceremonie', 'tabaski'], style: 'traditionnel', material: 'bazin', gender: 'homme',
    description: "Grand boubou en bazin riche getzner, broderies main. Idéal mariage et grandes cérémonies à Bamako." },
  { id: 'p-002', name: 'Robe de cérémonie en wax premium', category: 'mode-femme', subcategory: 'tenues-ceremonie', price: 38000, colors: ['orange', 'multicolore'], sizes: ['S', 'M', 'L', 'XL'], sellerId: 'u-vend-3', stock: 8, emoji: '👗', occasion: ['mariage', 'ceremonie'], style: 'traditionnel-chic', material: 'wax', gender: 'femme',
    description: "Robe cousue en wax hollandais, coupe moderne, parfaite pour un mariage élégant." },
  { id: 'p-003', name: 'Costume 2 pièces slim fit', category: 'mode-homme', subcategory: 'costumes', price: 48000, colors: ['noir', 'bleu nuit'], sizes: ['M', 'L', 'XL'], sellerId: 'u-vend-1', stock: 6, emoji: '🤵', occasion: ['mariage', 'bureau'], style: 'moderne', material: 'polyester-laine', gender: 'homme',
    description: "Costume slim moderne, veste + pantalon. Élégance garantie en cérémonie comme au bureau." },
  { id: 'p-004', name: 'Robe élégante noire de soirée', category: 'mode-femme', subcategory: 'robes', price: 27000, colors: ['noir'], sizes: ['S', 'M', 'L'], sellerId: 'u-vend-1', stock: 15, emoji: '💃', occasion: ['soiree', 'mariage'], style: 'elegant', material: 'satin', gender: 'femme',
    description: "Robe noire élégante en satin, coupe fluide, idéale soirées et réceptions." },
  { id: 'p-005', name: 'Ensemble pagne tissé Ségou', category: 'mode-femme', subcategory: 'tenues-ceremonie', price: 32000, colors: ['indigo', 'blanc'], sizes: ['M', 'L', 'XL'], sellerId: 'u-vend-3', stock: 10, emoji: '🧵', occasion: ['mariage', 'ceremonie', 'bapteme'], style: 'traditionnel', material: 'coton tissé', gender: 'femme',
    description: "Ensemble en pagne tissé de Ségou, tissage artisanal, portée fière des grandes occasions." },

  // --- Streetwear / casual ---
  { id: 'p-010', name: 'Hoodie oversize premium noir', category: 'mode-homme', subcategory: 'sweats', price: 15000, colors: ['noir', 'gris'], sizes: ['S', 'M', 'L', 'XL'], sellerId: 'u-vend-1', stock: 30, emoji: '🧥', occasion: ['casual'], style: 'streetwear', material: 'coton molletonné', gender: 'unisexe',
    description: "Hoodie oversize 400g/m², coton épais, coupe streetwear. Le basique premium." },
  { id: 'p-011', name: 'Pantalon cargo urbain', category: 'mode-homme', subcategory: 'pantalons', price: 12000, colors: ['noir', 'kaki'], sizes: ['S', 'M', 'L', 'XL'], sellerId: 'u-vend-1', stock: 25, emoji: '👖', occasion: ['casual'], style: 'streetwear', material: 'coton', gender: 'homme',
    description: "Cargo multi-poches, coupe fuselée. S'associe parfaitement avec un hoodie oversize." },
  { id: 'p-012', name: 'Sneakers blanches classiques', category: 'chaussures', subcategory: 'sneakers', price: 18000, colors: ['blanc'], sizes: ['39', '40', '41', '42', '43', '44'], sellerId: 'u-vend-1', stock: 20, emoji: '👟', occasion: ['casual'], style: 'streetwear', material: 'cuir synthétique', gender: 'unisexe',
    description: "Sneakers blanches intemporelles, semelle confort. Vont avec tout." },
  { id: 'p-013', name: 'Casquette brodée E-Market', category: 'accessoires', subcategory: 'casquettes', price: 5000, colors: ['noir', 'orange'], sizes: ['unique'], sellerId: 'u-vend-1', stock: 50, emoji: '🧢', occasion: ['casual'], style: 'streetwear', material: 'coton', gender: 'unisexe',
    description: "Casquette snapback brodée, visière plate." },
  { id: 'p-014', name: 'T-shirt graphique Bamako', category: 'mode-homme', subcategory: 'tshirts', price: 7000, colors: ['blanc', 'noir', 'orange'], sizes: ['S', 'M', 'L', 'XL'], sellerId: 'u-vend-1', stock: 40, emoji: '👕', occasion: ['casual'], style: 'streetwear', material: 'coton bio', gender: 'unisexe',
    description: "T-shirt sérigraphié édition Bamako, 100% coton bio." },

  // --- Électronique ---
  { id: 'p-020', name: 'Smartphone Gaming X-Pro 256Go', category: 'electronique', subcategory: 'smartphones', price: 185000, colors: ['noir'], sizes: [], sellerId: 'u-vend-2', stock: 9, emoji: '📱', occasion: [], style: 'gaming', material: '', gender: '',
    specs: { ram: '12 Go', stockage: '256 Go', batterie: '5500 mAh', ecran: '6.8" AMOLED 120Hz', puce: 'Octa-core 3.2GHz' },
    description: "Smartphone taillé pour le jeu : écran 120Hz, refroidissement vapeur, 12 Go de RAM. Le meilleur rapport puissance/prix sous 200 000 FCFA." },
  { id: 'p-021', name: 'Smartphone Lite 128Go', category: 'electronique', subcategory: 'smartphones', price: 95000, colors: ['bleu', 'noir'], sizes: [], sellerId: 'u-vend-2', stock: 14, emoji: '📱', occasion: [], style: 'quotidien', material: '', gender: '',
    specs: { ram: '6 Go', stockage: '128 Go', batterie: '5000 mAh', ecran: '6.5" LCD 90Hz' },
    description: "Le quotidien sans se ruiner : grande batterie, double SIM, photo correcte." },
  { id: 'p-022', name: 'Écouteurs sans fil ANC', category: 'electronique', subcategory: 'audio', price: 22000, colors: ['noir', 'blanc'], sizes: [], sellerId: 'u-vend-2', stock: 35, emoji: '🎧', occasion: [], style: '', material: '', gender: '',
    description: "Réduction de bruit active, 30h d'autonomie avec le boîtier, Bluetooth 5.3." },
  { id: 'p-023', name: 'Powerbank 20 000 mAh charge rapide', category: 'electronique', subcategory: 'accessoires-tech', price: 13000, colors: ['noir'], sizes: [], sellerId: 'u-vend-2', stock: 40, emoji: '🔋', occasion: [], style: '', material: '', gender: '',
    description: "Indispensable : 20 000 mAh, 22.5W, deux sorties USB. Compagnon des coupures." },
  { id: 'p-024', name: 'Montre connectée Sport', category: 'electronique', subcategory: 'montres', price: 28000, colors: ['noir', 'orange'], sizes: [], sellerId: 'u-vend-2', stock: 18, emoji: '⌚', occasion: [], style: 'sport', material: '', gender: 'unisexe',
    description: "Suivi santé, GPS, 10 jours d'autonomie, étanche 5ATM." },

  // --- Accessoires / maison ---
  { id: 'p-030', name: 'Sac à main cuir artisanal', category: 'accessoires', subcategory: 'sacs', price: 24000, colors: ['marron', 'noir'], sizes: [], sellerId: 'u-vend-3', stock: 11, emoji: '👜', occasion: ['soiree', 'bureau'], style: 'artisanal', material: 'cuir', gender: 'femme',
    description: "Sac en cuir véritable travaillé à la main par des artisans de Bamako." },
  { id: 'p-031', name: 'Bijoux touareg argent (parure)', category: 'accessoires', subcategory: 'bijoux', price: 19000, colors: ['argent'], sizes: [], sellerId: 'u-vend-3', stock: 7, emoji: '💍', occasion: ['mariage', 'soiree'], style: 'traditionnel', material: 'argent', gender: 'femme',
    description: "Parure touareg en argent : collier, boucles et bracelet gravés main." },
  { id: 'p-032', name: 'Babouches cuir premium', category: 'chaussures', subcategory: 'babouches', price: 14000, colors: ['blanc', 'marron', 'noir'], sizes: ['40', '41', '42', '43', '44'], sellerId: 'u-vend-3', stock: 16, emoji: '🥿', occasion: ['mariage', 'ceremonie', 'tabaski'], style: 'traditionnel', material: 'cuir', gender: 'homme',
    description: "Babouches en cuir souple, finition premium. L'accord parfait du grand boubou." },
];

const REVIEWS = [
  { id: 'r-1', productId: 'p-001', userId: 'u-cli-1', rating: 5, comment: 'Broderie magnifique, reçu en 3 jours à Bamako.' },
  { id: 'r-2', productId: 'p-001', userId: 'u-cli-2', rating: 4, comment: 'Très beau bazin, taille un peu grande.' },
  { id: 'r-3', productId: 'p-010', userId: 'u-cli-2', rating: 5, comment: 'Qualité épaisse, vraiment premium.' },
  { id: 'r-4', productId: 'p-020', userId: 'u-cli-2', rating: 5, comment: 'Il fait tourner tous mes jeux sans chauffer.' },
  { id: 'r-5', productId: 'p-004', userId: 'u-cli-1', rating: 4, comment: 'Coupe élégante, tissu agréable.' },
  { id: 'r-6', productId: 'p-012', userId: 'u-cli-1', rating: 4, comment: 'Confortables, vont avec tout.' },
  { id: 'r-7', productId: 'p-021', userId: 'u-cli-1', rating: 4, comment: 'Bon téléphone pour le prix, batterie solide.' },
];

function daysAgo(n) {
  return new Date(Date.now() - n * 86400000).toISOString();
}

const ORDERS = [
  { id: 'o-1', userId: 'u-cli-1', items: [{ productId: 'p-001', qty: 1, price: 45000 }], total: 45000, status: 'livree', createdAt: daysAgo(21) },
  { id: 'o-2', userId: 'u-cli-1', items: [{ productId: 'p-030', qty: 1, price: 24000 }], total: 24000, status: 'livree', createdAt: daysAgo(14) },
  { id: 'o-3', userId: 'u-cli-2', items: [{ productId: 'p-010', qty: 1, price: 15000 }, { productId: 'p-011', qty: 1, price: 12000 }], total: 27000, status: 'livree', createdAt: daysAgo(10) },
  { id: 'o-4', userId: 'u-cli-2', items: [{ productId: 'p-020', qty: 1, price: 185000 }], total: 185000, status: 'expediee', createdAt: daysAgo(3) },
  { id: 'o-5', userId: 'u-cli-1', items: [{ productId: 'p-004', qty: 1, price: 27000 }], total: 27000, status: 'en-cours', createdAt: daysAgo(1) },
  { id: 'o-6', userId: 'u-cli-2', items: [{ productId: 'p-023', qty: 2, price: 13000 }], total: 26000, status: 'livree', createdAt: daysAgo(6) },
];

const EVENTS = [
  { id: 'e-1', userId: 'u-cli-1', type: 'view', productId: 'p-002', createdAt: daysAgo(2) },
  { id: 'e-2', userId: 'u-cli-1', type: 'view', productId: 'p-005', createdAt: daysAgo(2) },
  { id: 'e-3', userId: 'u-cli-1', type: 'favorite', productId: 'p-031', createdAt: daysAgo(2) },
  { id: 'e-4', userId: 'u-cli-2', type: 'view', productId: 'p-012', createdAt: daysAgo(1) },
  { id: 'e-5', userId: 'u-cli-2', type: 'view', productId: 'p-022', createdAt: daysAgo(1) },
  { id: 'e-6', userId: 'u-cli-2', type: 'search', query: 'telephone gaming', createdAt: daysAgo(4) },
];

function seed({ force = false } = {}) {
  if (!force && store.all('products').length > 0) return false;
  store.replaceAll('users', USERS);
  store.replaceAll('products', PRODUCTS.map((p) => ({ ...p, createdAt: daysAgo(30), active: true })));
  store.replaceAll('reviews', REVIEWS.map((r) => ({ ...r, createdAt: daysAgo(8) })));
  store.replaceAll('orders', ORDERS);
  store.replaceAll('events', EVENTS);
  store.replaceAll('aiMemory', []);
  store.replaceAll('mediaJobs', []);
  store.replaceAll('supportTickets', []);
  store.replaceAll('aiConversations', []);
  return true;
}

if (require.main === module) {
  const done = seed({ force: true });
  console.log(done ? 'Base de démonstration initialisée.' : 'Rien à faire.');
}

module.exports = { seed, hash };
