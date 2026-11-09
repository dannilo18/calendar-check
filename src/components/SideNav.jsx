"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  ChevronRight,
  FileText,
  FilePlus2,
  Images,
  Menu,
  PlusCircle,
  Settings2,
  X,
} from "lucide-react";

// Árvore de 3 camadas, no mesmo formato do Portal do GOB-PI:
// seção > grupo > ação. `match` diz quais outras rotas acendem a ação.
const NAV_TREE = [
  {
    label: "Agenda",
    children: [
      { label: "Ver agenda", icon: CalendarDays, href: "/", match: ["/evento/"] },
      { label: "Novo evento", icon: PlusCircle, href: "/novo" },
    ],
  },
  {
    label: "Documentos",
    children: [
      {
        label: "Decisões",
        children: [
          { label: "Listar documentos", icon: FileText, href: "/documentos", match: ["/documentos/"] },
          { label: "Novo documento", icon: FilePlus2, href: "/documentos/novo" },
        ],
      },
      {
        label: "Identidade Visual",
        children: [
          { label: "Galeria", icon: Images, href: "/identidade-visual" },
          { label: "Gestão de imagens", icon: Settings2, href: "/identidade-visual/gestao" },
        ],
      },
    ],
  },
];

function leaves(nodes) {
  return nodes.flatMap((n) => (n.children ? leaves(n.children) : [n]));
}

// Ação ativa: a que bate exatamente com a rota; senão a de prefixo mais longo.
function activeHref(pathname) {
  const all = leaves(NAV_TREE);
  const exact = all.find((n) => n.href === pathname);
  if (exact) return exact.href;
  let best = null;
  let bestLen = -1;
  for (const n of all) {
    for (const prefix of n.match ?? []) {
      if (pathname.startsWith(prefix) && prefix.length > bestLen) {
        best = n.href;
        bestLen = prefix.length;
      }
    }
  }
  return best;
}

function contains(node, href) {
  return node.children ? node.children.some((c) => contains(c, href)) : node.href === href;
}

export default function SideNav() {
  const pathname = usePathname();
  const active = activeHref(pathname);
  const activeLabel = leaves(NAV_TREE).find((n) => n.href === active)?.label;
  const [mobileOpen, setMobileOpen] = useState(false);

  // Grupos começam fechados, menos o que contém a página atual.
  const [collapsed, setCollapsed] = useState(
    () =>
      new Set(
        NAV_TREE.flatMap((s) => s.children)
          .filter((g) => g.children && !contains(g, active))
          .map((g) => g.label),
      ),
  );

  useEffect(() => {
    setMobileOpen(false);
    setCollapsed((prev) => {
      const next = new Set(prev);
      for (const g of NAV_TREE.flatMap((s) => s.children)) {
        if (g.children && contains(g, active)) next.delete(g.label);
      }
      return next;
    });
  }, [pathname, active]);

  function toggle(label) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  function renderNode(node, depth) {
    const indent = depth * 14 + 8;

    if (!node.children) {
      const Icon = node.icon;
      const isActive = node.href === active;
      return (
        <li key={node.href}>
          <Link
            href={node.href}
            prefetch={false}
            aria-current={isActive ? "page" : undefined}
            style={{ paddingLeft: indent }}
            className={`w-full flex items-center gap-2 pr-3 py-2 rounded-lg text-sm transition-colors ${
              isActive
                ? "bg-gold/10 text-gold font-semibold"
                : "text-gray-600 hover:bg-gray-50 hover:text-primary"
            }`}
          >
            {Icon && <Icon size={14} className="flex-shrink-0" />}
            {node.label}
          </Link>
        </li>
      );
    }

    const isTopLevel = depth === 0;
    const isCollapsed = collapsed.has(node.label);

    return (
      <li key={node.label}>
        <button
          type="button"
          onClick={() => toggle(node.label)}
          style={{ paddingLeft: indent }}
          className="w-full flex items-center gap-1.5 pr-2 py-2 text-left"
          aria-expanded={!isCollapsed}
        >
          <ChevronRight
            size={isTopLevel ? 13 : 11}
            className={`flex-shrink-0 transition-transform ${
              isTopLevel ? "text-gold" : "text-gray-300"
            } ${isCollapsed ? "" : "rotate-90"}`}
          />
          <span
            className={
              isTopLevel
                ? "text-gold text-[11px] font-bold uppercase tracking-[0.2em]"
                : "text-xs font-semibold text-gray-400 uppercase tracking-wide"
            }
          >
            {node.label}
          </span>
        </button>
        {!isCollapsed && (
          <ul className="space-y-0.5">{node.children.map((c) => renderNode(c, depth + 1))}</ul>
        )}
      </li>
    );
  }

  return (
    <nav className="mb-8 lg:mb-0 lg:w-56 lg:flex-shrink-0 lg:sticky lg:top-6 rounded-xl border border-gray-100 bg-white shadow-sm lg:border-0 lg:shadow-none lg:bg-transparent p-2 lg:p-0">
      {/* No celular o menu fica recolhido atrás de um botão. */}
      <button
        type="button"
        onClick={() => setMobileOpen((v) => !v)}
        aria-expanded={mobileOpen}
        className="lg:hidden w-full flex items-center justify-between gap-2 px-2 py-1.5 text-sm text-primary"
      >
        <span className="flex items-center gap-2 font-semibold">
          {mobileOpen ? <X size={16} /> : <Menu size={16} />} Menu
        </span>
        {activeLabel && <span className="text-xs text-gold truncate">{activeLabel}</span>}
      </button>
      <ul className={`space-y-1 ${mobileOpen ? "mt-2" : "hidden"} lg:block lg:mt-0`}>
        {NAV_TREE.map((node) => renderNode(node, 0))}
      </ul>
    </nav>
  );
}
