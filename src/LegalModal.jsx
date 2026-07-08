import React, { useState } from "react";
import { X } from "lucide-react";
import { LEGAL_LAST_UPDATED, TERMS_SECTIONS, PRIVACY_SECTIONS } from "./lib/legalContent.js";

export default function LegalModal({ type, onClose }) {
  const sections = type === "privacy" ? PRIVACY_SECTIONS : TERMS_SECTIONS;
  const title = type === "privacy" ? "Politique de confidentialité" : "Conditions générales d'utilisation";
  const [activeId, setActiveId] = useState(sections[0].id);

  const scrollTo = (id) => {
    setActiveId(id);
    document.getElementById(`legal-${type}-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-xl">
      <div className="flex max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950 text-white shadow-2xl">
        <aside className="hidden w-64 shrink-0 border-r border-white/10 bg-black/40 p-6 md:block">
          <p className="text-xs uppercase tracking-[.3em] text-zinc-500">E‑Market</p>
          <h3 className="mt-2 text-lg font-black leading-snug">{title}</h3>
          <p className="mt-2 text-xs text-zinc-500">Mis à jour le {LEGAL_LAST_UPDATED}</p>
          <nav className="mt-6 max-h-[60vh] space-y-1 overflow-y-auto pr-2">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                className={`block w-full rounded-lg px-3 py-2 text-left text-xs font-medium transition ${activeId === s.id ? "bg-white text-black" : "text-zinc-400 hover:bg-white/[.06] hover:text-white"}`}
              >
                {s.title}
              </button>
            ))}
          </nav>
        </aside>

        <div className="flex flex-1 flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-white/10 p-6">
            <div>
              <p className="text-xs uppercase tracking-[.3em] text-zinc-500 md:hidden">E‑Market</p>
              <h2 className="text-2xl font-black md:text-3xl">{title}</h2>
              <p className="mt-1 text-xs text-zinc-500">Mis à jour le {LEGAL_LAST_UPDATED}</p>
            </div>
            <button onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-black"><X size={18} /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 md:p-8">
            <div className="mx-auto max-w-3xl space-y-8">
              {sections.map((s) => (
                <section key={s.id} id={`legal-${type}-${s.id}`}>
                  <h3 className="text-lg font-black text-white">{s.title}</h3>
                  <div className="mt-3 space-y-3">
                    {s.body.map((p, i) => (
                      <p key={i} className="text-sm leading-relaxed text-zinc-400">{p}</p>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>

          <div className="border-t border-white/10 p-5">
            <button onClick={onClose} className="w-full rounded-2xl bg-white py-3 text-sm font-black uppercase tracking-[.15em] text-black md:w-auto md:px-8">Fermer</button>
          </div>
        </div>
      </div>
    </div>
  );
}
