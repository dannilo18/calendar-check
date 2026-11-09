"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Images, Search, X } from "lucide-react";
import { baseName, fileUrl, formatBytes, normalize } from "@/lib/library";

const CATEGORY = "identidade-visual";

// Grade de miniaturas com busca; clicar abre a imagem grande com download.
export default function ImageGallery({ files }) {
  const [query, setQuery] = useState("");
  const [openIndex, setOpenIndex] = useState(null);
  const q = normalize(query.trim());
  const filtered = q ? files.filter((f) => normalize(f.name).includes(q)) : files;
  const current = openIndex != null ? filtered[openIndex] : null;

  useEffect(() => {
    if (openIndex == null) return;
    function onKey(e) {
      if (e.key === "Escape") setOpenIndex(null);
      if (e.key === "ArrowRight") setOpenIndex((i) => (i + 1) % filtered.length);
      if (e.key === "ArrowLeft") setOpenIndex((i) => (i - 1 + filtered.length) % filtered.length);
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [openIndex, filtered.length]);

  return (
    <div className="space-y-5">
      <div className="relative max-w-md">
        <Search
          size={15}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nome..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm text-primary focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-colors bg-white"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Images size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">
            {files.length === 0 ? "Nenhuma imagem enviada ainda." : "Nenhum resultado encontrado."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((f, i) => (
            <button
              key={f.name}
              type="button"
              onClick={() => setOpenIndex(i)}
              className="group text-left bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:border-gold transition-all"
            >
              {/* Fundo quadriculado: deixa visível logo com transparência. */}
              <div className="aspect-square bg-[conic-gradient(#f3f4f6_25%,#fff_0_50%,#f3f4f6_0_75%,#fff_0)] bg-[length:16px_16px] flex items-center justify-center p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fileUrl(CATEGORY, f.name)}
                  alt={baseName(f.name)}
                  loading="lazy"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
              <div className="px-3 py-2 border-t border-gray-100">
                <p className="text-xs font-medium text-primary truncate group-hover:text-gold transition-colors">
                  {baseName(f.name)}
                </p>
                <p className="text-[11px] text-gray-300">{formatBytes(f.size)}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {current && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-label={current.name}
          onClick={() => setOpenIndex(null)}
        >
          <div
            className="flex items-center justify-between gap-3 px-4 py-3 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-medium truncate">{current.name}</p>
            <div className="flex items-center gap-2 flex-shrink-0">
              <a
                href={fileUrl(CATEGORY, current.name, { download: true })}
                download
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gold rounded-lg text-xs font-semibold hover:bg-gold-dark transition-colors"
              >
                <Download size={13} /> Baixar
              </a>
              <button
                type="button"
                onClick={() => setOpenIndex(null)}
                aria-label="Fechar"
                className="p-1.5 rounded-lg hover:bg-white/10"
              >
                <X size={20} />
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0 flex items-center justify-center gap-2 px-2 pb-6">
            {filtered.length > 1 && (
              <NavButton
                label="Anterior"
                onClick={() => setOpenIndex((i) => (i - 1 + filtered.length) % filtered.length)}
              >
                <ChevronLeft size={26} />
              </NavButton>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fileUrl(CATEGORY, current.name)}
              alt={baseName(current.name)}
              onClick={(e) => e.stopPropagation()}
              className="max-w-full max-h-full object-contain bg-[conic-gradient(#e5e7eb_25%,#fff_0_50%,#e5e7eb_0_75%,#fff_0)] bg-[length:16px_16px] rounded"
            />
            {filtered.length > 1 && (
              <NavButton label="Próxima" onClick={() => setOpenIndex((i) => (i + 1) % filtered.length)}>
                <ChevronRight size={26} />
              </NavButton>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NavButton({ label, onClick, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="p-2 text-white/80 hover:text-white rounded-full hover:bg-white/10 flex-shrink-0"
    >
      {children}
    </button>
  );
}
