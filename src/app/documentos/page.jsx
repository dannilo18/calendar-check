import { redirect } from "next/navigation";
import Link from "next/link";
import { FilePlus2 } from "lucide-react";
import { getSession } from "@/lib/session";
import { loadCategory } from "@/lib/acervo";
import { baseName, docUrl } from "@/lib/library";
import AppShell from "@/components/AppShell";
import ErrorBox from "@/components/ErrorBox";
import FileSearchList from "@/components/FileSearchList";

export const metadata = { title: "Documentos de decisão" };

export default async function DocumentosPage() {
  if (!(await getSession())) redirect("/login");
  const { files, error } = await loadCategory("decisoes", { withChanges: true });

  const items = files.map((f) => {
    const name = baseName(f.name);
    return {
      key: f.name,
      name,
      href: docUrl(name),
      size: f.size,
      changed: f.changed,
      changedBy: f.changedBy,
    };
  });

  return (
    <AppShell eyebrow="Documentos" title="Documentos de decisão">
      <div className="flex items-center justify-end mb-8">
        <Link
          href="/documentos/novo"
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-dark transition-colors"
        >
          <FilePlus2 size={15} /> Novo documento
        </Link>
      </div>
      {error && <ErrorBox>{error}</ErrorBox>}
      <FileSearchList items={items} emptyMessage="Nenhum documento criado ainda." />
    </AppShell>
  );
}
