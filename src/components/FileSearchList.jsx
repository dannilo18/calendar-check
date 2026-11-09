"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Clock, Download, FileText, Search, User } from "lucide-react";
import { formatBytes, normalize } from "@/lib/library";

// Lista com busca por nome. Cada item: { key, name, href, size, download,
// changed, changedBy } (changed já vem formatado do servidor).
// `download` → link de download comum; senão, navega para `href`.
export default function FileSearchList({ items, emptyMessage }) {
  const Icon = FileText;
  const [query, setQuery] = useState("");
  const q = normalize(query.trim());
  const filtered = q ? items.filter((it) => normalize(it.name).includes(q)) : items;

  return (
    <div className="space-y-4">
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
          <Icon size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">{items.length === 0 ? emptyMessage : "Nenhum resultado encontrado."}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((it) => {
            const body = (
              <>
                <div className="w-10 h-10 bg-primary/5 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-gold/10 transition-colors">
                  <Icon size={18} className="text-gold" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-primary text-sm leading-snug group-hover:text-gold transition-colors break-words">
                    {it.name}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                    {it.changed && (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock size={10} className="flex-shrink-0" />
                        {it.changed}
                      </span>
                    )}
                    {it.changedBy && (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <User size={10} className="flex-shrink-0" />
                        {it.changedBy}
                      </span>
                    )}
                    {it.size != null && (
                      <span className="text-xs text-gray-300">{formatBytes(it.size)}</span>
                    )}
                  </div>
                </div>
                {it.download ? (
                  <Download size={16} className="text-gray-300 group-hover:text-gold transition-colors flex-shrink-0" />
                ) : (
                  <ChevronRight size={16} className="text-gray-300 group-hover:text-gold transition-colors flex-shrink-0" />
                )}
              </>
            );
            const cls =
              "w-full flex items-center gap-4 bg-white border border-gray-100 rounded-xl px-5 py-4 shadow-sm hover:shadow-md hover:border-gold transition-all group";
            return it.download ? (
              <a key={it.key} href={it.href} download className={cls}>
                {body}
              </a>
            ) : (
              <Link key={it.key} href={it.href} prefetch={false} className={cls}>
                {body}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
