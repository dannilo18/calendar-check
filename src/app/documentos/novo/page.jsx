import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/session";
import AppShell from "@/components/AppShell";
import DocumentEditor from "@/components/DocumentEditor";

export const metadata = { title: "Novo documento" };

export default async function NovoDocumentoPage() {
  if (!(await getSession())) redirect("/login");

  return (
    <AppShell eyebrow="Documentos de decisão" title="Novo documento">
      <Link
        href="/documentos"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-primary transition-colors mb-8"
      >
        <ArrowLeft size={14} /> Voltar aos documentos
      </Link>
      <DocumentEditor />
    </AppShell>
  );
}
