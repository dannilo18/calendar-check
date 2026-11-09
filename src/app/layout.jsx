import "./globals.css";
import Link from "next/link";
import { Lock } from "lucide-react";
import { getSession } from "@/lib/session";
import SignOutButton from "@/components/SignOutButton";

export const metadata = {
  title: {
    default: "Agenda Privada",
    template: "%s | Agenda Privada",
  },
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }) {
  const session = await getSession().catch(() => null);

  return (
    <html lang="pt-BR" suppressHydrationWarning data-scroll-behavior="smooth">
      <body className="flex flex-col min-h-screen">
        {session && (
          <header className="bg-primary-dark border-b border-gold/20">
            <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
              <Link href="/" className="flex items-center gap-3 min-w-0">
                <Lock size={16} className="text-gold flex-shrink-0" />
                <span className="text-white font-serif font-bold text-sm truncate">Agenda Privada</span>
              </Link>
              <div className="flex items-center gap-4 min-w-0">
                <span className="text-xs text-gray-400 truncate hidden sm:inline">
                  {session.user.name} · CIM {session.user.cim}
                </span>
                <SignOutButton />
              </div>
            </div>
          </header>
        )}
        <main className="flex-1">{children}</main>
        {session && (
          <footer className="bg-primary-dark py-6">
            <p className="text-center text-xs text-gray-500">
              Acesso restrito
            </p>
          </footer>
        )}
      </body>
    </html>
  );
}
