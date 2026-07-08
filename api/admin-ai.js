export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  const { instruction = "", version = "v1", products = 0 } = req.body || {};
  const key = process.env.OPENAI_API_KEY;

  if (!key) {
    return res.status(200).json({
      reply: `Mode démo ChatGPT : instruction reçue pour ${version}. J’ai préparé une mise à jour sans clé OpenAI connectée. Résumé : ${instruction || "amélioration générale"}. Produits actuellement publiés : ${products}. Clique sur “Mettre à jour le site” pour confirmer la nouvelle version.`
    });
  }

  try {
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Tu es l’IA opérateur de la marketplace E-Market. Réponds en français. Propose des mises à jour concrètes, courtes, sûres, et demande confirmation opérateur avant application." },
          { role: "user", content: `Version actuelle: ${version}. Produits: ${products}. Instruction opérateur: ${instruction}` }
        ],
      }),
    });
    const data = await openaiRes.json();
    const reply = data?.choices?.[0]?.message?.content || "ChatGPT a préparé une suggestion, mais la réponse est vide.";
    return res.status(200).json({ reply });
  } catch (error) {
    return res.status(200).json({
      reply: `Mode secours IA : impossible de joindre OpenAI maintenant. Proposition enregistrée : ${instruction}`
    });
  }
}
