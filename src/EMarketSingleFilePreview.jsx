import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Menu, Search, ShoppingBag, Sparkles, Star, User, X, Bot, ShieldCheck } from "lucide-react";
import { apiFetch, fileToBase64 } from "./lib/api.js";
import { colorToHex } from "./lib/colors.js";

const categories = ["Tous", "Homme", "Femme", "Unisexe", "Chaussures", "Accessoires", "Services"];

const text = {
  FR: {
    chooseSpace: "Choisissez votre espace",
    intro: "Une boutique e-commerce moderne avec une entrée immersive, des animations premium et une expérience fluide.",
    enter: "Entrer dans la boutique",
    client: "Client",
    seller: "Vendeur",
    buy: "Acheter",
    sell: "Vendre",
    clientText: "Boutique animée, panier, favoris et commande simple.",
    sellerText: "Vendez vos produits plus facilement avec E‑Market.",
    login: "Connexion",
    register: "Créer un compte",
    loginBtn: "Se connecter",
    createBtn: "Créer le compte",
    noAccount: "Pas de compte ? Inscrivez-vous",
    alreadyAccount: "Déjà un compte ? Connectez-vous",
    email: "Adresse email",
    password: "Mot de passe",
    firstName: "Prénom",
    lastName: "Nom",
    gender: "Sexe",
    male: "Homme",
    female: "Femme",
    other: "Autre",
    username: "Nom utilisateur",
    shopName: "Nom de la boutique",
    phone: "Téléphone",
    city: "Ville",
    terms: "J’accepte les conditions d’utilisation.",
    privacy: "J’accepte la politique de confidentialité.",
    fillAll: "Veuillez remplir toutes les cases.",
    acceptRules: "Veuillez accepter les conditions et la confidentialité.",
    heroBadge: "Nouvelle vitrine animée",
    heroTitle: "Aucun produit n’a encore été ajouté",
    heroText: "Les produits publiés par les vendeurs apparaîtront ici.",
    size: "Taille",
    color: "Couleur",
    add: "Ajouter",
    chooseSizeColor: "Veuillez choisir une taille et une couleur.",
    cart: "Mon panier",
    favorites: "Mes favoris",
    emptyCart: "Votre panier est vide.",
    emptyFav: "Aucun favori pour l’instant.",
    finalPrice: "Le prix final vous sera communiqué par l’équipe E‑Market. Merci pour votre confiance.",
    order: "Commander",
    orderNow: "Commander maintenant",
    paymentStarted: "Paiement sécurisé lancé",
    orderSaved: "Votre commande a été enregistrée.",
    sellerSpace: "Espace vendeur E‑Market",
    sellEasy: "Vendez vos produits plus facilement avec E‑Market.",
    sellNow: "Vendre maintenant",
    addProduct: "Ajouter un produit",
    productName: "Nom du produit",
    productDesc: "Description / détails",
    price: "Prix en FCFA",
    colorsAvailable: "Couleurs disponibles : noir, blanc, rouge...",
    sizesAvailable: "Tailles disponibles : S, M, L ou 40, 41, 42",
    photoRequired: "Ajouter une photo obligatoire",
    phoneGallery: "Téléphone : galerie • Ordinateur : fichier",
    publish: "Mettre en vente",
    sellerEmpty: "Aucun produit mis en vente.",
    sellerSuccess: "Produit ajouté avec succès dans la boutique E‑Market.",
    how: "Comment ça marche ?",
    simple: "Simple, rapide et sécurisé",
  },
  EN: {
    chooseSpace: "Choose your space",
    intro: "A modern e-commerce store with an immersive entrance.",
    enter: "Enter the store",
    client: "Customer",
    seller: "Seller",
    buy: "Buy",
    sell: "Sell",
    clientText: "Animated store, cart, favorites and simple checkout.",
    sellerText: "Sell your products more easily with E‑Market.",
    login: "Login",
    register: "Create account",
    loginBtn: "Log in",
    createBtn: "Create account",
    noAccount: "No account? Sign up",
    alreadyAccount: "Already have an account? Log in",
    email: "Email address",
    password: "Password",
    firstName: "First name",
    lastName: "Last name",
    gender: "Gender",
    male: "Male",
    female: "Female",
    other: "Other",
    username: "Username",
    shopName: "Store name",
    phone: "Phone",
    city: "City",
    terms: "I accept terms of use.",
    privacy: "I accept privacy policy.",
    fillAll: "Please fill all fields.",
    acceptRules: "Please accept terms and privacy.",
    heroBadge: "New animated showcase",
    heroTitle: "No product has been added yet",
    heroText: "Products published by sellers will appear here.",
    size: "Size",
    color: "Color",
    add: "Add",
    chooseSizeColor: "Please choose size and color.",
    cart: "My cart",
    favorites: "My favorites",
    emptyCart: "Your cart is empty.",
    emptyFav: "No favorites yet.",
    finalPrice: "The final price will be communicated by the E‑Market team. Thank you.",
    order: "Order",
    orderNow: "Order now",
    paymentStarted: "Secure payment started",
    orderSaved: "Your order has been saved.",
    sellerSpace: "E‑Market seller space",
    sellEasy: "Sell your products more easily with E‑Market.",
    sellNow: "Sell now",
    addProduct: "Add a product",
    productName: "Product name",
    productDesc: "Description / details",
    price: "Price in FCFA",
    colorsAvailable: "Available colors: black, white, red...",
    sizesAvailable: "Available sizes: S, M, L or 40, 41, 42",
    photoRequired: "Required product photo",
    phoneGallery: "Phone: gallery • Computer: file",
    publish: "Publish product",
    sellerEmpty: "No products listed.",
    sellerSuccess: "Product successfully added to the E‑Market store.",
    how: "How does it work?",
    simple: "Simple, fast and secure",
  },
};

function ShopOpeningAnimation() {
  return (
    <div className="fixed inset-0 z-[1000] overflow-hidden bg-black">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,.18),rgba(0,0,0,.82)_55%,black_100%)]" />
      <motion.div
        initial={{ scale: 0.55, y: 170 }}
        animate={{ scale: 1.55, y: -160 }}
        transition={{ duration: 2.8, ease: "easeInOut" }}
        className="absolute left-1/2 top-1/2 h-[70vh] w-[72vw] -translate-x-1/2 -translate-y-1/2 rounded-[3rem] border border-white/15 bg-white/[.06] shadow-[0_0_120px_rgba(255,255,255,.18)] backdrop-blur-xl"
      >
        <div className="absolute left-1/2 top-8 -translate-x-1/2 rounded-full bg-black/60 px-8 py-3 text-3xl font-black text-white">E MARKET</div>
        <motion.div initial={{ scaleX: 1 }} animate={{ scaleX: 0 }} transition={{ duration: 1.4, delay: 0.35 }} className="absolute left-0 top-0 h-full w-1/2 origin-left rounded-l-[3rem] bg-zinc-950" />
        <motion.div initial={{ scaleX: 1 }} animate={{ scaleX: 0 }} transition={{ duration: 1.4, delay: 0.35 }} className="absolute right-0 top-0 h-full w-1/2 origin-right rounded-r-[3rem] bg-zinc-950" />
      </motion.div>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white">
        <motion.div animate={{ y: [0, -12, 0], scale: [1, 1.08, 1] }} transition={{ duration: 1.4, repeat: Infinity }} className="mb-7 rounded-full border border-white/20 bg-white/10 p-8 backdrop-blur-xl">
          <ShoppingBag size={56} />
        </motion.div>
        <h1 className="text-6xl font-black tracking-[-.08em] md:text-8xl">LA BOUTIQUE<br />S’OUVRE</h1><p className="mt-6 text-lg text-zinc-300">Découverte immersive des nouveaux produits E‑Market</p>
      </div>
    </div>
  );
}

function ProductCard({ product, t, favorites, onFavorite, onAdd }) {
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [error, setError] = useState("");

  const add = () => {
    if (!size || !color) {
      setError(t.chooseSizeColor);
      return;
    }
    setError("");
    onAdd(product, size, color);
  };

  return (
    <motion.article initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[.04] shadow-2xl backdrop-blur-xl transition hover:-translate-y-2">
      <div className="relative h-72 overflow-hidden bg-zinc-900">
        <img src={product.image} alt={product.name} className="h-full w-full object-cover transition duration-700 hover:scale-110" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
        <div className="absolute left-4 top-4 rounded-full bg-black/50 px-3 py-1 text-xs font-bold backdrop-blur-md">{product.tag}</div>
        <button onClick={() => onFavorite(product.id)} className={`absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full ${favorites.includes(product.id) ? "bg-red-500" : "bg-black/50"}`}>
          <Heart size={18} fill={favorites.includes(product.id) ? "white" : "transparent"} />
        </button>
      </div>
      <div className="p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[.3em] text-zinc-500">{product.category}</p>
            <h3 className="mt-1 text-xl font-black">{product.name}</h3>
          </div>
          <div className="flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-black text-black"><Star size={13} fill="black" />4.9</div>
        </div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[.25em] text-zinc-500">{t.color}</p>
        <div className="mb-4 flex gap-2">
          {product.colors.map((c) => <button key={c} onClick={() => setColor(c)} style={{ backgroundColor: c }} className={`h-7 w-7 rounded-full border ${color === c ? "ring-2 ring-white" : "border-white/30"}`} />)}
        </div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[.25em] text-zinc-500">{t.size}</p>
        <div className="mb-4 flex flex-wrap gap-2">
          {product.sizes.map((s) => <button key={s} onClick={() => setSize(s)} className={`rounded-full border px-3 py-1 text-xs ${size === s ? "bg-white text-black" : "border-white/10 bg-white/[.06] text-zinc-300"}`}>{s}</button>)}
        </div>
        {error && <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{error}</p>}
        <div className="flex items-center justify-between gap-3">
          <p className="font-black">{product.price}</p>
          <button onClick={add} className="rounded-full bg-white px-5 py-3 text-sm font-black text-black">{t.add}</button>
        </div>
      </div>
    </motion.article>
  );
}

function AuthModal({ t, role, setOpenShop, setShowAuth, setSellerDashboard, setShopAnimation, onAuthenticated }) {
  const [authMode, setAuthMode] = useState("login");
  const [form, setForm] = useState({ firstName: "", lastName: "", birthDate: "", gender: "", email: "", password: "", username: "", shopName: "", phone: "", city: "", terms: false, privacy: false });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const u = (k, v) => {
    setForm((p) => ({ ...p, [k]: v }));
    setError("");
  };

  const submit = async () => {
    const req = authMode === "login" ? ["email", "password"] : role === "vendeur" ? ["firstName", "lastName", "birthDate", "gender", "email", "password", "username", "shopName", "phone", "city"] : ["firstName", "lastName", "birthDate", "gender", "email", "password", "username"];
    if (req.some((k) => !String(form[k]).trim())) return setError(t.fillAll);
    if (authMode === "register" && (!form.terms || !form.privacy)) return setError(t.acceptRules);

    setLoading(true);
    try {
      const path = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body = authMode === "login"
        ? { email: form.email, password: form.password }
        : { role, firstName: form.firstName, lastName: form.lastName, birthDate: form.birthDate, gender: form.gender, email: form.email, password: form.password, username: form.username, shopName: form.shopName, phone: form.phone, city: form.city };
      const { user } = await apiFetch(path, { method: "POST", body: JSON.stringify(body) });
      setShopAnimation(true);
      setTimeout(() => {
        setShopAnimation(false);
        setOpenShop(true);
        setShowAuth(false);
        onAuthenticated(user);
        if (user.role === "vendeur") setSellerDashboard(true);
      }, 3000);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center overflow-hidden bg-black p-5">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[2.5rem] border border-white/10 bg-white/[.05] p-8 text-white">
        <p className="text-xs uppercase tracking-[.4em] text-zinc-500">{role === "client" ? t.client : t.seller}</p>
        <h2 className="mt-4 text-5xl font-black">{authMode === "login" ? t.login : t.register}</h2>
        <div className="mt-8 space-y-4">
          {authMode === "register" && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <input value={form.firstName} onChange={(e) => u("firstName", e.target.value)} placeholder={t.firstName} className="rounded-2xl border border-white/10 bg-black/40 px-5 py-4 outline-none" />
                <input value={form.lastName} onChange={(e) => u("lastName", e.target.value)} placeholder={t.lastName} className="rounded-2xl border border-white/10 bg-black/40 px-5 py-4 outline-none" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40">
                  <label className="absolute left-5 top-3 text-xs font-bold uppercase tracking-[.25em] text-zinc-500">Date de naissance</label>
                  <input value={form.birthDate} onChange={(e) => u("birthDate", e.target.value)} type="date" className="w-full bg-transparent px-5 pb-4 pt-8 text-white outline-none [color-scheme:dark]" />
                </div>
                <select value={form.gender} onChange={(e) => u("gender", e.target.value)} className="rounded-2xl border border-white/10 bg-black/40 px-5 py-4 outline-none"><option value="">{t.gender}</option><option>{t.male}</option><option>{t.female}</option><option>{t.other}</option></select>
              </div>
            </>
          )}
          <input value={form.email} onChange={(e) => u("email", e.target.value)} placeholder={t.email} className="w-full rounded-2xl border border-white/10 bg-black/40 px-5 py-4 outline-none" />
          <input value={form.password} onChange={(e) => u("password", e.target.value)} type="password" placeholder={t.password} className="w-full rounded-2xl border border-white/10 bg-black/40 px-5 py-4 outline-none" />
          {authMode === "register" && (
            <>
              <input value={form.username} onChange={(e) => u("username", e.target.value)} placeholder={t.username} className="w-full rounded-2xl border border-white/10 bg-black/40 px-5 py-4 outline-none" />
              {role === "vendeur" && (
                <>
                  <input value={form.shopName} onChange={(e) => u("shopName", e.target.value)} placeholder={t.shopName} className="w-full rounded-2xl border border-white/10 bg-black/40 px-5 py-4 outline-none" />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <input value={form.phone} onChange={(e) => u("phone", e.target.value)} placeholder={t.phone} className="rounded-2xl border border-white/10 bg-black/40 px-5 py-4 outline-none" />
                    <input value={form.city} onChange={(e) => u("city", e.target.value)} placeholder={t.city} className="rounded-2xl border border-white/10 bg-black/40 px-5 py-4 outline-none" />
                  </div>
                </>
              )}
              <label className="flex gap-3 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm"><input type="checkbox" checked={form.terms} onChange={(e) => u("terms", e.target.checked)} />{t.terms}</label>
              <label className="flex gap-3 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm"><input type="checkbox" checked={form.privacy} onChange={(e) => u("privacy", e.target.checked)} />{t.privacy}</label>
            </>
          )}
          {error && <p className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}
        </div>
        <button onClick={submit} disabled={loading} className="mt-7 w-full rounded-2xl bg-white py-4 text-sm font-black uppercase tracking-[.25em] text-black disabled:opacity-60">{loading ? "..." : authMode === "login" ? t.loginBtn : t.createBtn}</button>
        <button onClick={() => setAuthMode(authMode === "login" ? "register" : "login")} className="mt-5 w-full text-sm text-zinc-400 hover:text-white">{authMode === "login" ? t.noAccount : t.alreadyAccount}</button>
      </div>
    </div>
  );
}

function SellerDashboard({ t, onClose, onCatalogChanged }) {
  const [productForm, setProductForm] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [myProducts, setMyProducts] = useState([]);
  const [p, setP] = useState({ name: "", category: "Homme", price: "", sizes: "", colors: "", description: "", photo: "" });

  const loadMyProducts = async () => {
    try {
      const { products } = await apiFetch("/api/products?mine=1");
      setMyProducts(products);
    } catch {
      setMyProducts([]);
    }
  };

  useEffect(() => {
    loadMyProducts();
  }, []);

  const u = (k, v) => {
    setP((x) => ({ ...x, [k]: v }));
    setMsg("");
    setError("");
  };

  const onPhotoSelected = async (file) => {
    if (!file) return;
    const base64 = await fileToBase64(file);
    u("photo", base64);
  };

  const pub = async () => {
    const req = ["name", "category", "price", "sizes", "colors", "description", "photo"];
    if (req.some((k) => !String(p[k]).trim())) return setMsg("Veuillez remplir toutes les informations du produit.");
    setPublishing(true);
    setError("");
    try {
      await apiFetch("/api/products", {
        method: "POST",
        body: JSON.stringify({
          name: p.name,
          category: p.category,
          price: p.price,
          sizes: p.sizes,
          colors: p.colors,
          description: p.description,
          image: p.photo
        })
      });
      setP({ name: "", category: "Homme", price: "", sizes: "", colors: "", description: "", photo: "" });
      setMsg(t.sellerSuccess + " Il sera visible dans la boutique après validation par l'équipe E‑Market.");
      await loadMyProducts();
      onCatalogChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setPublishing(false);
    }
  };

  const statusLabel = { pending: "En attente de validation", approved: "Validé", rejected: "Refusé" };
  const statusColor = { pending: "bg-yellow-500/20 text-yellow-300", approved: "bg-green-500/20 text-green-300", rejected: "bg-red-500/20 text-red-300" };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 p-5 backdrop-blur-xl">
      <div className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-[2.5rem] border border-white/10 bg-zinc-950 p-7 text-white">
        <div className="mb-8 flex items-center justify-between"><div><p className="text-xs uppercase tracking-[.35em] text-zinc-500">Internal workspace</p><h1 className="mt-2 text-5xl font-black tracking-tight">Control Center</h1></div><button onClick={onClose} className="rounded-full border border-white/10 bg-white/[.05] p-3 text-white transition hover:bg-white hover:text-black"><X size={18} /></button></div>
        <div className="rounded-[2rem] border border-white/10 bg-white/[.04] p-8 md:p-12">
          <p className="text-xs uppercase tracking-[.4em] text-zinc-500">{t.sellerSpace}</p>
          <h2 className="mt-4 max-w-4xl text-5xl font-black md:text-7xl">{t.sellEasy}</h2>
          <p className="mt-5 max-w-2xl text-zinc-400">Ajoutez une photo depuis votre galerie sur téléphone ou depuis vos fichiers sur ordinateur.</p>
          <button onClick={() => { setProductForm(true); window.scrollTo({ top: 500, behavior: 'smooth' }); }} className="mt-8 rounded-full bg-white px-8 py-4 text-sm font-black uppercase tracking-[.2em] text-black">{t.sellNow}</button>
        </div>
        {productForm && (
          <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/[.04] p-7">
            <h2 className="text-4xl font-black">{t.addProduct}</h2>
            <div className="mt-7 grid gap-5">
              <label className="flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-[2rem] border border-dashed border-white/20 bg-white/[.04] p-6 text-center">
                {p.photo ? <img src={p.photo} className="h-52 w-full max-w-md rounded-[1.5rem] object-cover" /> : <><div className="mb-4 grid h-16 w-16 place-items-center rounded-full bg-white text-3xl font-black text-black">+</div><h3 className="text-xl font-black">{t.photoRequired}</h3><p className="mt-2 text-sm text-zinc-400">{t.phoneGallery}</p></>}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => onPhotoSelected(e.target.files?.[0])} />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <input value={p.name} onChange={(e) => u("name", e.target.value)} placeholder={t.productName} className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none" />
                <select value={p.category} onChange={(e) => u("category", e.target.value)} className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none">{categories.filter((c) => c !== "Tous").map((c) => <option key={c}>{c}</option>)}</select>
                <input value={p.price} onChange={(e) => u("price", e.target.value)} placeholder={t.price} className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none" />
                <input value={p.colors} onChange={(e) => u("colors", e.target.value)} placeholder={t.colorsAvailable} className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none" />
                <input value={p.sizes} onChange={(e) => u("sizes", e.target.value)} placeholder={t.sizesAvailable} className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none sm:col-span-2" />
                <textarea value={p.description} onChange={(e) => u("description", e.target.value)} placeholder={t.productDesc} className="min-h-32 rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none sm:col-span-2" />
              </div>
            </div>
            {msg && <p className="mt-4 rounded-2xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-200">{msg}</p>}
            {error && <p className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}
            <button onClick={pub} disabled={publishing} className="mt-5 w-full rounded-2xl bg-white py-4 font-black text-black disabled:opacity-60">{publishing ? "Publication..." : t.publish}</button>
          </div>
        )}
        <div className="mt-8 rounded-[1.5rem] border border-white/10 bg-white/[.04] p-5">
          <div className="mb-5 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[.3em] text-cyan-300">Support vendeur</p>
                <h3 className="mt-2 text-2xl font-black">Contacter l’opérateur</h3>
              </div>
              <div className="rounded-full bg-green-500/20 px-4 py-2 text-xs font-black text-green-300">En ligne</div>
            </div>

            <div className="mt-5 space-y-3">
              <div className="rounded-2xl bg-black/30 p-4 text-sm text-zinc-300">Bonjour E‑Market, j’ai besoin d’aide pour mon produit.</div>
              <div className="ml-auto max-w-md rounded-2xl bg-cyan-500/20 p-4 text-sm text-white">Bonjour, l’équipe E‑Market va vous répondre rapidement.</div>
            </div>

            <div className="mt-5 flex gap-3">
              <input placeholder="Écrire à l’opérateur..." className="flex-1 rounded-2xl border border-white/10 bg-black/40 px-4 py-4 outline-none" />
              <button className="rounded-2xl bg-white px-6 font-black text-black">Envoyer</button>
            </div>
          </div>
          <h3 className="mb-4 text-2xl font-black">Vos produits</h3>
          {myProducts.length === 0 ? <p className="text-zinc-400">{t.sellerEmpty}</p> : myProducts.map((x) => (
            <div key={x.id} className="mb-3 flex gap-4 rounded-2xl border border-white/10 bg-black/30 p-4">
              <img src={x.image_base64} className="h-20 w-20 rounded-xl object-cover" />
              <div className="flex-1">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="font-black">{x.name}</h4>
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${statusColor[x.status]}`}>{statusLabel[x.status]}</span>
                </div>
                <p className="text-sm text-zinc-400">{x.category} • {x.price} FCFA • {x.sizes.join(", ")}</p>
                <p className="text-xs text-zinc-500">{x.colors.join(", ")}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CartModal({ t, cart, setCart, onClose }) {
  const [form, setForm] = useState({ name: "", phone: "", city: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const orderNow = async () => {
    if (!cart.length) return;
    if (!form.name.trim() || !form.phone.trim() || !form.city.trim()) {
      setError("Veuillez renseigner votre nom, téléphone et ville pour la livraison.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const items = cart.map((c) => ({ productId: c.id, quantity: 1, size: c.selectedSize, color: c.selectedColor }));
      const { order } = await apiFetch("/api/orders", {
        method: "POST",
        body: JSON.stringify({ customerName: form.name, phone: form.phone, city: form.city, items })
      });
      const { url } = await apiFetch("/api/checkout", {
        method: "POST",
        body: JSON.stringify({ orderId: order.id })
      });
      setCart([]);
      window.location.href = url;
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 p-5 backdrop-blur-xl">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[2rem] border border-white/10 bg-zinc-950 p-7 text-white">
        <button onClick={onClose} className="float-right rounded-full bg-white p-2 text-black"><X size={16} /></button>
        <h2 className="text-4xl font-black">{t.cart}</h2>
        <p className="mt-3 text-zinc-400">{t.finalPrice}</p>
        <div className="mt-7 grid gap-4">{cart.length === 0 ? <p className="rounded-2xl border border-white/10 bg-white/[.04] p-5 text-zinc-400">{t.emptyCart}</p> : cart.map((p, i) => <div key={i} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[.04] p-4"><img src={p.image} className="h-20 w-20 rounded-xl object-cover" /><div className="flex-1"><h3 className="font-black">{p.name}</h3><p className="text-sm text-zinc-400">{p.price}</p><p className="text-xs text-zinc-500">{t.size}: {p.selectedSize}</p></div><button onClick={() => setCart((prev) => prev.filter((_, idx) => idx !== i))} className="rounded-full border border-white/10 px-4 py-2 text-sm">Retirer</button></div>)}</div>
        {cart.length > 0 && (
          <div className="mt-7 rounded-2xl border border-white/10 bg-white/[.04] p-5">
            <h3 className="mb-4 text-xl font-black">{t.order}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nom complet" className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none" />
              <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder={t.phone} className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none" />
              <input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} placeholder={t.city} className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none" />
              <select className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none"><option>Paiement sécurisé par carte (Stripe)</option></select>
            </div>
            {error && <p className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}
            <button onClick={orderNow} disabled={loading} className="mt-4 w-full rounded-2xl bg-white py-4 font-black text-black disabled:opacity-60">{loading ? "Redirection vers le paiement..." : t.orderNow}</button>
          </div>
        )}
      </div>
    </div>
  );
}

function FavoritesModal({ t, products, favorites, onClose }) {
  const fav = products.filter((p) => favorites.includes(p.id));
  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 p-5 backdrop-blur-xl">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[2rem] border border-white/10 bg-zinc-950 p-7 text-white">
        <button onClick={onClose} className="float-right rounded-full bg-white p-2 text-black"><X size={16} /></button>
        <h2 className="text-4xl font-black">{t.favorites}</h2>
        <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{fav.length === 0 ? <p className="text-zinc-400">{t.emptyFav}</p> : fav.map((p) => <div key={p.id} className="rounded-[1.5rem] border border-white/10 bg-white/[.04] p-4"><img src={p.image} className="mb-4 h-44 w-full rounded-[1rem] object-cover" /><h3 className="font-black">{p.name}</h3><p className="text-zinc-400">{p.price}</p></div>)}</div>
      </div>
    </div>
  );
}

function OrdersModal({ onClose }) {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/orders")
      .then(({ orders }) => setOrders(orders))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const statusLabel = { pending: "En attente de paiement", paid: "Payée", cancelled: "Annulée" };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 p-5 backdrop-blur-xl">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[2rem] border border-white/10 bg-zinc-950 p-7 text-white">
        <button onClick={onClose} className="float-right rounded-full bg-white p-2 text-black"><X size={16} /></button>
        <h2 className="text-4xl font-black">Mes commandes</h2>
        {loading && <p className="mt-6 text-zinc-400">Chargement...</p>}
        {error && <p className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}
        {!loading && orders.length === 0 && <p className="mt-6 text-zinc-400">Vous n'avez pas encore de commande.</p>}
        <div className="mt-7 grid gap-4">
          {orders.map((o) => (
            <div key={o.id} className="rounded-2xl border border-white/10 bg-white/[.04] p-5">
              <div className="flex items-center justify-between gap-4">
                <h3 className="font-black">Commande #{o.id}</h3>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black">{statusLabel[o.status]}</span>
              </div>
              <p className="mt-2 text-sm text-zinc-400">{new Date(o.created_at).toLocaleString("fr-FR")} • {o.total} FCFA</p>
              <div className="mt-3 space-y-1">
                {(o.items || []).map((it) => (
                  <p key={it.id} className="text-sm text-zinc-300">{it.quantity} × {it.name} {it.size ? `(${it.size})` : ""} — {it.price} FCFA</p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProfileModal({ user, onClose }) {
  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 p-5 backdrop-blur-xl">
      <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-zinc-950 p-7 text-white">
        <button onClick={onClose} className="float-right rounded-full bg-white p-2 text-black"><X size={16} /></button>
        <h2 className="text-4xl font-black">Mon profil</h2>
        <div className="mt-7 space-y-3 text-sm">
          <p className="text-zinc-400">Nom<br /><span className="text-lg font-black text-white">{user.firstName} {user.lastName}</span></p>
          <p className="text-zinc-400">Email<br /><span className="text-lg font-black text-white">{user.email}</span></p>
          <p className="text-zinc-400">Nom d'utilisateur<br /><span className="text-lg font-black text-white">{user.username}</span></p>
          <p className="text-zinc-400">Espace<br /><span className="text-lg font-black text-white">{user.role === "vendeur" ? `Vendeur — ${user.shopName}` : "Client"}</span></p>
          {user.role === "vendeur" && (
            <>
              <p className="text-zinc-400">Téléphone<br /><span className="text-lg font-black text-white">{user.phone}</span></p>
              <p className="text-zinc-400">Ville<br /><span className="text-lg font-black text-white">{user.city}</span></p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminLogin({ onSuccess, onClose }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const login = async () => {
    setLoading(true);
    setError("");
    try {
      await apiFetch("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ email, password, secretKey })
      });
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1002] flex items-center justify-center bg-black/90 p-5 backdrop-blur-xl">
      <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-zinc-950 p-7 text-white">
        <button onClick={onClose} className="float-right rounded-full bg-white p-2 text-black"><X size={16} /></button>
        <p className="text-xs uppercase tracking-[.35em] text-zinc-500">Accès sécurisé</p>
        <h2 className="mt-3 text-4xl font-black">Control Center</h2>
        <p className="mt-3 text-sm text-zinc-400">Accès sécurisé réservé au système interne E‑Market.</p>
        <div className="mt-7 grid gap-4"><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email admin" className="rounded-2xl border border-white/10 bg-black/40 px-5 py-4 outline-none" /><input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Mot de passe admin" className="rounded-2xl border border-white/10 bg-black/40 px-5 py-4 outline-none" /><input value={secretKey} onChange={(e) => setSecretKey(e.target.value)} type="password" placeholder="Clé d’accès secrète" className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 px-5 py-4 outline-none" /></div>
        {error && <p className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}
        <button type="button" onClick={login} disabled={loading} className="mt-6 w-full rounded-2xl bg-white py-4 font-black text-black transition hover:scale-[1.02] disabled:opacity-60">{loading ? "..." : "Entrer dans Control Center"}</button>
      </div>
    </div>
  );
}

function AdminDashboard({ onClose, onCatalogChanged }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [sellerProducts, setSellerProducts] = useState([]);
  const [productsError, setProductsError] = useState("");
  const validCount = sellerProducts.filter((p) => p.status === "approved").length;

  const loadProducts = async () => {
    try {
      const { products } = await apiFetch("/api/products?forAdmin=1");
      setSellerProducts(products);
      setProductsError("");
    } catch (err) {
      setProductsError(err.message);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const reviewProduct = async (id, status) => {
    try {
      await apiFetch(`/api/products/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      await loadProducts();
      onCatalogChanged?.();
    } catch (err) {
      setProductsError(err.message);
    }
  };

  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState(() => JSON.parse(localStorage.getItem("emarketPendingUpdate") || "null"));
  const [siteVersion, setSiteVersion] = useState(() => localStorage.getItem("emarketSiteVersion") || "v1");
  const [versionHistory, setVersionHistory] = useState(() => JSON.parse(localStorage.getItem("emarketVersionHistory") || "[]"));
  const [aiMessages, setAiMessages] = useState(() => JSON.parse(localStorage.getItem("emarketAiMessages") || JSON.stringify([
    { role: "assistant", text: "Bonjour, je suis l’IA ChatGPT opérateur E‑Market. Donne-moi tes instructions, et quand les informations sont suffisantes je prépare une mise à jour à confirmer." }
  ])));
  const [promoForm, setPromoForm] = useState({ event: "Tabaski", oldPrice: "", newPrice: "", startsAt: "", message: "" });
  const [promoPlans, setPromoPlans] = useState(() => JSON.parse(localStorage.getItem("emarketPromoPlans") || "[]"));

  const saveAiMessages = (messages) => {
    setAiMessages(messages);
    localStorage.setItem("emarketAiMessages", JSON.stringify(messages));
  };

  const nextVersion = (v) => {
    const clean = String(v || "v1").replace("v", "");
    const [majorRaw, minorRaw] = clean.split(".");
    const major = Number(majorRaw) || 1;
    const minor = minorRaw === undefined ? 0 : Number(minorRaw);
    if (minor >= 9) return `v${major + 1}`;
    return `v${major}.${minor + 1}`;
  };

  const sendAiInstruction = async () => {
    if (!aiInput.trim()) return;
    const userMsg = { role: "user", text: aiInput.trim() };
    const baseMessages = [...aiMessages, userMsg];
    saveAiMessages(baseMessages);
    setAiInput("");
    setAiLoading(true);
    const fallbackText = `Mode démo ChatGPT : j’ai analysé tes instructions. Mise à jour proposée : ${userMsg.text}. Vérifie les détails puis clique sur “Mettre à jour le site” pour créer la prochaine version.`;
    try {
      const res = await fetch("/api/admin-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: userMsg.text, version: siteVersion, products: sellerProducts.length })
      });
      const data = await res.json().catch(() => ({}));
      const reply = data.reply || fallbackText;
      saveAiMessages([...baseMessages, { role: "assistant", text: reply }]);
      const update = { id: Date.now(), instruction: userMsg.text, summary: reply, ready: true, createdAt: new Date().toLocaleString(), targetVersion: nextVersion(siteVersion) };
      setPendingUpdate(update);
      localStorage.setItem("emarketPendingUpdate", JSON.stringify(update));
    } catch {
      saveAiMessages([...baseMessages, { role: "assistant", text: fallbackText }]);
      const update = { id: Date.now(), instruction: userMsg.text, summary: fallbackText, ready: true, createdAt: new Date().toLocaleString(), targetVersion: nextVersion(siteVersion) };
      setPendingUpdate(update);
      localStorage.setItem("emarketPendingUpdate", JSON.stringify(update));
    } finally {
      setAiLoading(false);
    }
  };

  const applyPendingUpdate = () => {
    if (!pendingUpdate) return;
    const newVersion = pendingUpdate.targetVersion || nextVersion(siteVersion);
    const entry = { ...pendingUpdate, appliedAt: new Date().toLocaleString(), version: newVersion };
    const history = [entry, ...versionHistory];
    setSiteVersion(newVersion);
    setVersionHistory(history);
    setPendingUpdate(null);
    localStorage.setItem("emarketSiteVersion", newVersion);
    localStorage.setItem("emarketVersionHistory", JSON.stringify(history));
    localStorage.removeItem("emarketPendingUpdate");
    saveAiMessages([...aiMessages, { role: "assistant", text: `Mise à jour appliquée avec succès. Version actuelle : ${newVersion}.` }]);
  };

  const addPromoPlan = () => {
    if (!promoForm.oldPrice || !promoForm.newPrice) return;
    const startsAt = promoForm.startsAt || new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const plan = {
      id: Date.now(),
      ...promoForm,
      startsAt,
      confirmAt: new Date(new Date(startsAt).getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      status: "En attente de confirmation opérateur"
    };
    const plans = [plan, ...promoPlans];
    setPromoPlans(plans);
    localStorage.setItem("emarketPromoPlans", JSON.stringify(plans));
    setPromoForm({ event: "Tabaski", oldPrice: "", newPrice: "", startsAt: "", message: "" });
  };

  const updatePromoStatus = (id, status) => {
    const plans = promoPlans.map((p) => p.id === id ? { ...p, status } : p);
    setPromoPlans(plans);
    localStorage.setItem("emarketPromoPlans", JSON.stringify(plans));
  };

  return (
    <div className="fixed inset-0 z-[1001] bg-[#050505] text-white">
      <div className="flex h-screen w-full overflow-hidden">
        <aside className="hidden w-[280px] border-r border-white/10 bg-black/70 p-6 lg:block">
          <p className="text-xs uppercase tracking-[.4em] text-zinc-500">E‑Market</p>
          <h2 className="mt-3 text-3xl font-black">Control Center</h2>

          <div className="mt-10 space-y-3">
            <button onClick={() => setActiveTab("overview")} className={`w-full rounded-2xl px-5 py-4 text-left font-bold transition ${activeTab === "overview" ? "bg-white text-black" : "bg-white/[.04] text-zinc-300"}`}>Overview</button>
            <button onClick={() => setActiveTab("products")} className={`w-full rounded-2xl px-5 py-4 text-left font-bold transition ${activeTab === "products" ? "bg-white text-black" : "bg-white/[.04] text-zinc-300"}`}>Products</button>
            <button onClick={() => setActiveTab("analytics")} className={`w-full rounded-2xl px-5 py-4 text-left font-bold transition ${activeTab === "analytics" ? "bg-white text-black" : "bg-white/[.04] text-zinc-300"}`}>Analytics</button>
            <button onClick={() => setActiveTab("messages")} className={`w-full rounded-2xl px-5 py-4 text-left font-bold transition ${activeTab === "messages" ? "bg-white text-black" : "bg-white/[.04] text-zinc-300"}`}>Messages</button>
            <button onClick={() => setActiveTab("ai")} className={`w-full rounded-2xl px-5 py-4 text-left font-bold transition ${activeTab === "ai" ? "bg-white text-black" : "bg-white/[.04] text-zinc-300"}`}>ChatGPT IA</button>
            <button onClick={() => setActiveTab("promos")} className={`w-full rounded-2xl px-5 py-4 text-left font-bold transition ${activeTab === "promos" ? "bg-white text-black" : "bg-white/[.04] text-zinc-300"}`}>Promos</button>
            <button onClick={() => setActiveTab("versions")} className={`w-full rounded-2xl px-5 py-4 text-left font-bold transition ${activeTab === "versions" ? "bg-white text-black" : "bg-white/[.04] text-zinc-300"}`}>Versions</button>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-6 lg:p-10">
          <div className="mb-10 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[.35em] text-zinc-500">Internal workspace</p>
              <h1 className="mt-2 text-5xl font-black">Control Center</h1>
            </div>

            <button onClick={onClose} className="rounded-full border border-white/10 bg-white/[.05] p-3 transition hover:bg-white hover:text-black">
              <X size={18} />
            </button>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <div className="rounded-[2rem] border border-white/10 bg-white/[.04] p-6">
              <p className="text-sm text-zinc-400">Produits envoyés</p>
              <h3 className="mt-3 text-6xl font-black">{sellerProducts.length}</h3>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/[.04] p-6">
              <p className="text-sm text-zinc-400">Produits validés</p>
              <h3 className="mt-3 text-6xl font-black">{validCount}</h3>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/[.04] p-6">
              <p className="text-sm text-zinc-400">IA opérateur</p>
              <div className="mt-4 flex items-center gap-3 text-green-300">
                <Bot size={20} />
                <span className="font-black">{siteVersion}</span>
              </div>
            </div>
          </div>

          {activeTab === "messages" && (
            <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/[.04] p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[.3em] text-zinc-500">Support center</p>
                  <h3 className="mt-2 text-3xl font-black">Messages & Assistance</h3>
                </div>
                <div className="rounded-full bg-green-500/20 px-4 py-2 text-xs font-black text-green-300">En ligne</div>
              </div>

              <div className="mt-8 grid gap-5 lg:grid-cols-2">
                <div className="rounded-[2rem] border border-white/10 bg-black/30 p-5">
                  <p className="text-sm font-black text-white">Service client</p>
                  <div className="mt-5 space-y-3">
                    <div className="rounded-2xl bg-white/[.04] p-4">
                      <p className="text-sm font-black">Client #204</p>
                      <p className="mt-1 text-sm text-zinc-400">Bonjour, où est ma commande ?</p>
                    </div>
                  </div>
                  <input placeholder="Répondre au client..." className="mt-5 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-4 outline-none" />
                </div>

                <div className="rounded-[2rem] border border-white/10 bg-black/30 p-5">
                  <p className="text-sm font-black text-white">Messages vendeurs</p>
                  <div className="mt-5 space-y-3">
                    <div className="rounded-2xl bg-white/[.04] p-4">
                      <p className="text-sm font-black">Boutique Urban Wear</p>
                      <p className="mt-1 text-sm text-zinc-400">Je veux modifier le prix d’un produit.</p>
                    </div>
                  </div>
                  <input placeholder="Répondre au vendeur..." className="mt-5 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-4 outline-none" />
                </div>
              </div>
            </div>
          )}

{activeTab === "ai" && (
            <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/[.04] p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[.3em] text-zinc-500">ChatGPT privé opérateur</p>
                  <h3 className="mt-2 text-3xl font-black">IA opérateur • Mise à jour intelligente</h3>
                  <p className="mt-2 text-sm text-zinc-400">Donne tes instructions. Quand l’IA a assez d’informations, elle prépare une mise à jour que tu confirmes.</p>
                </div>
                <div className="flex items-center gap-3 rounded-full bg-green-500/10 px-4 py-2 text-green-300">
                  <Bot size={18} /> Version actuelle : {siteVersion}
                </div>
              </div>

              <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_.9fr]">
                <div className="rounded-[2rem] border border-white/10 bg-black/40 p-6">
                  <div className="max-h-[420px] space-y-4 overflow-y-auto pr-2">
                    {aiMessages.map((m, i) => (
                      <div key={i} className={`${m.role === "user" ? "ml-auto bg-white text-black" : "bg-white/[.05] text-zinc-200"} max-w-2xl rounded-2xl p-4 text-sm`}>
                        <p className="mb-1 text-[10px] font-black uppercase tracking-[.25em] opacity-60">{m.role === "user" ? "Opérateur" : "ChatGPT"}</p>
                        {m.text}
                      </div>
                    ))}
                    {aiLoading && <div className="max-w-xl rounded-2xl bg-green-500/10 p-4 text-sm text-green-200">ChatGPT réfléchit...</div>}
                  </div>
                  <div className="mt-6 flex flex-col gap-3 md:flex-row">
                    <textarea value={aiInput} onChange={(e) => setAiInput(e.target.value)} placeholder="Exemple : ajoute une promo Tabaski, améliore le panier, vérifie les bugs vendeur..." className="min-h-24 flex-1 rounded-2xl border border-white/10 bg-black/50 px-5 py-4 outline-none" />
                    <button onClick={sendAiInstruction} className="rounded-2xl bg-white px-6 font-black text-black">Envoyer</button>
                  </div>
                </div>

                <div className="rounded-[2rem] border border-white/10 bg-black/30 p-6">
                  <p className="text-xs uppercase tracking-[.3em] text-zinc-500">Mise à jour proposée</p>
                  {pendingUpdate ? (
                    <div className="mt-4">
                      <h4 className="text-2xl font-black">Prête pour {pendingUpdate.targetVersion}</h4>
                      <p className="mt-3 text-sm text-zinc-400">{pendingUpdate.summary}</p>
                      <button onClick={applyPendingUpdate} className="mt-6 w-full rounded-2xl bg-green-500 py-4 font-black text-white">Mettre à jour le site</button>
                      <p className="mt-3 text-xs text-zinc-500">L’opérateur garde toujours le contrôle avant chaque mise à jour.</p>
                    </div>
                  ) : (
                    <p className="mt-4 text-zinc-400">Aucune mise à jour en attente. Donne une instruction à l’IA.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "promos" && (
            <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/[.04] p-6">
              <p className="text-xs uppercase tracking-[.3em] text-zinc-500">Promotions planifiées</p>
              <h3 className="mt-2 text-3xl font-black">Tabaski • Ramadan • Black Friday</h3>
              <p className="mt-2 text-sm text-zinc-400">L’IA prépare les retouches, puis l’opérateur confirme 2 jours avant la mise en place. Tu choisis le prix barré et le nouveau prix.</p>
              <div className="mt-6 grid gap-4 md:grid-cols-5">
                <select value={promoForm.event} onChange={(e) => setPromoForm({ ...promoForm, event: e.target.value })} className="rounded-2xl border border-white/10 bg-black/40 px-4 py-4 outline-none">
                  <option>Tabaski</option><option>Ramadan</option><option>Black Friday</option><option>Promo bi-vendredi</option><option>Promo spéciale</option>
                </select>
                <input value={promoForm.oldPrice} onChange={(e) => setPromoForm({ ...promoForm, oldPrice: e.target.value })} placeholder="Prix barré" className="rounded-2xl border border-white/10 bg-black/40 px-4 py-4 outline-none" />
                <input value={promoForm.newPrice} onChange={(e) => setPromoForm({ ...promoForm, newPrice: e.target.value })} placeholder="Nouveau prix" className="rounded-2xl border border-white/10 bg-black/40 px-4 py-4 outline-none" />
                <input value={promoForm.startsAt} onChange={(e) => setPromoForm({ ...promoForm, startsAt: e.target.value })} type="date" className="rounded-2xl border border-white/10 bg-black/40 px-4 py-4 outline-none [color-scheme:dark]" />
                <button onClick={addPromoPlan} className="rounded-2xl bg-white px-5 font-black text-black">Créer</button>
              </div>
              <textarea value={promoForm.message} onChange={(e) => setPromoForm({ ...promoForm, message: e.target.value })} placeholder="Message promo affiché aux clients..." className="mt-4 min-h-24 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-4 outline-none" />
              <div className="mt-6 grid gap-4">
                {promoPlans.length === 0 ? <p className="text-zinc-400">Aucune promo planifiée.</p> : promoPlans.map((plan) => (
                  <div key={plan.id} className="rounded-2xl border border-white/10 bg-black/30 p-5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h4 className="text-xl font-black">{plan.event}</h4>
                        <p className="mt-1 text-sm text-zinc-400">Confirmation opérateur le {plan.confirmAt} • Mise en place le {plan.startsAt}</p>
                        <p className="mt-2 text-sm"><span className="text-zinc-500 line-through">{plan.oldPrice} FCFA</span> <span className="ml-3 font-black text-green-300">{plan.newPrice} FCFA</span></p>
                        {plan.message && <p className="mt-2 text-sm text-zinc-400">{plan.message}</p>}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => updatePromoStatus(plan.id, "Confirmée")} className="rounded-full bg-green-500 px-4 py-2 text-sm font-black">Confirmer</button>
                        <button onClick={() => updatePromoStatus(plan.id, "Refusée")} className="rounded-full bg-red-500 px-4 py-2 text-sm font-black">Refuser</button>
                      </div>
                    </div>
                    <p className="mt-3 text-xs uppercase tracking-[.25em] text-zinc-500">{plan.status}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "versions" && (
            <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/[.04] p-6">
              <p className="text-xs uppercase tracking-[.3em] text-zinc-500">Historique</p>
              <h3 className="mt-2 text-3xl font-black">Versions du site • {siteVersion}</h3>
              <div className="mt-6 grid gap-4">
                {versionHistory.length === 0 ? <p className="text-zinc-400">Aucune mise à jour appliquée. Version initiale : v1.</p> : versionHistory.map((v) => (
                  <div key={v.id} className="rounded-2xl border border-white/10 bg-black/30 p-5">
                    <div className="flex items-center justify-between gap-4">
                      <h4 className="text-xl font-black">{v.version}</h4>
                      <span className="text-xs text-zinc-500">{v.appliedAt}</span>
                    </div>
                    <p className="mt-3 text-sm text-zinc-400">{v.instruction}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

<div className="mt-10 rounded-[2rem] border border-white/10 bg-white/[.04] p-6">
            <h3 className="text-3xl font-black">Produits à vérifier</h3>
            {productsError && <p className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{productsError}</p>}

            {sellerProducts.length === 0 ? (
              <p className="mt-5 text-zinc-400">Aucun produit envoyé pour le moment.</p>
            ) : (
              <div className="mt-6 grid gap-5">
                {sellerProducts.map((prod) => (
                  <div key={prod.id} className="rounded-[2rem] border border-white/10 bg-black/30 p-5">
                    <div className="flex flex-col gap-5 md:flex-row">
                      <img src={prod.image_base64} className="h-52 w-full rounded-[1.5rem] object-cover md:w-72" />

                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-xs uppercase tracking-[.3em] text-zinc-500">{prod.category} • {prod.shop_name}</p>
                            <h4 className="mt-2 text-3xl font-black">{prod.name}</h4>
                          </div>

                          <span className={`rounded-full px-4 py-2 text-xs font-black ${prod.status === "approved" ? "bg-green-500/20 text-green-300" : prod.status === "rejected" ? "bg-red-500/20 text-red-300" : "bg-yellow-500/20 text-yellow-300"}`}>
                            {prod.status === "approved" ? "Validé" : prod.status === "rejected" ? "Refusé" : "En attente"}
                          </span>
                        </div>

                        <p className="mt-4 text-zinc-400">{prod.description}</p>
                        <p className="mt-2 text-sm text-zinc-500">{prod.price} FCFA • {prod.sizes.join(", ")} • {prod.colors.join(", ")}</p>

                        <div className="mt-6 flex flex-wrap gap-3">
                          <button onClick={() => reviewProduct(prod.id, "approved")} disabled={prod.status === "approved"} className="rounded-full bg-green-500 px-6 py-3 text-sm font-black text-white disabled:opacity-40">
                            Valider
                          </button>

                          <button onClick={() => reviewProduct(prod.id, "rejected")} disabled={prod.status === "rejected"} className="rounded-full bg-red-500 px-6 py-3 text-sm font-black text-white disabled:opacity-40">
                            Refuser
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function EMarketSingleFilePreview() {
  const [language, setLanguage] = useState("FR");
  const t = text[language];
  const [openShop, setOpenShop] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [shopAnimation, setShopAnimation] = useState(false);
  const [role, setRole] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [activeCategory, setActiveCategory] = useState("Tous");
  const [cart, setCart] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [showOrders, setShowOrders] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [comingSoon, setComingSoon] = useState("");
  const [sellerDashboard, setSellerDashboard] = useState(false);
  const [adminLogin, setAdminLogin] = useState(false);
  const [operatorDashboard, setOperatorDashboard] = useState(false);
  const [logoClickCount, setLogoClickCount] = useState(0);
  const [rawProducts, setRawProducts] = useState([]);
  const [notice, setNotice] = useState("");

  const loadCatalog = () => {
    apiFetch("/api/products").then(({ products }) => setRawProducts(products)).catch(() => setRawProducts([]));
  };

  useEffect(() => {
    loadCatalog();
    apiFetch("/api/auth/me")
      .then(({ user }) => {
        setCurrentUser(user);
        setRole(user.role);
        setOpenShop(true);
      })
      .catch(() => {})
      .finally(() => setCheckingSession(false));

    const params = new URLSearchParams(window.location.search);
    if (params.get("paid")) {
      setNotice("Paiement reçu, merci pour votre commande !");
      setCart([]);
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("cancelled")) {
      setNotice("Le paiement a été annulé.");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setFavorites([]);
      return;
    }
    apiFetch("/api/favorites").then(({ favorites }) => setFavorites(favorites)).catch(() => {});
  }, [currentUser]);

  const allProducts = useMemo(
    () =>
      rawProducts.map((p) => ({
        id: p.id,
        name: p.name,
        price: `${p.price} FCFA`,
        category: p.category,
        sizes: p.sizes,
        colors: p.colors.map(colorToHex),
        image: p.image_base64,
        tag: "Vendeur"
      })),
    [rawProducts]
  );
  const categoryFiltered = useMemo(() => activeCategory === "Tous" ? allProducts : allProducts.filter((p) => p.category === activeCategory), [activeCategory, allProducts]);
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return categoryFiltered;
    const q = searchQuery.trim().toLowerCase();
    return categoryFiltered.filter((p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
  }, [categoryFiltered, searchQuery]);

  const toggleFavorite = async (id) => {
    if (!currentUser) return;
    setFavorites((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    try {
      await apiFetch("/api/favorites", { method: "POST", body: JSON.stringify({ productId: id }) });
    } catch {
      apiFetch("/api/favorites").then(({ favorites }) => setFavorites(favorites)).catch(() => {});
    }
  };
  const addToCart = (product, size, color) => setCart((prev) => [...prev, { ...product, selectedSize: size, selectedColor: color }]);
  const openAdminHidden = () => {
    const next = logoClickCount + 1;
    setLogoClickCount(next);
    if (next >= 5) {
      setAdminLogin(true);
      setLogoClickCount(0);
    }
  };

  const handleLogout = async () => {
    await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setCurrentUser(null);
    setRole(null);
    setOpenShop(false);
    setCart([]);
    setFavorites([]);
  };
  const handleSwitchAccount = async () => {
    await handleLogout();
    setShowAuth(true);
  };

  return (
    <div className="min-h-screen overflow-hidden bg-black text-white">
      <AnimatePresence>{shopAnimation && <ShopOpeningAnimation />}</AnimatePresence>

      {!checkingSession && !openShop && !showAuth && (
        <section className="fixed inset-0 z-[999] flex items-center justify-center bg-black px-5 text-center">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,.14),transparent_35%,black_70%)]" />
          <div className="relative z-10 max-w-3xl">
            <div className="mx-auto mb-7 grid h-24 w-24 place-items-center rounded-full border border-white/15 bg-white/[.05]"><ShoppingBag size={38} /></div>
            <div className="mb-6 flex justify-center gap-3">{["FR", "EN"].map((lang) => <button key={lang} onClick={() => setLanguage(lang)} className={`rounded-full border px-4 py-2 text-xs font-black ${language === lang ? "bg-white text-black" : "border-white/15"}`}>{lang}</button>)}</div>
            <p className="mb-4 text-xs font-bold uppercase tracking-[.55em] text-zinc-400">{t.chooseSpace}</p>
            <h1 className="text-6xl font-black tracking-[-.08em] md:text-8xl">E MARKET</h1>
            <p className="mx-auto mt-5 max-w-xl text-zinc-400">{t.intro}</p>
            <button onClick={() => setShowAuth(true)} className="mt-9 rounded-full bg-white px-8 py-4 text-sm font-black uppercase tracking-[.25em] text-black">{t.enter}</button>
          </div>
        </section>
      )}

      <header className="fixed left-0 right-0 top-0 z-50 border-b border-white/10 bg-black/55 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <h2 onClick={openAdminHidden} className="cursor-pointer text-2xl font-black tracking-tighter">E Market</h2>
          <nav className="hidden items-center gap-7 text-sm text-zinc-300 md:flex">{categories.map((c) => <button key={c} onClick={() => setActiveCategory(c)} className={activeCategory === c ? "text-white" : "hover:text-white"}>{c}</button>)}</nav>
          <div className="flex items-center gap-3">
            <div className="relative">
              <button onClick={() => setShowSearch((v) => !v)} className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/[.04]"><Search size={18} /></button>
              {showSearch && (
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher un produit..."
                  className="absolute right-0 top-14 w-64 rounded-2xl border border-white/10 bg-zinc-950 px-4 py-3 text-sm text-white outline-none"
                />
              )}
            </div>
            <button onClick={() => setShowFavorites(true)} className="relative grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/[.04]"><Heart size={18} /><span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-white text-[10px] text-black">{favorites.length}</span></button>
            <div className="relative group">
              <button onClick={() => (currentUser ? (currentUser.role === "vendeur" ? setSellerDashboard(true) : setShowProfile(true)) : setShowAuth(true))} className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/[.04]"><User size={18} /></button>
              {currentUser && (
                <div className="absolute right-0 top-14 hidden w-72 rounded-[2rem] border border-black/10 bg-white p-5 text-black shadow-2xl group-hover:block">
                  <div className="mb-5 flex items-center justify-center"><button onClick={() => setShowProfile(true)} className="rounded-xl border border-black px-6 py-3 text-sm font-black uppercase tracking-[.15em]">{currentUser.firstName}</button></div>
                  <div className="space-y-1 border-t border-black/10 pt-4">
                    <button onClick={() => setShowProfile(true)} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm hover:bg-zinc-100"><User size={18} /> Mon Profil</button>
                    <button onClick={() => setShowOrders(true)} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm hover:bg-zinc-100"><ShoppingBag size={18} /> Mes Commandes</button>
                    <button onClick={() => setShowFavorites(true)} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm hover:bg-zinc-100"><Heart size={18} /> Mes Favoris</button>
                    <button onClick={() => setComingSoon("Service Client")} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm hover:bg-zinc-100"><Bot size={18} /> Service Client</button>
                    <button onClick={() => setComingSoon("Mes Points Bonus")} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm hover:bg-zinc-100"><Star size={18} /> Mes Points Bonus</button>
                    <button onClick={() => setComingSoon("Plus de services")} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm hover:bg-zinc-100"><ShieldCheck size={18} /> Plus de services</button>
                  </div>
                  <div className="mt-4 border-t border-black/10 pt-4">
                    <button onClick={handleSwitchAccount} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm hover:bg-zinc-100">Changer de compte</button>
                    <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm text-red-500 hover:bg-red-50">Se déconnecter</button>
                  </div>
                </div>
              )}
            </div>
            <button onClick={() => setShowCart(true)} className="relative grid h-11 w-11 place-items-center rounded-full bg-white text-black"><ShoppingBag size={18} /><span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-black text-[10px] text-white">{cart.length}</span></button>
            <button onClick={() => setShowMobileNav((v) => !v)} className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/[.04] md:hidden"><Menu size={18} /></button>
          </div>
        </div>
        {showMobileNav && (
          <div className="border-t border-white/10 bg-black/95 p-4 md:hidden">
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <button key={c} onClick={() => { setActiveCategory(c); setShowMobileNav(false); }} className={`rounded-full border px-4 py-2 text-xs font-bold ${activeCategory === c ? "bg-white text-black" : "border-white/10 text-zinc-300"}`}>{c}</button>
              ))}
            </div>
          </div>
        )}
      </header>

      {showAuth && !role && (
        <div className="fixed inset-0 z-[998] flex items-center justify-center bg-black/90 p-5 backdrop-blur-2xl">
          <div className="grid w-full max-w-5xl gap-6 md:grid-cols-2">
            <button onClick={() => setRole("client")} className="rounded-[2.5rem] border border-white/10 bg-white/[.04] p-8 text-left"><p className="text-xs uppercase tracking-[.35em] text-zinc-500">{t.buy}</p><h2 className="mt-2 text-4xl font-black">{t.client}</h2><p className="mt-4 text-zinc-400">{t.clientText}</p></button>
            <button onClick={() => setRole("vendeur")} className="rounded-[2.5rem] border border-white/10 bg-white/[.04] p-8 text-left"><p className="text-xs uppercase tracking-[.35em] text-zinc-500">{t.sell}</p><h2 className="mt-2 text-4xl font-black">{t.seller}</h2><p className="mt-4 text-zinc-400">{t.sellerText}</p></button>
          </div>
        </div>
      )}

      {showAuth && role && <AuthModal t={t} role={role} setOpenShop={setOpenShop} setShowAuth={setShowAuth} setSellerDashboard={setSellerDashboard} setShopAnimation={setShopAnimation} onAuthenticated={(user) => { setCurrentUser(user); loadCatalog(); }} />}
      {sellerDashboard && <SellerDashboard t={t} onClose={() => setSellerDashboard(false)} onCatalogChanged={loadCatalog} />}
      {showCart && <CartModal t={t} cart={cart} setCart={setCart} onClose={() => setShowCart(false)} />}
      {showFavorites && <FavoritesModal t={t} products={allProducts} favorites={favorites} onClose={() => setShowFavorites(false)} />}
      {showOrders && <OrdersModal onClose={() => setShowOrders(false)} />}
      {showProfile && currentUser && <ProfileModal user={currentUser} onClose={() => setShowProfile(false)} />}
      {adminLogin && <AdminLogin onSuccess={() => { setAdminLogin(false); setOperatorDashboard(true); }} onClose={() => setAdminLogin(false)} />}
      {operatorDashboard && <AdminDashboard onClose={() => setOperatorDashboard(false)} onCatalogChanged={loadCatalog} />}
      {notice && (
        <div className="fixed left-1/2 top-24 z-[1100] w-full max-w-md -translate-x-1/2 rounded-2xl border border-white/10 bg-zinc-950 p-4 text-center text-sm shadow-2xl">
          <p>{notice}</p>
          <button onClick={() => setNotice("")} className="mt-2 text-xs text-zinc-400 underline">Fermer</button>
        </div>
      )}
      {comingSoon && (
        <div className="fixed left-1/2 top-24 z-[1100] w-full max-w-sm -translate-x-1/2 rounded-2xl border border-white/10 bg-zinc-950 p-4 text-center text-sm shadow-2xl">
          <p>{comingSoon} : bientôt disponible.</p>
          <button onClick={() => setComingSoon("")} className="mt-2 text-xs text-zinc-400 underline">Fermer</button>
        </div>
      )}

      <main className="relative min-h-screen pt-28">
        <section className="relative mx-auto max-w-7xl px-5 pb-16 pt-10">
          <div className="mb-10 rounded-[2.5rem] border border-white/10 bg-white/[.04] p-7 shadow-2xl backdrop-blur-xl md:p-12">
            <div className="max-w-3xl"><div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-4 py-2 text-xs font-bold uppercase tracking-[.25em] text-zinc-300"><Sparkles size={14} /> {t.heroBadge}</div><h1 className="text-5xl font-black tracking-[-.07em] md:text-7xl">{t.heroTitle}</h1><p className="mt-5 max-w-2xl text-zinc-400">{t.heroText}</p></div>
          </div>
          <div className="mb-9 flex gap-3 overflow-x-auto pb-2">{categories.map((c) => <button key={c} onClick={() => setActiveCategory(c)} className={`shrink-0 rounded-full border px-5 py-3 text-sm font-bold ${activeCategory === c ? "bg-white text-black" : "border-white/10 bg-white/[.04] text-zinc-300"}`}>{c}</button>)}</div>
          {filteredProducts.length === 0 ? <div className="rounded-[2rem] border border-dashed border-white/10 bg-white/[.03] p-16 text-center"><div className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-full border border-white/10 bg-white/[.05] text-4xl font-black text-zinc-400">0</div><h3 className="text-3xl font-black">{t.heroTitle}</h3><p className="mt-4 text-zinc-500">{t.heroText}</p></div> : <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{filteredProducts.map((p) => <ProductCard key={p.id} product={p} t={t} favorites={favorites} onFavorite={toggleFavorite} onAdd={addToCart} />)}</div>}
          <section className="mt-16 rounded-[2.5rem] bg-white px-6 py-14 text-black md:px-10"><p className="text-center text-xs font-black uppercase tracking-[.3em] text-orange-600">{t.how}</p><h2 className="mt-3 text-center text-4xl font-black tracking-tight md:text-5xl">{t.simple}</h2>{role === "vendeur" ? <div className="mt-10 rounded-[2rem] border border-black/10 bg-orange-50 p-7"><p className="text-xs uppercase tracking-[.35em] text-orange-600">VENDEUR</p><h3 className="mt-3 text-3xl font-black text-black">Mettre ses produits en vente</h3><div className="mt-6 space-y-4"><div className="rounded-2xl border border-black/10 bg-white p-4"><span className="text-sm font-black text-black">1.</span><p className="mt-2 text-zinc-700">Créer un compte vendeur professionnel.</p></div><div className="rounded-2xl border border-black/10 bg-white p-4"><span className="text-sm font-black text-black">2.</span><p className="mt-2 text-zinc-700">Ajouter les produits avec photos, tailles, couleurs et prix.</p></div><div className="rounded-2xl border border-black/10 bg-white p-4"><span className="text-sm font-black text-black">3.</span><p className="mt-2 text-zinc-700">Les produits apparaissent automatiquement dans la boutique.</p></div><div className="rounded-2xl border border-black/10 bg-white p-4"><span className="text-sm font-black text-black">4.</span><p className="mt-2 text-zinc-700">L’équipe E‑Market gère tout à votre place : livraison, ventes, suivi et assistance. Vous avez juste à envoyer votre produit ou un vendeur E‑Market vient le récupérer.</p></div></div></div> : <div className="mt-10 rounded-[2rem] bg-black p-7 text-white"><p className="text-xs uppercase tracking-[.35em] text-zinc-500">CLIENT</p><h3 className="mt-3 text-3xl font-black">Acheter facilement</h3><div className="mt-6 space-y-4"><div className="rounded-2xl border border-white/10 bg-white/[.05] p-4"><span className="text-sm font-black">1.</span><p className="mt-2 text-zinc-300">Créer un compte ou se connecter.</p></div><div className="rounded-2xl border border-white/10 bg-white/[.05] p-4"><span className="text-sm font-black">2.</span><p className="mt-2 text-zinc-300">Découvrir les produits et choisir tailles/couleurs.</p></div><div className="rounded-2xl border border-white/10 bg-white/[.05] p-4"><span className="text-sm font-black">3.</span><p className="mt-2 text-zinc-300">Ajouter au panier et commander en sécurité.</p></div><div className="rounded-2xl border border-white/10 bg-white/[.05] p-4"><span className="text-sm font-black">4.</span><p className="mt-2 text-zinc-300">Le client doit ensuite confirmer son nom, son adresse complète et son numéro de téléphone afin que l’équipe E‑Market puisse assurer une livraison rapide et sécurisée.</p></div></div></div>}</section>
        </section>
      </main>
    </div>
  );
}
